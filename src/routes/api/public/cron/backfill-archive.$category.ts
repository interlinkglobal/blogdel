import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sourceInputSchema } from "@/lib/article-schema";
import slugify from "slugify";

function admin() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

type ArchiveCategory = "technology" | "health" | "sports" | "politics";
type Ref = { provider: string; title: string; url: string; authority: "primary" | "secondary" | "tertiary" };

const CONFIG: Record<ArchiveCategory, { prefix: string; refs: Ref[] }> = {
  technology: {
    prefix: "tech",
    refs: [
      { provider: "NIST", title: "National Institute of Standards and Technology", url: "https://www.nist.gov/", authority: "primary" },
      { provider: "W3C", title: "World Wide Web Consortium", url: "https://www.w3.org/", authority: "primary" },
    ],
  },
  health: {
    prefix: "health",
    refs: [
      { provider: "WHO", title: "World Health Organization", url: "https://www.who.int/", authority: "primary" },
      { provider: "NIH", title: "National Institutes of Health", url: "https://www.nih.gov/", authority: "primary" },
    ],
  },
  sports: {
    prefix: "sports",
    refs: [
      { provider: "IOC", title: "International Olympic Committee", url: "https://olympics.com/ioc", authority: "primary" },
    ],
  },
  politics: {
    prefix: "politics",
    refs: [
      { provider: "International IDEA", title: "International IDEA", url: "https://www.idea.int/", authority: "primary" },
      { provider: "UN", title: "United Nations", url: "https://www.un.org/", authority: "primary" },
    ],
  },
};

function isArchiveCategory(value: string): value is ArchiveCategory {
  return value in CONFIG;
}

function cleanText(value: string) {
  return value
    .replaceAll("\u2014", "-")
    .replace(/[\u2728\u2b50\ud83c\udf1f\ud83e\udd16]/gu, "");
}

function mergedRefs(generated: any[], seeded: Ref[]) {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const ref of [...(generated ?? []), ...seeded]) {
    const url = String(ref?.url ?? "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({
      provider: cleanText(String(ref.provider ?? "Source")),
      title: cleanText(String(ref.title ?? "Source")),
      url,
      authority: ref.authority ?? "primary",
      published_at: ref.published_at ?? null,
      retrieved_at: ref.retrieved_at ?? null,
    });
  }
  return out;
}

async function processOne(categorySlug: ArchiveCategory) {
  const sb = admin();
  const cfg = CONFIG[categorySlug];

  const { data: sys } = await sb.from("system_state").select("*").maybeSingle();
  if (!sys) return { ok: false, category: categorySlug, error: "no_system_state" };
  if (sys.mode === "fully_paused" || sys.mode === "generation_paused") {
    return { ok: false, category: categorySlug, error: sys.mode };
  }

  let claimed: any = null;
  for (let attempt = 0; attempt < 4 && !claimed; attempt += 1) {
    const { data: queued } = await sb.from("source_items")
      .select("*")
      .eq("status", "queued")
      .like("external_id", `${cfg.prefix}-archive-2026-%`)
      .order("source_published_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!queued) return { ok: true, category: categorySlug, done: true };

    const { data } = await sb.from("source_items")
      .update({ status: "pending" })
      .eq("id", queued.id)
      .eq("status", "queued")
      .select()
      .maybeSingle();
    claimed = data;
  }

  if (!claimed) return { ok: false, category: categorySlug, error: "claim_contention" };

  const item = claimed;
  const exactTitle = cleanText(String((item.context as any)?.headline ?? "").trim());
  const historicalDate = item.source_published_at ?? (item.context as any)?.published_at;
  if (!exactTitle || !historicalDate) {
    await sb.from("source_items").update({ status: "failed", rejection_reason: "missing_archive_metadata" }).eq("id", item.id);
    return { ok: false, category: categorySlug, error: "missing_archive_metadata" };
  }

  const { data: existingArticle } = await sb.from("articles")
    .select("id,title,status,published_at")
    .eq("source_item_id", item.id)
    .limit(1)
    .maybeSingle();
  if (existingArticle) {
    await sb.from("source_items").update({ status: "processed" }).eq("id", item.id);
    return { ok: true, category: categorySlug, existing: true, article: existingArticle.id, title: existingArticle.title };
  }

  const { data: category } = await sb.from("categories").select("id,slug,label").eq("id", item.category_id).single();
  if (!category || category.slug !== categorySlug) {
    await sb.from("source_items").update({ status: "failed", rejection_reason: "archive_category_mismatch" }).eq("id", item.id);
    return { ok: false, category: categorySlug, error: "archive_category_mismatch" };
  }

  const { data: source } = await sb.from("sources").select("*").eq("id", item.source_id).single();
  const { data: author } = await sb.from("authors")
    .select("*")
    .eq("category_id", category.id)
    .eq("is_active", true)
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();

  if (!source || !author) {
    await sb.from("source_items").update({ status: "failed", rejection_reason: !source ? "missing_source" : "no_active_author" }).eq("id", item.id);
    return { ok: false, category: categorySlug, error: !source ? "missing_source" : "no_active_author" };
  }

  const references = CONFIG[categorySlug].refs;
  const baseAvoid = ["fabricated quotes", "unsupported current claims", "title drift", "marketing copy", "em dash", "robot icons", "star icons", "sparkle icons"];
  const instructions = {
    article_type: "explainer" as const,
    tone: "clear",
    target_length: 1000,
    audience: "general",
    freshness: "evergreen",
    avoid: baseAvoid,
  };

  const policyPrompt = categorySlug === "politics"
    ? "Keep the article educational, neutral, factual, and non-advocacy. Explain institutions and mechanisms without endorsing, ranking, persuading, or predicting electoral outcomes."
    : categorySlug === "health"
      ? "Keep the article informational, evidence-based, and non-diagnostic. Do not provide individualized medical diagnosis or treatment instructions."
      : "";

  const input = sourceInputSchema.parse({
    category: categorySlug,
    source_type: source.source_type,
    source_id: source.id,
    prompt: [
      item.prompt,
      `The final title must be exactly: "${exactTitle}".`,
      "Write a substantive evergreen explainer with mechanisms, context, trade offs, practical implications, and useful distinctions.",
      "Use the supplied institutional references as grounding. Do not fabricate quotations, studies, statistics, or claims of current events.",
      "Do not use em dashes or robot, star, or sparkle icons.",
      policyPrompt,
    ].filter(Boolean).join("\n\n"),
    context: { ...(item.context as any), headline: exactTitle, published_at: historicalDate },
    references,
    instructions,
  });

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

  if (jobErr || !job) {
    await sb.from("source_items").update({ status: "failed", rejection_reason: "job_insert_failed" }).eq("id", item.id);
    return { ok: false, category: categorySlug, error: jobErr?.message ?? "job_insert_failed" };
  }

  const { runGeneration } = await import("@/lib/generation.server");
  const { resolveFeaturedImage } = await import("@/lib/image-generation.server");

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

  const started = Date.now();
  try {
    const generatedRaw = await runGeneration({ input, categorySlug, onProviderEvent });
    const article = {
      ...generatedRaw,
      title: exactTitle,
      description: cleanText(generatedRaw.description),
      body_markdown: cleanText(generatedRaw.body_markdown),
      keywords: (generatedRaw.keywords ?? []).map((x: string) => cleanText(x)),
    };

    if (article.body_markdown.length < (sys.min_body_length ?? 500)) throw new Error("body too short");
    const words = article.body_markdown.split(/\s+/).filter(Boolean).length;
    const slug = `${slugify(exactTitle, { lower: true, strict: true }).slice(0, 82)}-${String(item.external_id).slice(-3)}`;

    const { data: articleRow, error: articleErr } = await sb.from("articles").insert({
      source_item_id: item.id,
      category_id: category.id,
      author_id: author.id,
      generation_job_id: job.id,
      slug,
      title: exactTitle,
      description: article.description,
      body_markdown: article.body_markdown,
      article_type: article.article_type,
      language: article.language,
      status: "review",
      published_at: null,
      event_at: historicalDate,
      word_count: words,
      reading_time_minutes: Math.max(1, Math.round(words / 220)),
      keywords: article.keywords,
      provider: article.__provider,
      model: article.__model,
      is_demo: false,
      featured_image_url: null,
      featured_image_alt: exactTitle,
    }).select().single();

    if (articleErr || !articleRow) throw articleErr ?? new Error("article_insert_failed");

    const articleRefs = mergedRefs(article.references as any[], references);
    const image = await resolveFeaturedImage({
      title: exactTitle,
      category: categorySlug,
      body: article.body_markdown,
      articleId: articleRow.id,
      keywords: article.keywords,
      references: articleRefs,
    }, sb);

    const finalStatus = sys.mode === "publishing_paused" ? "review" : "published";
    await (sb.from("articles") as any).update({
      featured_image_url: image?.url ?? null,
      featured_image_alt: image?.alt ?? exactTitle,
      image_source_type: image?.sourceType ?? "editorial-fallback",
      image_provider: image?.provider ?? "blogdel",
      image_model: image?.model ?? null,
      status: finalStatus,
      published_at: finalStatus === "published" ? historicalDate : null,
      event_at: historicalDate,
    }).eq("id", articleRow.id);

    if (articleRefs.length) {
      await sb.from("article_references").insert(articleRefs.map((ref: any, index: number) => ({
        article_id: articleRow.id,
        source_item_id: item.id,
        provider: ref.provider,
        title: ref.title,
        url: ref.url,
        authority: ref.authority,
        position: index,
        source_published_at: ref.published_at ?? null,
        retrieved_at: ref.retrieved_at ?? new Date().toISOString(),
      })));
    }

    const now = new Date().toISOString();
    await Promise.all([
      sb.from("delegation_jobs").update({ status: "completed", completed_at: now, output_payload: article as any }).eq("id", job.id),
      sb.from("source_items").update({ status: "processed", refs: articleRefs as any, rejection_reason: null }).eq("id", item.id),
      sb.from("authors").update({ last_used_at: now }).eq("id", author.id),
    ]);

    return {
      ok: true,
      category: categorySlug,
      article: articleRow.id,
      title: exactTitle,
      published_at: finalStatus === "published" ? historicalDate : null,
      status: finalStatus,
      image: image?.provider ?? "fallback",
      latency_ms: Date.now() - started,
    };
  } catch (error: any) {
    const now = new Date().toISOString();
    const message = cleanText(error?.message ?? String(error)).slice(0, 800);
    const retryableProviderFailure = /Groq and Gemini both failed|rate limit|429|quota/i.test(message);
    await Promise.all([
      sb.from("delegation_jobs").update({ status: "failed", completed_at: now, failure_reason: message }).eq("id", job.id),
      sb.from("source_items").update({
        status: retryableProviderFailure ? "queued" : "failed",
        rejection_reason: retryableProviderFailure ? "retryable_provider_failure" : "generation_failed",
      }).eq("id", item.id),
    ]);
    return {
      ok: false,
      category: categorySlug,
      title: exactTitle,
      error: message,
      retryable: retryableProviderFailure,
      latency_ms: Date.now() - started,
    };
  }
}

async function runArchive(category: ArchiveCategory, limit: number) {
  const results: any[] = [];
  for (let index = 0; index < limit; index += 1) {
    const result = await processOne(category);
    results.push(result);
    if (result.done || !result.ok) break;
  }
  return {
    ok: results.every((x) => x.ok),
    category,
    requested: limit,
    completed: results.filter((x) => x.ok && !x.done && !x.existing).length,
    results,
  };
}

export const Route = createFileRoute("/api/public/cron/backfill-archive/$category")({
  server: {
    handlers: {
      GET: async ({ request, params }) => runOrJson(request, params.category),
      POST: async ({ request, params }) => runOrJson(request, params.category),
    },
  },
});

async function runOrJson(request: Request, rawCategory: string) {
  const expectedToken = process.env.CRON_TOKEN;
  if (!expectedToken) return Response.json({ error: "CRON_TOKEN not configured" }, { status: 503 });

  const token = request.headers.get("x-cron-token");
  if (!token || token !== expectedToken) return Response.json({ error: "unauthorized" }, { status: 401 });

  if (!isArchiveCategory(rawCategory)) return Response.json({ error: "unsupported_archive_category" }, { status: 400 });

  const rawLimit = Number(new URL(request.url).searchParams.get("limit") ?? 1);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(5, Math.trunc(rawLimit))) : 1;

  try {
    return Response.json(await runArchive(rawCategory, limit));
  } catch (error: any) {
    return Response.json({ error: cleanText(error?.message ?? String(error)) }, { status: 500 });
  }
}
