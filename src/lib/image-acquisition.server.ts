import { fetchPublicText } from "./safe-public-fetch.server";

type Ref = { url: string; title?: string | null };
export type AcquiredImage = { url: string; alt: string; source: "source-page" | "wikimedia" };
const UA = "BlogdelMediaBot/1.0 (+https://blogdel.blog/about)";

function absolute(candidate: string, base: string): string | null {
  try {
    const u = new URL(candidate, base);
    return /^https?:$/.test(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}
function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
function meta(html: string, names: string[]): string | null {
  for (const name of names) {
    const p1 = new RegExp(
      "<meta[^>]+(?:property|name)=[\\\"']" +
        name +
        "[\\\"'][^>]+content=[\\\"']([^\\\"']+)[\\\"'][^>]*>",
      "i",
    );
    const p2 = new RegExp(
      "<meta[^>]+content=[\\\"']([^\\\"']+)[\\\"'][^>]+(?:property|name)=[\\\"']" +
        name +
        "[\\\"'][^>]*>",
      "i",
    );
    const m = html.match(p1) || html.match(p2);
    if (m?.[1]) return decodeHtml(m[1].trim());
  }
  return null;
}

async function fromReference(ref: Ref, title: string): Promise<AcquiredImage | null> {
  try {
    const { text: html, finalUrl } = await fetchPublicText(ref.url, {
      accept: "text/html,application/xhtml+xml",
      userAgent: UA,
      maxBytes: 700_000,
      allowedContentTypes: ["text/html", "application/xhtml+xml"],
    });
    const candidate = meta(html, [
      "og:image:secure_url",
      "og:image",
      "twitter:image",
      "twitter:image:src",
    ]);
    if (!candidate) return null;
    const url = absolute(candidate, finalUrl);
    if (!url) return null;
    const alt = meta(html, ["og:image:alt", "twitter:image:alt"]) || title;
    return { url, alt, source: "source-page" };
  } catch {
    return null;
  }
}

async function fromWikimedia(query: string, title: string): Promise<AcquiredImage | null> {
  try {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      generator: "search",
      gsrsearch: "filetype:bitmap " + query,
      gsrnamespace: "6",
      gsrlimit: "6",
      prop: "imageinfo",
      iiprop: "url|mime",
      iiurlwidth: "1200",
    });
    const { text } = await fetchPublicText(
      "https://commons.wikimedia.org/w/api.php?" + params.toString(),
      {
        accept: "application/json",
        userAgent: UA,
        maxBytes: 750_000,
        allowedContentTypes: ["application/json"],
      },
    );
    const json = JSON.parse(text) as any;
    const pages = Object.values(json?.query?.pages ?? {}) as any[];
    for (const page of pages) {
      const info = page?.imageinfo?.[0];
      const url = info?.thumburl || info?.url;
      if (typeof url === "string" && /^https?:\/\//.test(url)) {
        const alt = typeof page.title === "string" ? page.title.replace(/^File:/, "") : title;
        return { url, alt, source: "wikimedia" };
      }
    }
  } catch {}
  return null;
}

export async function acquireFeaturedImage(input: {
  title: string;
  keywords?: string[] | null;
  references?: Ref[] | null;
}) {
  for (const ref of input.references ?? []) {
    const image = await fromReference(ref, input.title);
    if (image) return image;
  }
  const terms = [input.title, ...(input.keywords ?? []).slice(0, 3)].join(" ").slice(0, 180);
  return fromWikimedia(terms, input.title);
}
