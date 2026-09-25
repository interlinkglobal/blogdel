import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sourceInputSchema, REFERENCE_MINIMA } from "@/lib/article-schema";
import slugify from "slugify";

function admin() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

const EXTRA_REFS: Record<string, Array<{ provider: string; title: string; url: string; authority: "primary" | "secondary" | "tertiary" }>> = {
  technology: [{ provider: "W3C", title: "World Wide Web Consortium", url: "https://www.w3.org/", authority: "primary" }],
  health: [
    { provider: "WHO", title: "World Health Organization", url: "https://www.who.int/", authority: "primary" },
    { provider: "NIH", title: "National Institutes of Health", url: "https://www.nih.gov/", authority: "primary" },
  ],
  sports: [{ provider: "IOC", title: "International Olympic Committee", url: "https://olympics.com/ioc", authority: "primary" }],
  politics: [
    { provider: "UN", title: "United Nations", url: "https://www.un.org/", authority: "primary" },
    { provider: "International IDEA", title: "International IDEA", url: "https://www.idea.int/", authority: "primary" },
  ],
  entertainment: [{ provider: "UNESCO", title: "UNESCO Culture", url: "https://www.unesco.org/en/culture", authority: "primary" }],
  business: [{ provider: "World Bank", title: "World Bank", url: "https://www.worldbank.org/", authority: "primary" }],
  science: [
    { provider: "NSF", title: "U.S. National Science Foundation", url: "https://www.nsf.gov/", authority: "primary" },
    { provider: "NASA", title: "NASA", url: "https://www.nasa.gov/", authority: "primary" },
  ],
  education: [{ provider: "UNESCO", title: "UNESCO Education", url: "https://www.unesco.org/en/education", authority: "primary" }],
  food: [{ provider: "FAO", title: "Food and Agriculture Organization", url: "https://www.fao.org/", authority: "primary" }],
  history: [{ provider: "Smithsonian", title: "Smithsonian Institution", url: "https://www.si.edu/", authority: "primary" }],
};

function refsFor(catSlug: string, source: any) {
  const refs: any[] = [];
  if (source?.base_url) refs.push({ provider: source.slug, title: source.name, url: source.base_url, authority: "primary" });
  for (const ref of EXTRA_REFS[catSlug] ?? []) {
    if (!refs.some((r) => r.url === ref.url)) refs.push(ref);
  }
  return refs;
}

async function processCategory(sb: ReturnType<typeof admin>, sys: any, category: any, reason: string) {
  const { runGeneration } = await import("@/lib/generation.server");
  const { resolveFeaturedImage } = await import("@/lib/image-generation.server");

  const { data: source } = await sb.from("sources")
    .select("*")
    .eq("category_id", category.id)
    .eq("is_enabled", true)
    .eq("source_type", "evergreen")
    .order("last_run_at", { ascending: true, nullsFirst: true })
    .order("priority", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!source) return { category: category.slug, ok: false, error: "no_enabled_source" };

  const { data: recent } = await sb.from("articles")
    .select("title")
    .eq("category_id", category.id)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(8);

  const recentTitles = (recent ?? []).map((r: any) => r.title).filter(Boolean);
  const basePrompt = source.prompt_template ?? `Write an original ${category.label} article.`;
  const prompt = [
    basePrompt,
    "Choose a fresh, materially different angle suitable for an evergreen publication.",
    recentTitles.length ? `Do not repeat these recent Blogdel topics or theses: ${recentTitles.join(" | ")}` : "",
    "Avoid invented quotes, invented statistics, and claims of current events you cannot support from the supplied references.",
  ].filter(Boolean).join("\n\n");

  const references = refsFor(category.slug, source);
  const minRefs = REFERENCE_MINIMA[category.slug] ?? 1;
  if (references.length < minRefs) return { category: category.slug, ok: false, error: "insufficient_reference_seed" };

  const { data: item, error: itemErr } = await sb.from("source_items").insert({
    source_id: source.id,
    category_id: category.id,
    external_id: `${source.slug}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    prompt,
    refs: references as any,
    instructions: { article_type: "explainer", tone: "clear", target_length: 900, audience: "general", freshness: "evergreen", avoid: ["fabricated quotes", "unsupported current claims", "topic repetition"] } as any,
    content_hash: null,
    status: "queued",
  }).select().single();
  if (itemErr || !item) return { category: category.slug, ok: false, error: itemErr?.message ?? "source_item_insert_failed" };

  const { data: author } = await sb.from("authors")
    .select("*")
    .eq("category_id", category.id)
    .eq("is_active", true)
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();
  if (!author) {
    await sb.from("source_items").update({ status: "failed", rejection_reason: "no_active_author" }).eq("id", item.id);
    return { category: category.slug, ok: false, error: "no_active_author" };
  }

  let input;
  try {
    input = sourceInputSchema.parse({
      category: category.slug,
      source_type: source.source_type,
      source_id: source.id,
      prompt: item.prompt,
      context: {},
      references: item.refs as any,
      instructions: item.instructions as any,
    });
  } catch (e: any) {
    await sb.from("source_items").update({ status: "failed", rejection_reason: "input_invalid" }).eq("id", item.id);
    return { category: category.slug, ok: false, error: "input_invalid: " + e.message };
  }

  const { data: job, error: jobErr } = await sb.from("delegation_jobs").insert({
    source_item_id: item.id,
    author_id: author.id,
    category_id: category.id,
    job_type: "draft",
    provider: sys.primary_provider ?? "groq",
    model: "openai/gpt-oss-20b",
    input_payload: input as any,
    status: "running",
    attempt_count: 1,
    started_at: new Date().toISOString(),
  }).select().single();
  if (jobErr || !job) return { category: category.slug, ok: false, error: jobErr?.message ?? "job_insert_failed" };

  await sb.from("source_items").update({ status: "pending" }).eq("id", item.id);

  const started = Date.now();
  const onProviderEvent = async (ev: any) => {
    try {
      await sb.from("provider_events").insert({
        job_id: job.id,
        provider: ev.provider,
        model: ev.model ?? null,
        event_type: ev.event_type,
        error_code: ev.error_code ?? null,
        status_code: ev.status_code ?? null,
        latency_ms: ev.latency_ms,
        metadata: ev.message ? ({ message: ev.message } as any) : ({} as any),
      });
    } catch {}
  };

  try {
    const article = await runGeneration({ input, categorySlug: category.slug, onProviderEvent });
    if (article.body_markdown.length < (sys.min_body_length ?? 500)) throw new Error("body too short");

    const words = article.body_markdown.split(/\s+/).filter(Boolean).length;
    const slug = slugify(article.slug, { lower: true, strict: true }).slice(0, 80) + "-" + Math.random().toString(36).slice(2, 6);
    const status = sys.mode === "publishing_paused" ? "review" : "published";

    const { data: articleRow, error: insErr } = await sb.from("articles").insert({
      source_item_id: item.id,
      category_id: category.id,
      author_id: author.id,
      generation_job_id: job.id,
      slug,
      title: article.title,
      description: article.description,
      body_markdown: article.body_markdown,
      article_type: article.article_type,
      language: article.language,
      status: "review",
      published_at: null,
      word_count: words,
      reading_time_minutes: Math.max(1, Math.round(words / 220)),
      keywords: article.keywords,
      provider: article.__provider,
      model: article.__model,
      is_demo: false,
      featured_image_url: null,
      featured_image_alt: article.title,
    }).select().single();
    if (insErr || !articleRow) throw insErr ?? new Error("article insert failed");

    const image = await resolveFeaturedImage({ title: article.title, category: category.slug, body: article.body_markdown, articleId: articleRow.id, keywords: article.keywords, references: article.references }, sb);
    const finalStatus = sys.mode === "publishing_paused" ? "review" : "published";
    await (sb.from("articles") as any).update({ featured_image_url: image?.url ?? null, featured_image_alt: image?.alt ?? article.title, image_source_type: image?.sourceType ?? "editorial-fallback", image_provider: image?.provider ?? "blogdel", image_model: image?.model ?? null, status: finalStatus, published_at: finalStatus === "published" ? new Date().toISOString() : null }).eq("id", articleRow.id);

    if (article.references?.length) {
      await sb.from("article_references").insert(article.references.map((r, i) => ({
        article_id: articleRow.id,
        provider: r.provider,
        title: r.title,
        url: r.url,
        authority: r.authority,
        position: i,
      })));
    }

    const now = new Date().toISOString();
    await Promise.all([
      sb.from("delegation_jobs").update({ status: "completed", completed_at: now, output_payload: article as any }).eq("id", job.id),
      sb.from("source_items").update({ status: "processed" }).eq("id", item.id),
      sb.from("authors").update({ last_used_at: now }).eq("id", author.id),
      sb.from("sources").update({ last_run_at: now, collected_count: (source.collected_count ?? 0) + 1 }).eq("id", source.id),
    ]);

    return { category: category.slug, ok: true, article: articleRow.id, status: finalStatus, latency_ms: Date.now() - started, reason };
  } catch (e: any) {
    const now = new Date().toISOString();
    await Promise.all([
      sb.from("delegation_jobs").update({ status: "failed", completed_at: now, failure_reason: (e?.message ?? String(e)).slice(0, 800) }).eq("id", job.id),
      sb.from("source_items").update({ status: "failed", rejection_reason: "generation_failed" }).eq("id", item.id),
    ]);
    return { category: category.slug, ok: false, error: e?.message ?? String(e), latency_ms: Date.now() - started };
  }
}

async function runTick(reason: string) {
  const sb = admin();
  const { data: sys } = await sb.from("system_state").select("*").maybeSingle();
  if (!sys) return { ok: false, error: "no system_state" };
  if (sys.mode === "fully_paused" || sys.mode === "generation_paused") return { ok: true, skipped: true, reason: sys.mode };

  await sb.from("system_state").update({ last_run_at: new Date().toISOString() }).eq("id", 1);
  const { data: categories } = await sb.from("categories").select("id,slug,label,sort_order").order("sort_order");

  const results: any[] = [];
  const cats = categories ?? [];
  for (let i = 0; i < cats.length; i += 2) {
    const batch = cats.slice(i, i + 2);
    const batchResults = await Promise.all(batch.map((cat: any) => processCategory(sb, sys, cat, reason)));
    results.push(...batchResults);
  }

  return {
    ok: true,
    requested: cats.length,
    produced: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

export const Route = createFileRoute("/api/public/cron/tick")({
  server: {
    handlers: {
      GET: async ({ request }) => runOrJson(request, "GET"),
      POST: async ({ request }) => runOrJson(request, "POST"),
    },
  },
});

async function runOrJson(request: Request, reason: string) {
  const expectedToken = process.env.CRON_TOKEN;
  if (!expectedToken) return new Response(JSON.stringify({ error: "CRON_TOKEN not configured" }), { status: 503, headers: { "content-type": "application/json" } });
  const token = request.headers.get("x-cron-token");
  if (!token || token !== expectedToken) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  try {
    const result = await runTick(reason);
    return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
