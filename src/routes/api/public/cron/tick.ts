// Public cron endpoint. Fires the autonomous pipeline once.
// Auth: Supabase publishable key in the `apikey` header (pg_cron uses this).
// Also allows an optional CRON_TOKEN header for external schedulers.

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

async function runTick(reason: string): Promise<any> {
  const sb = admin();
  const { runGeneration } = await import("@/lib/generation.server");
  const { acquireFeaturedImage } = await import("@/lib/image-acquisition.server");
  const { data: sys } = await sb.from("system_state").select("*").maybeSingle();
  if (!sys) return { ok: false, error: "no system_state" };
  await sb.from("system_state").update({ last_run_at: new Date().toISOString() }).eq("id", 1);

  if (sys.mode === "fully_paused" || sys.mode === "generation_paused") {
    return { ok: true, skipped: true, reason: sys.mode };
  }

  const perTick = Math.max(1, Math.floor((sys.daily_target ?? 20) / 3));
  const producedByCategory: Record<string, number> = {};
  const results: any[] = [];

  // 1) Seed one new source_item per enabled evergreen source that has none queued.
  const { data: sources } = await sb.from("sources").select("*,categories(slug,label)").eq("is_enabled", true).eq("source_type", "evergreen");
  for (const src of sources ?? []) {
    const { count } = await sb.from("source_items").select("*", { count: "exact", head: true }).eq("source_id", src.id).in("status", ["queued","pending"]);
    if ((count ?? 0) > 0) continue;
    await sb.from("source_items").insert({
      source_id: src.id, category_id: src.category_id,
      external_id: `${src.slug}-${Date.now().toString(36)}`,
      prompt: src.prompt_template ?? `Write an original article for ${src.categories?.label}.`,
      refs: [{ provider: src.slug, title: src.name, url: "https://blogdel.local", authority: "primary" }] as any,
      instructions: { article_type: "explainer", tone: "clear", target_length: 900, audience: "general", freshness: "current", avoid: [] } as any,
      content_hash: null, status: "queued",
    });
  }

  // 2) Drain queued items up to perTick, respecting per-category cap.
  const { data: queue } = await sb.from("source_items").select("*,categories(slug,label),sources(name,slug)").eq("status","queued").order("created_at").limit(perTick * 3);

  for (const item of queue ?? []) {
    if (results.length >= perTick) break;
    const catSlug = (item as any).categories?.slug;
    if (!catSlug) continue;
    if ((producedByCategory[catSlug] ?? 0) >= (sys.per_category_max ?? 3)) continue;

    // Pick author for category (round-robin by last_used_at).
    const { data: author } = await sb.from("authors").select("*").eq("category_id", item.category_id).eq("is_active", true).order("last_used_at",{ ascending: true, nullsFirst: true }).limit(1).maybeSingle();
    if (!author) continue;

    // Build input.
    let input;
    try {
      input = sourceInputSchema.parse({
        category: catSlug,
        source_type: (item as any).sources ? "evergreen" : "evergreen",
        prompt: item.prompt,
        context: {},
        references: item.refs as any,
        instructions: item.instructions as any,
      });
    } catch (e: any) {
      await sb.from("source_items").update({ status: "failed" }).eq("id", item.id);
      results.push({ item: item.id, error: "input_invalid: " + e.message });
      continue;
    }
    if (input.references.length < (REFERENCE_MINIMA[catSlug] ?? 1)) {
      await sb.from("source_items").update({ status: "failed" }).eq("id", item.id);
      continue;
    }

    // Create job (running).
    const { data: job } = await sb.from("delegation_jobs").insert({
      source_item_id: item.id, author_id: author.id, category_id: item.category_id,
      job_type: "draft", provider: sys.primary_provider ?? "groq", model: "openai/gpt-oss-20b",
      input_payload: input as any, status: "running", attempt_count: 1, started_at: new Date().toISOString(),
    }).select().single();
    await sb.from("source_items").update({ status: "pending" }).eq("id", item.id);

    const started = Date.now();
    const onProviderEvent = async (ev: any) => {
      try {
        await sb.from("provider_events").insert({
          job_id: job!.id, provider: ev.provider, model: ev.model ?? null,
          event_type: ev.event_type, error_code: ev.error_code ?? null,
          status_code: ev.status_code ?? null, latency_ms: ev.latency_ms,
          metadata: ev.message ? ({ message: ev.message } as any) : ({} as any),
        });
      } catch { /* diagnostics must never interrupt the fallback chain */ }
    };
    try {
      const article = await runGeneration({ input, categorySlug: catSlug, onProviderEvent });
      const words = article.body_markdown.split(/\s+/).filter(Boolean).length;
      const image = await acquireFeaturedImage({ title: article.title, keywords: article.keywords, references: article.references });
      if (article.body_markdown.length < (sys.min_body_length ?? 500)) throw new Error("body too short");
      const slug = slugify(article.slug, { lower: true, strict: true }).slice(0, 80) + "-" + Math.random().toString(36).slice(2,6);
      const status = sys.mode === "publishing_paused" ? "review" : "published";
      const { data: articleRow, error: insErr } = await sb.from("articles").insert({
        source_item_id: item.id, category_id: item.category_id, author_id: author.id, generation_job_id: job?.id,
        slug, title: article.title, description: article.description, body_markdown: article.body_markdown,
        article_type: article.article_type, language: article.language, status,
        published_at: status === "published" ? new Date().toISOString() : null,
        word_count: words, reading_time_minutes: Math.max(1, Math.round(words / 220)),
        keywords: article.keywords, provider: article.__provider, model: article.__model, is_demo: false,
        featured_image_url: image?.url ?? null, featured_image_alt: image?.alt ?? article.title,
      }).select().single();
      if (insErr) throw insErr;
      if (article.references?.length) {
        await sb.from("article_references").insert(article.references.map((r, i) => ({
          article_id: articleRow.id, provider: r.provider, title: r.title, url: r.url, authority: r.authority, position: i,
        })));
      }
      await sb.from("delegation_jobs").update({ status: "completed", completed_at: new Date().toISOString(), output_payload: article as any }).eq("id", job!.id);
      await sb.from("source_items").update({ status: "processed" }).eq("id", item.id);
      await sb.from("authors").update({ last_used_at: new Date().toISOString() }).eq("id", author.id);
      producedByCategory[catSlug] = (producedByCategory[catSlug] ?? 0) + 1;
      results.push({ item: item.id, ok: true, article: articleRow.id, status });
    } catch (e: any) {
      // Per-provider diagnostics have already been written via onProviderEvent.
      // Do NOT insert a synthetic "groq schema_failed" event here — that would
      // misattribute a pipeline-level failure to a specific provider.
      await sb.from("delegation_jobs").update({
        status: "failed", completed_at: new Date().toISOString(),
        failure_reason: (e?.message ?? String(e)).slice(0, 800),
      }).eq("id", job!.id);
      await sb.from("source_items").update({ status: "failed" }).eq("id", item.id);
      results.push({ item: item.id, error: e?.message ?? String(e), latency_ms: Date.now() - started });
    }
  }

  return { ok: true, produced: results.length, results };
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
  if (!expectedToken) {
    return new Response(JSON.stringify({ error: "CRON_TOKEN not configured" }), { status: 503, headers: { "content-type": "application/json" } });
  }
  const token = request.headers.get("x-cron-token");
  if (!token || token !== expectedToken) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  }
  try {
    const result = await runTick(reason);
    return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
