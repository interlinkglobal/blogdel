// Public reads via the server publishable client (respects RLS as anon).
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { thumbnailCandidates, thumbnailTier } from "./thumbnail-policy";

function serverPublic() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function sanitizePublicText<T>(value: T): T {
  if (typeof value === "string") return value.replaceAll("\u2014", "-") as T;
  if (Array.isArray(value)) return value.map((item) => sanitizePublicText(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, any>).map(([key, item]) => [key, sanitizePublicText(item)])) as T;
  }
  return value;
}

// Strip non-serializable / heavy columns and prohibited punctuation before returning to the client.
function stripArticle<T extends Record<string, any>>(row: T): Omit<T, "search_tsv"> {
  const { search_tsv, ...rest } = row as any;
  return sanitizePublicText(rest);
}
function isFallbackImage(url: string | null | undefined) {
  return !!url && (url.startsWith("/fallback-images/") || url === "/editorial-fallback.svg");
}

function stripMany<T extends Record<string, any>>(rows: T[] | null | undefined): Omit<T, "search_tsv">[] {
  const seen = new Set<string>();
  return (rows ?? []).map(stripArticle).map((row: any) => {
    const url = row.featured_image_url as string | null | undefined;
    if (!url || isFallbackImage(url)) return row;
    if (seen.has(url)) return { ...row, featured_image_url: null, featured_image_alt: null };
    seen.add(url);
    return row;
  });
}

// Assign images by category publication rank, rather than by page position or a hash.
// This keeps the first complete rotation unique across pagination and refreshes.
function categoryRanks(rows: { id: string; category_id: string | null }[]) {
  const counts = new Map<string, number>();
  const ranks = new Map<string, number>();
  for (const row of rows) {
    const category = row.category_id ?? "";
    const rank = counts.get(category) ?? 0;
    ranks.set(row.id, rank);
    counts.set(category, rank + 1);
  }
  return ranks;
}

function withPreferredImages<T extends Record<string, any>>(rows: T[], ranks: Map<string, number>): T[] {
  return rows.map((row) => {
    const candidates = thumbnailCandidates(row.categories?.slug, row.slug ?? row.id, ranks.get(row.id) ?? -1, row.featured_image_url);
    return { ...row, featured_image_url: candidates[0] ?? null, featured_image_alt: row.featured_image_alt || row.title, thumbnail_candidates: candidates };
  });
}

function imagesFirst<T extends Record<string, any>>(rows: T[]): T[] {
  return [...rows].sort((a, b) => thumbnailTier(a.featured_image_url) - thumbnailTier(b.featured_image_url));
}

async function ranksForCategory(sb: ReturnType<typeof serverPublic>, categoryId: string | null | undefined) {
  if (!categoryId) return new Map<string, number>();
  const { data, error } = await sb.from("articles").select("id,category_id")
    .eq("status", "published").eq("category_id", categoryId)
    .order("published_at", { ascending: false }).order("created_at", { ascending: false }).limit(1000);
  if (error) throw error;
  return categoryRanks(data ?? []);
}

const REL = "categories(slug,label), authors(slug,display_name)";

export const getHomepage = createServerFn({ method: "GET" }).handler(async () => {
  const { ensureInitialSeed } = await import("./initial-seed.server");
  const { ensureRecipeSeed } = await import("./recipe-library.server");
  await ensureInitialSeed();
  await ensureRecipeSeed();
  const sb = serverPublic();
  const [{ data: categories }, { data: articles }] = await Promise.all([
    sb.from("categories").select("id,slug,label,internal_label,description,sort_order").order("sort_order"),
    sb.from("articles").select(`*, ${REL}`).eq("status", "published").order("published_at", { ascending: false }).order("created_at", { ascending: false }).limit(500),
  ]);

  const groups = new Map<string, any[]>();
  for (const article of articles ?? []) {
    const key = (article as any).category_id ?? "uncategorized";
    const group = groups.get(key);
    if (group) group.push(article);
    else groups.set(key, [article]);
  }
  const cursors = new Map<string, number>();
  const balanced: any[] = [];
  while (balanced.length < 60) {
    const round: any[] = [];
    for (const [key, group] of groups) {
      const cursor = cursors.get(key) ?? 0;
      if (cursor >= group.length) continue;
      round.push(group[cursor]);
      cursors.set(key, cursor + 1);
    }
    if (!round.length) break;
    round.sort((a, b) => new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime());
    balanced.push(...round);
  }

  const featured = withPreferredImages(balanced.map((row) => stripArticle(row)), categoryRanks((articles ?? []) as any));
  return { categories: categories ?? [], articles: imagesFirst(featured).slice(0, 60) };
});

export const listArticles = createServerFn({ method: "GET" })
  .inputValidator((d: { category?: string; subcategory?: string; author?: string; type?: string; q?: string; sort?: "newest"|"oldest"|"relevance"; cursor?: string; perPage?: number }) => d)
  .handler(async ({ data }) => {
    const { ensureInitialSeed } = await import("./initial-seed.server");
    await ensureInitialSeed();
    if (data.category === "food" || data.subcategory === "recipes") {
      const { ensureRecipeSeed } = await import("./recipe-library.server");
      await ensureRecipeSeed();
    }
    const sb = serverPublic();
    const perPage = Math.min(48, Math.max(1, data.perPage ?? 12));

    let categoryId: string | undefined;
    let authorId: string | undefined;

    if (data.category) {
      const { data: cat } = await sb.from("categories").select("id").eq("slug", data.category).maybeSingle();
      if (!cat) return { rows: [] as any[], count: 0, perPage, nextCursor: null as string | null };
      categoryId = cat.id;
    }

    if (data.author) {
      const { data: au } = await sb.from("authors").select("id").eq("slug", data.author).maybeSingle();
      if (!au) return { rows: [] as any[], count: 0, perPage, nextCursor: null as string | null };
      authorId = au.id;
    }

    type FeedMeta = {
      id: string;
      category_id: string | null;
      published_at: string | null;
      created_at: string | null;
      featured_image_url: string | null;
    };

    const meta: FeedMeta[] = [];
    const batchSize = 1000;
    let offset = 0;
    let total = 0;

    while (true) {
      let query = sb.from("articles")
        .select("id,category_id,published_at,created_at,featured_image_url", { count: "exact" })
        .eq("status", "published");

      if (categoryId) query = query.eq("category_id", categoryId);
      if (authorId) query = query.eq("author_id", authorId);
      if (data.type) query = query.eq("article_type", data.type as never);
      if (data.subcategory === "recipes") query = query.contains("keywords", ["food-recipes"]);
      if (data.q?.trim()) query = query.ilike("title", `%${data.q.trim()}%`);

      query = query
        .order("published_at", { ascending: false })
        .order("created_at", { ascending: false })
        .range(offset, offset + batchSize - 1);

      const { data: chunk, count, error } = await query;
      if (error) throw error;

      const rows = (chunk ?? []) as FeedMeta[];
      meta.push(...rows);
      total = count ?? meta.length;

      if (rows.length < batchSize || meta.length >= total) break;
      offset += batchSize;
    }

    const isBalancedAllFeed =
      !data.category &&
      !data.subcategory &&
      !data.author &&
      !data.type &&
      !(data.q && data.q.trim()) &&
      (!data.sort || data.sort === "newest");

    let ordered = meta;

    if (isBalancedAllFeed) {
      const groups = new Map<string, FeedMeta[]>();
      for (const row of meta) {
        const key = row.category_id ?? "uncategorized";
        const group = groups.get(key);
        if (group) group.push(row);
        else groups.set(key, [row]);
      }

      const cursors = new Map<string, number>();
      const mixed: FeedMeta[] = [];
      const timestamp = (row: FeedMeta) => new Date(row.published_at ?? row.created_at ?? 0).getTime();

      while (mixed.length < meta.length) {
        const round: FeedMeta[] = [];
        for (const [key, group] of groups) {
          const cursor = cursors.get(key) ?? 0;
          if (cursor >= group.length) continue;
          round.push(group[cursor]);
          cursors.set(key, cursor + 1);
        }
        if (!round.length) break;
        round.sort((a, b) => timestamp(b) - timestamp(a));
        mixed.push(...round);
      }
      ordered = mixed;
    } else if (data.sort === "oldest") {
      ordered = [...meta].reverse();
    }

    const ranks = categoryRanks(meta);
    const { data: categoryRows, error: categoriesError } = await sb.from("categories").select("id,slug");
    if (categoriesError) throw categoriesError;
    const slugs = new Map((categoryRows ?? []).map((category) => [category.id, category.slug]));
    ordered = imagesFirst(ordered.map((row) => ({
      ...row,
      featured_image_url: thumbnailCandidates(slugs.get(row.category_id ?? ""), row.id, ranks.get(row.id) ?? -1, row.featured_image_url)[0] ?? null,
    })));

    const cursorIndex = data.cursor ? ordered.findIndex((row) => row.id === data.cursor) : -1;
    const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
    const slice = ordered.slice(startIndex, startIndex + perPage);
    const pageIds = slice.map((row) => row.id);

    if (!pageIds.length) {
      return { rows: [] as any[], count: total, perPage, nextCursor: null as string | null };
    }

    const { data: pageRows, error: pageError } = await sb.from("articles")
      .select(`*, ${REL}`)
      .in("id", pageIds);

    if (pageError) throw pageError;

    const byId = new Map((pageRows ?? []).map((row: any) => [row.id, row]));
    const rows = pageIds.map((id) => byId.get(id)).filter(Boolean) as any[];
    const nextCursor = startIndex + pageIds.length < ordered.length ? pageIds[pageIds.length - 1] : null;

    return { rows: withPreferredImages(rows.map((row) => stripArticle(row)), ranks), count: total, perPage, nextCursor };
  });

export const getArticleBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const sb = serverPublic();
    const { data: articleRaw } = await sb.from("articles")
      .select(`*, categories(slug,label), authors(slug,display_name,description)`)
      .eq("slug", data.slug).eq("status","published").maybeSingle();
    if (!articleRaw) return null;
    const article = stripArticle(articleRaw as any);
    const [{ data: refs }, { data: related }, ranks] = await Promise.all([
      sb.from("article_references").select("*").eq("article_id", (article as any).id).order("position"),
      sb.from("articles").select(`id,slug,title,description,published_at,reading_time_minutes,featured_image_url,featured_image_alt,article_type,provider,model, ${REL}`)
        .eq("status","published").eq("category_id", (article as any).category_id).neq("id", (article as any).id)
        .order("published_at",{ ascending: false }).limit(4),
      ranksForCategory(sb, (article as any).category_id),
    ]);
    return { article, refs: sanitizePublicText(refs ?? []), related: withPreferredImages((related ?? []).map((row) => stripArticle(row)), ranks) };
  });

export const getCategoryPage = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string; page?: number }) => d)
  .handler(async ({ data }) => {
    const sb = serverPublic();
    const { data: cat } = await sb.from("categories").select("*").eq("slug", data.slug).maybeSingle();
    if (!cat) return null;
    const perPage = 12;
    const page = Math.max(1, data.page ?? 1);
    const [{ data: articles, count }, { data: authors }] = await Promise.all([
      sb.from("articles").select(`*, ${REL}`, { count: "exact" })
        .eq("category_id", cat.id).eq("status","published").order("published_at",{ ascending: false })
        .range((page-1)*perPage, page*perPage - 1),
      sb.from("authors").select("id,slug,display_name,article_count").eq("category_id", cat.id).eq("is_active",true).order("display_name"),
    ]);
    const ranks = await ranksForCategory(sb, cat.id);
    return { category: cat, articles: withPreferredImages((articles ?? []).map((row) => stripArticle(row)), ranks), count: count ?? 0, page, perPage, authors: authors ?? [] };
  });

export const getAuthorPage = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const sb = serverPublic();
    const { data: author } = await sb.from("authors").select("*,categories(slug,label)").eq("slug", data.slug).maybeSingle();
    if (!author) return null;
    const { data: articles } = await sb.from("articles")
      .select(`*, ${REL}`)
      .eq("author_id", (author as any).id).eq("status","published").order("published_at",{ ascending: false }).limit(30);
    const ranks = await ranksForCategory(sb, (author as any).category_id);
    return { author, articles: withPreferredImages((articles ?? []).map((row) => stripArticle(row)), ranks) };
  });

export const searchArticles = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string; category?: string }) => d)
  .handler(async ({ data }) => {
    const q = (data.q ?? "").trim();
    if (!q) return { rows: [] as any[], q: "" };
    const sb = serverPublic();
    const tsq = q.split(/\s+/).map(t=>t.replace(/[^a-z0-9]/gi,"")).filter(Boolean).join(" & ");
    let query = sb.from("articles").select(`*, ${REL}`).eq("status","published");
    if (tsq) query = query.textSearch("search_tsv", tsq, { config: "english" });
    if (data.category) {
      const { data: cat } = await sb.from("categories").select("id").eq("slug", data.category).maybeSingle();
      if (cat) query = query.eq("category_id", cat.id);
    }
    const { data: rows } = await query.order("published_at",{ ascending: false }).limit(40);
    return { rows: stripMany(rows as any), q };
  });
