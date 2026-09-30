import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

type Lookup = (hostname: string) => Promise<readonly string[]>;
const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 1_000_000;

function blockedIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255))
    return true;
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function blockedIpv6(address: string) {
  const normalized = address.toLowerCase().split("%")[0] ?? "";
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || /^fe[89ab]/.test(normalized))
    return true;
  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mapped ? blockedIpv4(mapped) : false;
}

export function isPublicAddress(address: string) {
  const version = isIP(address);
  if (version === 4) return !blockedIpv4(address);
  if (version === 6) return !blockedIpv6(address);
  return false;
}

const systemLookup: Lookup = async (hostname) => {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
};

export async function assertPublicHttpUrl(input: string | URL, resolve: Lookup = systemLookup) {
  const url = input instanceof URL ? new URL(input) : new URL(input);
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new Error("Unsupported URL protocol");
  if (url.username || url.password) throw new Error("URL credentials are not allowed");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Nonstandard URL port");
  const addresses = isIP(url.hostname) ? [url.hostname] : await resolve(url.hostname);
  if (!addresses.length || addresses.some((address) => !isPublicAddress(address))) {
    throw new Error("URL resolves to a non-public address");
  }
  return url;
}

async function readBounded(response: Response, maxBytes = MAX_RESPONSE_BYTES) {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new Error("Response is too large");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let output = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error("Response is too large");
      output += decoder.decode(value, { stream: true });
    }
    return output + decoder.decode();
  } finally {
    if (total > maxBytes) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function fetchPublicText(
  input: string,
  options: {
    accept: string;
    userAgent: string;
    timeoutMs?: number;
    maxBytes?: number;
    allowedContentTypes: readonly string[];
  },
) {
  let current = await assertPublicHttpUrl(input);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: { "user-agent": options.userAgent, accept: options.accept },
      signal: AbortSignal.timeout(options.timeoutMs ?? 7000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) throw new Error("Unsafe or excessive redirect");
      current = await assertPublicHttpUrl(new URL(location, current));
      continue;
    }
    const type = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!response.ok || !options.allowedContentTypes.some((allowed) => type.includes(allowed))) {
      throw new Error("Unexpected public response");
    }
    return { text: await readBounded(response, options.maxBytes), finalUrl: current.toString() };
  }
  throw new Error("Redirect limit exceeded");
}
