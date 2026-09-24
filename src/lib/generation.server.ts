// Generation providers: Groq (primary), Gemini (fallback).
//
// Each provider attempt is classified and reported through `onProviderEvent`
// (used by callers to write into provider_events, tied to the job id).
// Diagnostic reporting must never interrupt the fallback chain.

import { articleOutputSchema, sourceInputSchema } from "./article-schema";
import type { z } from "zod";
import slugify from "slugify";

type Input = z.infer<typeof sourceInputSchema>;
type Output = z.infer<typeof articleOutputSchema> & { __provider: string; __model: string };

// Matches public.provider_event_type enum in the database.
export type ProviderEventType =
  | "request_started"
  | "request_completed"
  | "rate_limited"
  | "timeout"
  | "schema_failed"
  | "provider_unavailable"
  | "fallback_activated"
  | "provider_recovered";

export type ProviderErrorCode =
  | "missing_key"
  | "authentication_failure"
  | "rate_limit"
  | "timeout"
  | "server_error"
  | "invalid_json"
  | "schema_failure"
  | "network_error"
  | "unknown_error";

export type ProviderEventRecord = {
  provider: string;
  model?: string | null;
  event_type: ProviderEventType;
  error_code?: ProviderErrorCode;
  status_code?: number | null;
  latency_ms: number;
  message?: string;
};

export type GenerationOptions = {
  input: Input;
  categorySlug: string;
  model?: string;
  onProviderEvent?: (e: ProviderEventRecord) => void | Promise<void>;
};

const SYSTEM_PROMPT = `You are the Blogdel editorial engine. Produce ONE original, schema-valid article as JSON.
STRICT: respond with a JSON object ONLY (no markdown, no commentary), matching this shape:
{
  "slug": "lowercase-kebab-case",
  "category": "<one of technology,health,sports,politics,entertainment,business,science,education,food,history>",
  "title": "8-160 chars",
  "description": "30-320 chars",
  "body_markdown": "at least 500 characters, in Markdown, using ## H2 subheads",
  "article_type": "news|analysis|explainer|list|profile|history|guide",
  "language": "en",
  "keywords": ["up to 12 keywords"],
  "references": [ { "provider": "...", "title": "...", "url": "...", "authority": "primary|secondary|tertiary" } ]
}
Rules: never fabricate quotes attributed to real people, do not include placeholder text like TODO or LOREM, do not include the source prompt back in the body, always include the supplied references, keep description a plain sentence (no markdown), and use British/American English consistently.`;

function buildUserPrompt(input: Input): string {
  return [
    `CATEGORY: ${input.category}`,
    `ARTICLE_TYPE: ${input.instructions.article_type}`,
    `TARGET_LENGTH_WORDS: ${input.instructions.target_length}`,
    `AUDIENCE: ${input.instructions.audience}`,
    `PROMPT:\n${input.prompt}`,
    input.context?.summary ? `CONTEXT_SUMMARY:\n${input.context.summary}` : "",
    `REFERENCES (must be echoed back in "references"):\n${JSON.stringify(input.references, null, 2)}`,
    `Respond with a JSON object matching the schema.`,
  ].filter(Boolean).join("\n\n");
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? text).trim();
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  const slice = first >= 0 && last > first ? candidate.slice(first, last + 1) : candidate;
  return JSON.parse(slice);
}

// Sanitize error text so we never persist API keys or Authorization headers.
function sanitizeMessage(raw: unknown): string {
  let s = typeof raw === "string" ? raw : (raw as any)?.message ?? String(raw);
  if (!s) return "";
  s = s
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/(authorization["'\s:=]+)[^"'\s,}]+/gi, "$1[redacted]")
    .replace(/(api[_-]?key["'\s:=]+)[^"'\s,}]+/gi, "$1[redacted]")
    .replace(/(gsk_|sk-|sb_[a-z]+_)[A-Za-z0-9_-]{6,}/g, "$1[redacted]")
    .replace(/(key=)[A-Za-z0-9_-]+/g, "$1[redacted]");
  return s.slice(0, 800);
}

function classifyHttpStatus(status: number): { event_type: ProviderEventType; error_code: ProviderErrorCode } {
  if (status === 401 || status === 403) return { event_type: "provider_unavailable", error_code: "authentication_failure" };
  if (status === 429) return { event_type: "rate_limited", error_code: "rate_limit" };
  if (status === 408 || status === 504) return { event_type: "timeout", error_code: "timeout" };
  if (status >= 500) return { event_type: "provider_unavailable", error_code: "server_error" };
  return { event_type: "provider_unavailable", error_code: "unknown_error" };
}

class ProviderError extends Error {
  event_type: ProviderEventType;
  error_code: ProviderErrorCode;
  status_code: number | null;
  constructor(opts: { event_type: ProviderEventType; error_code: ProviderErrorCode; status_code?: number | null; message: string }) {
    super(opts.message);
    this.event_type = opts.event_type;
    this.error_code = opts.error_code;
    this.status_code = opts.status_code ?? null;
  }
}

async function safeEmit(onEvent: GenerationOptions["onProviderEvent"], rec: ProviderEventRecord) {
  if (!onEvent) return;
  try { await onEvent(rec); } catch { /* diagnostics must never break the chain */ }
}

async function runProvider(
  provider: string,
  model: string,
  onEvent: GenerationOptions["onProviderEvent"],
  fn: () => Promise<Output | null>,
): Promise<Output | null> {
  const started = Date.now();
  try {
    const out = await fn();
    if (out === null) return null; // provider not configured — event already emitted by caller
    await safeEmit(onEvent, {
      provider, model, event_type: "request_completed",
      status_code: 200, latency_ms: Date.now() - started,
    });
    return out;
  } catch (e: any) {
    const isProvErr = e instanceof ProviderError;
    const event_type: ProviderEventType = isProvErr ? e.event_type : (e?.name === "ZodError" ? "schema_failed" : "provider_unavailable");
    const error_code: ProviderErrorCode = isProvErr ? e.error_code : (e?.name === "ZodError" ? "schema_failure" : "unknown_error");
    await safeEmit(onEvent, {
      provider, model, event_type, error_code,
      status_code: isProvErr ? e.status_code : null,
      latency_ms: Date.now() - started,
      message: sanitizeMessage(e),
    });
    return null;
  }
}

async function httpJson(res: Response): Promise<any> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const cls = classifyHttpStatus(res.status);
    throw new ProviderError({ ...cls, status_code: res.status, message: `HTTP ${res.status}: ${body.slice(0, 400)}` });
  }
  try {
    return await res.json();
  } catch (e: any) {
    throw new ProviderError({ event_type: "schema_failed", error_code: "invalid_json", status_code: res.status, message: e?.message ?? "invalid json body" });
  }
}

function parseArticleJson(content: unknown): Output extends infer O ? any : never {
  let json: unknown;
  try {
    json = typeof content === "string" ? extractJson(content as string) : content;
  } catch (e: any) {
    throw new ProviderError({ event_type: "schema_failed", error_code: "invalid_json", message: e?.message ?? "invalid json" });
  }
  const res = articleOutputSchema.safeParse(json);
  if (!res.success) {
    throw new ProviderError({ event_type: "schema_failed", error_code: "schema_failure", message: res.error.message });
  }
  return res.data;
}

async function callGroq(input: Input, model: string): Promise<Output> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new ProviderError({ event_type: "provider_unavailable", error_code: "missing_key", message: "GROQ_API_KEY not configured" });
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model, temperature: 0.6, response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  }).catch((e) => {
    const name = e?.name;
    if (name === "TimeoutError" || name === "AbortError") {
      throw new ProviderError({ event_type: "timeout", error_code: "timeout", message: "Groq request timed out after 30s" });
    }
    throw new ProviderError({ event_type: "provider_unavailable", error_code: "network_error", message: e?.message ?? "network error" });
  });
  const body = await httpJson(res);
  const parsed = parseArticleJson(body?.choices?.[0]?.message?.content);
  return { ...parsed, __provider: "groq", __model: model };
}

async function callGemini(input: Input): Promise<Output> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new ProviderError({ event_type: "provider_unavailable", error_code: "missing_key", message: "GEMINI_API_KEY not configured" });
  const model = "gemini-2.5-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: buildUserPrompt(input) }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.6 },
    }),
  }).catch((e) => { throw new ProviderError({ event_type: "provider_unavailable", error_code: "network_error", message: e?.message ?? "network error" }); });
  const body = await httpJson(res);
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const parsed = parseArticleJson(text);
  return { ...parsed, __provider: "gemini", __model: model };
}

export async function runGeneration(opts: GenerationOptions): Promise<Output> {
  const model = opts.model ?? "openai/gpt-oss-20b";
  const onEvent = opts.onProviderEvent;

  // Provider order (fixed): Groq -> Gemini.
  const groq = await runProvider("groq", model, onEvent, () => callGroq(opts.input, model));
  if (groq) return finalize(groq, opts.input);

  const gemini = await runProvider("gemini", "gemini-2.5-flash", onEvent, () => callGemini(opts.input));
  if (gemini) return finalize(gemini, opts.input);


  throw new Error("Groq and Gemini both failed. See provider_events for per-provider diagnostics.");
}

function finalize(out: Output, input: Input): Output {
  const slug = slugify(out.slug || out.title, { lower: true, strict: true }).slice(0, 90) || "untitled";
  const refs = out.references?.length ? out.references : input.references;
  return { ...out, slug, references: refs };
}
