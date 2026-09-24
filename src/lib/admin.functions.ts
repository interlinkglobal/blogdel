// Admin reads and writes. Uses requireSupabaseAuth so RLS applies as the signed-in staff user.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import slugify from "slugify";
import { articleOutputSchema, sourceInputSchema, REFERENCE_MINIMA } from "./article-schema";

async function getRole(supabase: any, userId: string): Promise<"admin"|"editor"|"viewer"|null> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!data || data.length === 0) return null;
  const roles = data.map((r: any) => r.role);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("editor")) return "editor";
  if (roles.includes("viewer")) return "viewer";
  return null;
}

export const getMyRole = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  return { role: await getRole(context.supabase, context.userId) };
});

export const getOverview = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const sb = context.supabase;
  const [{ data: sys }, { data: articles }, { data: jobs }, { data: events }] = await Promise.all([
    sb.from("system_state").select("*").maybeSingle(),
    sb.from("articles").select("id,status,category_id,published_at,is_demo"),
    sb.from("delegation_jobs").select("id,status,provider,model,created_at,failure_reason,category_id"),
    sb.from("provider_events").select("id,provider,event_type,created_at,status_code").order("created_at",{ ascending: false }).limit(20),
  ]);
  const today = new Date(); today.setHours(0,0,0,0);
  const publishedToday = (articles ?? []).filter(a => a.status === "published" && a.published_at && new Date(a.published_at) >= today).length;
  const counts = {
    queued: (jobs ?? []).filter(j=>j.status==="queued").length,
    running: (jobs ?? []).filter(j=>j.status==="running").length,
    failed: (jobs ?? []).filter(j=>j.status==="failed").length,
    completed: (jobs ?? []).filter(j=>j.status==="completed").length,
  };
  const articleCounts: Record<string, number> = {};
  for (const a of articles ?? []) articleCounts[a.status] = (articleCounts[a.status] ?? 0) + 1;
  return { system: sys, publishedToday, target: sys?.daily_target ?? 20, counts, articleCounts, recentEvents: events ?? [] };
});

export const listAllSources = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data } = await context.supabase.from("sources").select("*,categories(slug,label)").order("priority",{ ascending: false });
  return data ?? [];
});

export const getSource = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d: {id: string}) => d).handler(async ({ context, data }) => {
  const { data: source } = await context.supabase.from("sources").select("*,categories(slug,label)").eq("id", data.id).maybeSingle();
  const { data: items } = await context.supabase.from("source_items").select("*").eq("source_id", data.id).order("created_at",{ ascending: false }).limit(20);
  return { source, items: items ?? [] };
});

export const updateSource = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) =>
  z.object({
    id: z.string().uuid(),
    is_enabled: z.boolean().optional(),
    priority: z.number().int().min(0).max(10).optional(),
    prompt_template: z.string().max(2000).optional(),
    rights_notes: z.string().max(1000).optional(),
    configuration: z.record(z.any()).optional(),
  }).parse(d)
).handler(async ({ context, data }) => {
  const role = await getRole(context.supabase, context.userId);
  if (role !== "admin") throw new Error("Forbidden");
  const { id, ...patch } = data;
  const { error } = await context.supabase.from("sources").update(patch).eq("id", id);
  if (error) throw error;
  return { ok: true };
});

export const listJobs = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d: { status?: string }) => d).handler(async ({ context, data }) => {
  let q = context.supabase.from("delegation_jobs").select("*,categories(slug,label),authors(display_name,slug)").order("created_at",{ ascending: false }).limit(100);
  if (data.status) q = q.eq("status", data.status as never);
  const { data: rows } = await q;
  return rows ?? [];
});

export const getJob = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d: { id: string }) => d).handler(async ({ context, data }) => {
  const [{ data: job }, { data: events }] = await Promise.all([
    context.supabase.from("delegation_jobs").select("*,categories(slug,label),authors(display_name,slug),source_items(*)").eq("id", data.id).maybeSingle(),
    context.supabase.from("provider_events").select("*").eq("job_id", data.id).order("created_at"),
  ]);
  return { job, events: events ?? [] };
});

function stripArt<T extends Record<string, any>>(row: T) { const { search_tsv, ...rest } = row as any; return rest; }

export const listAllArticles = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d: { status?: string; q?: string }) => d).handler(async ({ context, data }) => {
  let q = context.supabase.from("articles").select("*,categories(slug,label),authors(display_name,slug)").order("created_at",{ ascending: false }).limit(200);
  if (data.status) q = q.eq("status", data.status as never);
  if (data.q && data.q.trim()) {
    const tsq = data.q.trim().split(/\s+/).map(t=>t.replace(/[^a-z0-9]/gi,"")).filter(Boolean).join(" & ");
    if (tsq) q = q.textSearch("search_tsv", tsq, { config: "english" });
  }
  const { data: rows } = await q;
  return (rows ?? []).map(stripArt);
});

export const getArticleAdmin = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d: { id: string }) => d).handler(async ({ context, data }) => {
  const [{ data: article }, { data: refs }, { data: versions }] = await Promise.all([
    context.supabase.from("articles").select("*,categories(slug,label),authors(display_name,slug),delegation_jobs(id,provider,model,status)").eq("id", data.id).maybeSingle(),
    context.supabase.from("article_references").select("*").eq("article_id", data.id).order("position"),
    context.supabase.from("article_versions").select("*").eq("article_id", data.id).order("version_number",{ ascending: false }).limit(20),
  ]);
  return { article: article ? stripArt(article) : null, refs: refs ?? [], versions: versions ?? [] };
});

export const updateArticleStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) =>
  z.object({ id: z.string().uuid(), status: z.enum(["draft","review","scheduled","published","archived","failed"]) }).parse(d)
).handler(async ({ context, data }) => {
  const role = await getRole(context.supabase, context.userId);
  if (role !== "admin" && role !== "editor") throw new Error("Forbidden");
  const patch: any = { status: data.status };
  if (data.status === "published") patch.published_at = new Date().toISOString();
  if (data.status === "archived") patch.archived_at = new Date().toISOString();
  const { error } = await context.supabase.from("articles").update(patch).eq("id", data.id);
  if (error) throw error;
  return { ok: true };
});

export const updateArticleContent = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) =>
  z.object({
    id: z.string().uuid(),
    title: z.string().min(8).max(160).optional(),
    description: z.string().min(30).max(320).optional(),
    body_markdown: z.string().min(200).optional(),
    change_reason: z.string().max(300).optional(),
  }).parse(d)
).handler(async ({ context, data }) => {
  const role = await getRole(context.supabase, context.userId);
  if (role !== "admin" && role !== "editor") throw new Error("Forbidden");
  const { data: current } = await context.supabase.from("articles").select("*").eq("id", data.id).maybeSingle();
  if (!current) throw new Error("Not found");
  const { data: last } = await context.supabase.from("article_versions").select("version_number").eq("article_id", data.id).order("version_number",{ ascending: false }).limit(1);
  const nextVersion = (last?.[0]?.version_number ?? 0) + 1;
  await context.supabase.from("article_versions").insert({
    article_id: data.id,
    version_number: nextVersion,
    title: current.title, description: current.description, body_markdown: current.body_markdown,
    change_reason: data.change_reason ?? "Manual edit",
    provider: current.provider, model: current.model,
  });
  const patch: any = {};
  if (data.title) patch.title = data.title;
  if (data.description) patch.description = data.description;
  if (data.body_markdown) {
    patch.body_markdown = data.body_markdown;
    patch.word_count = data.body_markdown.split(/\s+/).filter(Boolean).length;
    patch.reading_time_minutes = Math.max(1, Math.round(patch.word_count / 220));
  }
  const { error } = await context.supabase.from("articles").update(patch).eq("id", data.id);
  if (error) throw error;
  return { ok: true, version: nextVersion };
});

export const updateSystemState = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) =>
  z.object({
    mode: z.enum(["running","publishing_paused","generation_paused","fully_paused"]).optional(),
    morning_hour: z.number().int().min(0).max(23).optional(),
    afternoon_hour: z.number().int().min(0).max(23).optional(),
    night_hour: z.number().int().min(0).max(23).optional(),
    daily_target: z.number().int().min(1).max(200).optional(),
    daily_maximum: z.number().int().min(1).max(500).optional(),
    per_category_max: z.number().int().min(1).max(50).optional(),
    min_body_length: z.number().int().min(200).max(5000).optional(),
    primary_provider: z.string().max(50).optional(),
  }).parse(d)
).handler(async ({ context, data }) => {
  const role = await getRole(context.supabase, context.userId);
  if (role !== "admin") throw new Error("Forbidden");
  const { error } = await context.supabase.from("system_state").update(data).eq("id", 1);
  if (error) throw error;
  return { ok: true };
});

export const listAuthorsAdmin = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data } = await context.supabase.from("authors").select("*,categories(slug,label)").order("display_name");
  return data ?? [];
});

export const getAuthorAdmin = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d: { id: string }) => d).handler(async ({ context, data }) => {
  const [{ data: author }, { data: articles }] = await Promise.all([
    context.supabase.from("authors").select("*,categories(slug,label)").eq("id", data.id).maybeSingle(),
    context.supabase.from("articles").select("id,slug,title,status,published_at").eq("author_id", data.id).order("created_at",{ ascending: false }).limit(30),
  ]);
  return { author, articles: articles ?? [] };
});

export const updateAuthor = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) =>
  z.object({
    id: z.string().uuid(),
    is_active: z.boolean().optional(),
    rotation_weight: z.number().int().min(0).max(10).optional(),
    description: z.string().max(500).optional(),
    display_name: z.string().min(2).max(80).optional(),
  }).parse(d)
).handler(async ({ context, data }) => {
  const role = await getRole(context.supabase, context.userId);
  if (role !== "admin") throw new Error("Forbidden");
  const { id, ...patch } = data;
  const { error } = await context.supabase.from("authors").update(patch).eq("id", id);
  if (error) throw error;
  return { ok: true };
});

export const dbStats = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const tables = ["categories","authors","sources","source_items","delegation_jobs","articles","article_references","article_versions","provider_events"];
  const counts: Record<string, number> = {};
  for (const t of tables) {
    const { count } = await context.supabase.from(t as never).select("*", { count: "exact", head: true });
    counts[t] = count ?? 0;
  }
  const { data: stuck } = await context.supabase.from("delegation_jobs").select("id,started_at,status").eq("status","running").lt("started_at", new Date(Date.now()-30*60*1000).toISOString());
  return { counts, stuck: stuck ?? [] };
});

// Manual trigger — writes a source_item + queued job, then runs generation.
export const manualGenerate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) =>
  z.object({
    category: z.string(),
    prompt: z.string().min(20).max(2000),
    article_type: z.enum(["news","analysis","explainer","list","profile","history","guide"]).default("explainer"),
    references: z.array(z.object({
      title: z.string().min(1).max(300),
      url: z.string().url(),
      authority: z.enum(["primary","secondary","tertiary"]).default("primary"),
    })).min(1).max(5).optional(),
    reference_url: z.string().url().optional(),
    reference_title: z.string().optional(),
    dry_run: z.boolean().optional(),
  }).parse(d)
).handler(async ({ context, data }) => {
  const role = await getRole(context.supabase, context.userId);
  if (role !== "admin" && role !== "editor") throw new Error("Forbidden");
  const { data: cat } = await context.supabase.from("categories").select("id,slug,label").eq("slug", data.category).maybeSingle();
  if (!cat) throw new Error("Unknown category");
  const refs = data.references?.map((ref) => ({ provider: "manual", ...ref })) ?? (data.reference_url ? [{
    provider: "manual",
    title: data.reference_title ?? "Manual reference",
    url: data.reference_url,
    authority: "primary" as const,
  }] : []);
  const minRefs = REFERENCE_MINIMA[cat.slug] ?? 1;
  if (refs.length < minRefs) throw new Error(`Category ${cat.slug} requires at least ${minRefs} reference(s).`);
  const input = sourceInputSchema.parse({
    category: cat.slug,
    source_type: "evergreen",
    source_id: "manual",
    prompt: data.prompt,
    context: {},
    references: refs,
    instructions: {
      article_type: data.article_type, tone: "clear", target_length: 900,
      audience: "general", freshness: "current", avoid: [],
    },
  });
  if (data.dry_run) return { ok: true, dry: true, input };

  // Pick a source_id (evergreen source for that category) and an author.
  const [{ data: src }, { data: author }] = await Promise.all([
    context.supabase.from("sources").select("id").eq("category_id", cat.id).eq("source_type","evergreen").maybeSingle(),
    context.supabase.from("authors").select("id,display_name").eq("category_id", cat.id).eq("is_active",true).order("last_used_at",{ ascending: true, nullsFirst: true }).limit(1).maybeSingle(),
  ]);
  if (!author) throw new Error("No active author for category");
  if (!src) throw new Error("No evergreen source configured for this category");

  const { data: sourceItem, error: siErr } = await context.supabase.from("source_items").insert({
    source_id: src.id, category_id: cat.id,
    external_id: "manual-" + Date.now().toString(36),
    prompt: input.prompt, refs: input.references as any, instructions: input.instructions as any,
    content_hash: null, status: "queued",
  }).select().single();
  if (siErr) throw siErr;

  const { data: job, error: jErr } = await context.supabase.from("delegation_jobs").insert({
    source_item_id: sourceItem.id, author_id: author.id, category_id: cat.id,
    job_type: "draft", provider: "groq", model: "openai/gpt-oss-20b",
    input_payload: input as any, status: "running", attempt_count: 1, started_at: new Date().toISOString(),
  }).select().single();
  if (jErr) throw jErr;

  // Run generation on the server.
  const { runGeneration } = await import("./generation.server");
  const started = Date.now();
  const onProviderEvent = async (ev: any) => {
    try {
      await context.supabase.from("provider_events").insert({
        job_id: job.id, provider: ev.provider, model: ev.model ?? null,
        event_type: ev.event_type, error_code: ev.error_code ?? null,
        status_code: ev.status_code ?? null, latency_ms: ev.latency_ms,
        metadata: ev.message ? ({ message: ev.message } as any) : ({} as any),
      });
    } catch { /* diagnostics must never interrupt the fallback chain */ }
  };
  try {
    const article = await runGeneration({ input, categorySlug: cat.slug, onProviderEvent });
    const { acquireFeaturedImage } = await import("./image-acquisition.server");
    const image = await acquireFeaturedImage({ title: article.title, keywords: article.keywords, references: article.references });
    const insertRes = await context.supabase.from("articles").insert({
      source_item_id: sourceItem.id, category_id: cat.id, author_id: author.id, generation_job_id: job.id,
      slug: article.slug + "-" + Math.random().toString(36).slice(2,6),
      title: article.title, description: article.description, body_markdown: article.body_markdown,
      article_type: article.article_type, language: article.language, status: "review",
      word_count: article.body_markdown.split(/\s+/).filter(Boolean).length,
      reading_time_minutes: Math.max(1, Math.round(article.body_markdown.split(/\s+/).filter(Boolean).length / 220)),
      keywords: article.keywords, provider: article.__provider, model: article.__model, is_demo: false,
      featured_image_url: image?.url ?? null, featured_image_alt: image?.alt ?? article.title,
    }).select().single();
    if (insertRes.error) throw insertRes.error;
    // Insert refs
    if (article.references?.length) {
      await context.supabase.from("article_references").insert(article.references.map((r, i) => ({
        article_id: insertRes.data.id, provider: r.provider, title: r.title, url: r.url, authority: r.authority, position: i,
      })));
    }
    await context.supabase.from("delegation_jobs").update({
      status: "completed", completed_at: new Date().toISOString(), output_payload: article as any,
    }).eq("id", job.id);
    await context.supabase.from("source_items").update({ status: "processed" }).eq("id", sourceItem.id);
    await context.supabase.from("authors").update({ last_used_at: new Date().toISOString(), article_count: (author as any).article_count ? undefined : undefined }).eq("id", author.id);
    return { ok: true, article_id: insertRes.data.id, provider: article.__provider, model: article.__model };
  } catch (e: any) {
    // Per-provider diagnostics have already been written via onProviderEvent.
    // Avoid a misleading synthetic "groq schema_failed" event when the pipeline
    // as a whole fails after multiple providers were attempted.
    await context.supabase.from("delegation_jobs").update({
      status: "failed", completed_at: new Date().toISOString(),
      failure_reason: (e?.message ?? String(e)).slice(0, 800),
    }).eq("id", job.id);
    await context.supabase.from("source_items").update({ status: "failed" }).eq("id", sourceItem.id);
    throw e;
  }
});

export const retryJob = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) =>
  z.object({ id: z.string().uuid() }).parse(d)
).handler(async ({ context, data }) => {
  const role = await getRole(context.supabase, context.userId);
  if (role !== "admin" && role !== "editor") throw new Error("Forbidden");
  const { error } = await context.supabase.from("delegation_jobs").update({
    status: "queued", failure_reason: null, scheduled_at: new Date().toISOString(),
  }).eq("id", data.id);
  if (error) throw error;
  return { ok: true };
});

export const sourceItemsList = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data } = await context.supabase.from("source_items").select("*,sources(name,slug),categories(slug,label)").order("created_at",{ ascending: false }).limit(50);
  return data ?? [];
});
