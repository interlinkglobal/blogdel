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

type Ref = {
  provider: string;
  title: string;
  url: string;
  authority: "primary" | "secondary" | "tertiary";
};

const REF = {
  w3c: { provider: "W3C", title: "World Wide Web Consortium", url: "https://www.w3.org/", authority: "primary" } as Ref,
  nist: { provider: "NIST", title: "National Institute of Standards and Technology", url: "https://www.nist.gov/", authority: "primary" } as Ref,
  oecd: { provider: "OECD", title: "OECD Digital Economy", url: "https://www.oecd.org/digital/", authority: "primary" } as Ref,
  nasa: { provider: "NASA", title: "NASA", url: "https://www.nasa.gov/", authority: "primary" } as Ref,
  iea: { provider: "IEA", title: "International Energy Agency", url: "https://www.iea.org/", authority: "primary" } as Ref,
};

function referencesForTitle(title: string): Ref[] {
  const t = title.toLowerCase();
  if (/satellite|space|orbit|rocket/.test(t)) return [REF.nasa, REF.nist];
  if (/energy|power|electricity|data centre|data center/.test(t)) return [REF.iea, REF.nist];
  if (/security|cyber|zero trust|identity|quantum|semiconductor|chip|encryption|cryptograph/.test(t)) return [REF.nist, REF.oecd];
  if (/web|internet|protocol|accessibility|browser|standard|open source/.test(t)) return [REF.w3c, REF.nist];
  return [REF.oecd, REF.nist];
}

async function runOne() {
  const sb = admin();
  const { data: sys } = await sb.from("system_state").select("*").maybeSingle();
  if (!sys) return { ok: false, error: "no_system_state" };
  if (sys.mode === "fully_paused" || sys.mode === "generation_paused") {
    return { ok: true, skipped: true, reason: sys.mode };
  }

  const { data: queued } = await sb.from("source_items")
    .select("*")
    .eq("status", "queued")
    .like("external_id", "tech-backfill-2026-%")
    .order("source_published_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!queued) return { ok: true, done: true, remaining: 0 };

  const { data: item } = await sb.from("source_items")
    .update({ status: "pending" })
    .eq("id", queued.id)
    .eq("status", "queued")
    .select()
    .maybeSingle();

  if (!item) return { ok: true, skipped: true, reason: "claimed_elsewhere" };

  const targetTitle = String((item.context as any)?.headline ?? "").trim();
  if (!targetTitle) {
    await sb.from("source_items").update({ status: "failed", rejection_reason: "missing_backfill_title" }).eq("id", item.id);
    return { ok: false, error: "missing_backfill_title" };
  }

  const { data: category } = await sb.from("categories").select("id,slug,label").eq("id", item.category_id).single();
  if (!category || category.slug !== "technology") {
    await sb.from("source_items").update({ status: "failed", rejection_reason: "invalid_backfill_category" }).eq("id", item.id);
    return { ok: false, error: "invalid_backfill_category" };
  }

  const { data: author } = await sb.from("authors")
    .select("*")
    .eq("category_id", category.id)
    .eq("is_active", true)
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();

  if (!author) {
    await sb.from("source_items").update({ status: "failed", rejection_reason: "no_active_author" }).eq("id", item.id);
    return { ok: false, error: "no_active_author" };
  }

  const references = referencesForTitle(targetTitle);
  const input = sourceInputSchema.parse({
    category: "technology",
    source_type: "evergreen",
    source_id: item.source_id,
    prompt: [
      `Write an original evergreen Blogdel technology article with this exact title: "${targetTitle}".`,
      "The output title MUST match the supplied title exactly, character for character.",
      "Explain the subject for a general reader with concrete mechanisms, trade-offs, and practical implications.",
      "Do not invent quotes, statistics, studies, product announcements, or current events.",
      "Use the supplied institutional references as grounding and do not imply that a reference supports a claim it does not support.",
    ].join("\n\n"),
    context: {
      headline: targetTitle,
      published_at: item.source_published_at ?? undefined,
    },
    references,
    instructions: {
      article_type: "explainer",
      tone: "clear",
      target_length: 1000,
      audience: "general",
      freshness: "evergreen",
      avoid: ["fabricated quotes", "unsupported current claims", "title drift", "marketing copy"],
    },
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
    return { ok: false, error: jobErr?.message ?? "job_insert_failed" };
  }

  const { runGeneration } = await import("@/lib/generation.server");
  const { acquireFeaturedImage } = await import("@/lib/image-acquisition.server");
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
    const generated = await runGeneration({ input, categorySlug: "technology", onProviderEvent });
    if (generated.body_markdown.length < (sys.min_body_length ?? 500)) throw new Error("body too short");

    const article = { ...generated, title: targetTitle };
    const words = article.body_markdown.split(/\s+/).filter(Boolean).length;

    // Backfill images are acquired title-by-title as each article is written.
    // We intentionally omit reference-page images here so the search is driven
    // by the individual article title/keywords instead of a repeated site OG image.
    const image = await acquireFeaturedImage({
      title: targetTitle,
      keywords: article.keywords,
      references: [],
    });

    const slug = slugify(targetTitle, { lower: true, strict: true }).slice(0, 86) + "-" + String(item.external_id).slice(-4);
    const status = sys.mode === "publishing_paused" ? "review" : "published";
    const historicalDate = item.source_published_at ?? new Date().toISOString();

    const { data: articleRow, error: articleErr } = await sb.from("articles").insert({
      source_item_id: item.id,
      category_id: category.id,
      author_id: author.id,
      generation_job_id: job.id,
      slug,
      title: targetTitle,
      description: article.description,
      body_markdown: article.body_markdown,
      article_type: article.article_type,
      language: article.language,
      status,
      published_at: status === "published" ? historicalDate : null,
      event_at: historicalDate,
      word_count: words,
      reading_time_minutes: Math.max(1, Math.round(words / 220)),
      keywords: article.keywords,
      provider: article.__provider,
      model: article.__model,
      is_demo: false,
      featured_image_url: image?.url ?? null,
      featured_image_alt: image?.alt ?? targetTitle,
    }).select().single();

    if (articleErr || !articleRow) throw articleErr ?? new Error("article_insert_failed");

    if (article.references?.length) {
      await sb.from("article_references").insert(article.references.map((r: any, i: number) => ({
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
      sb.from("source_items").update({ status: "processed", refs: references as any }).eq("id", item.id),
      sb.from("authors").update({ last_used_at: now }).eq("id", author.id),
    ]);

    const { count: remaining } = await sb.from("source_items")
      .select("*", { count: "exact", head: true })
      .eq("status", "queued")
      .like("external_id", "tech-backfill-2026-%");

    return {
      ok: true,
      article: articleRow.id,
      title: targetTitle,
      status,
      historical_date: historicalDate,
      image_assigned: Boolean(image?.url),
      remaining: remaining ?? null,
      latency_ms: Date.now() - started,
    };
  } catch (e: any) {
    const now = new Date().toISOString();
    await Promise.all([
      sb.from("delegation_jobs").update({
        status: "failed",
        completed_at: now,
        failure_reason: (e?.message ?? String(e)).slice(0, 800),
      }).eq("id", job.id),
      sb.from("source_items").update({ status: "failed", rejection_reason: "generation_failed" }).eq("id", item.id),
    ]);
    return { ok: false, error: e?.message ?? String(e), title: targetTitle, latency_ms: Date.now() - started };
  }
}

export const Route = createFileRoute("/api/public/cron/backfill-technology")({
  server: {
    handlers: {
      GET: async ({ request }) => runOrJson(request),
      POST: async ({ request }) => runOrJson(request),
    },
  },
});

async function runOrJson(request: Request) {
  const expectedToken = process.env.CRON_TOKEN;
  if (!expectedToken) {
    return new Response(JSON.stringify({ error: "CRON_TOKEN not configured" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }
  const token = request.headers.get("x-cron-token");
  if (!token || token !== expectedToken) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  try {
    const result = await runOne();
    return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
