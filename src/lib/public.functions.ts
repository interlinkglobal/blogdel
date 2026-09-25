// Public reads via the server publishable client (respects RLS as anon).
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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

// Strip non-serializable / heavy columns before returning to the client.
function stripArticle<T extends Record<string, any>>(row: T): Omit<T, "search_tsv"> {
  const { search_tsv, ...rest } = row as any;
  return rest;
}
function stripMany<T extends Record<string, any>>(rows: T[] | null | undefined): Omit<T, "search_tsv">[] {
  return (rows ?? []).map(stripArticle);
}

const REL = "categories(slug,label), authors(slug,display_name)";

export const getHomepage = createServerFn({ method: "GET" }).handler(async () => {
  const { ensureInitialSeed } = await import("./initial-seed.server");
  await ensureInitialSeed();
  const sb = serverPublic();
  const [{ data: categories }, { data: articles }] = await Promise.all([
    sb.from("categories").select("id,slug,label,internal_label,description,sort_order").order("sort_order"),
    sb.from("articles").select(`*, ${REL}`).eq("status", "published").order("published_at", { ascending: false }).limit(60),
  ]);
  return { categories: categories ?? [], articles: stripMany(articles as any) };
});

export const listArticles = createServerFn({ method: "GET" })
  .inputValidator((d: { category?: string; author?: string; type?: string; q?: string; sort?: "newest"|"oldest"|"relevance"; page?: number; perPage?: number }) => d)
  .handler(async ({ data }) => {
    const { ensureInitialSeed } = await import("./initial-seed.server");
    await ensureInitialSeed();
    const sb = serverPublic();
    const perPage = Math.min(48, Math.max(1, data.perPage ?? 12));
    const page = Math.max(1, data.page ?? 1);

    const isBalancedAllFeed =
      !data.category &&
      !data.author &&
      !data.type &&
      !(data.q && data.q.trim()) &&
      (!data.sort || data.sort === "newest");

    if (isBalancedAllFeed) {
      type FeedMeta = {
        id: string;
        category_id: string | null;
        published_at: string | null;
        created_at: string | null;
      };

      const meta: FeedMeta[] = [];
      const batchSize = 1000;
      let offset = 0;
      let total = 0;

      while (true) {
        const { data: chunk, count, error } = await sb.from("articles")
          .select("id,category_id,published_at,created_at", { count: "exact" })
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .order("created_at", { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;
        const rows = (chunk ?? []) as FeedMeta[];
        meta.push(...rows);
        total = count ?? meta.length;

        if (rows.length < batchSize || meta.length >= total) break;
        offset += batchSize;
      }

      const groups = new Map<string, FeedMeta[]>();
      for (const row of meta) {
        const key = row.category_id ?? "uncategorized";
        const group = groups.get(key);
        if (group) group.push(row);
        else groups.set(key, [row]);
      }

      const cursors = new Map<string, number>();
      const ordered: FeedMeta[] = [];
      const timestamp = (row: FeedMeta) =>
        new Date(row.published_at ?? row.created_at ?? 0).getTime();

      while (ordered.length < meta.length) {
        const round: FeedMeta[] = [];
        for (const [key, group] of groups) {
          const cursor = cursors.get(key) ?? 0;
          if (cursor >= group.length) continue;
          round.push(group[cursor]);
          cursors.set(key, cursor + 1);
        }
        if (round.length === 0) break;
        round.sort((a, b) => timestamp(b) - timestamp(a));
        ordered.push(...round);
      }

      const startIndex = (page - 1) * perPage;
      const pageIds = ordered.slice(startIndex, startIndex + perPage).map((row) => row.id);

      if (pageIds.length === 0) {
        return { rows: [] as any[], count: total, page, perPage };
      }

      const { data: pageRows, error: pageError } = await sb.from("articles")
        .select(`*, ${REL}`)
        .in("id", pageIds);

      if (pageError) throw pageError;
      const byId = new Map((pageRows ?? []).map((row: any) => [row.id, row]));
      const rows = pageIds.map((id) => byId.get(id)).filter(Boolean) as any[];
      return { rows: stripMany(rows), count: total, page, perPage };
    }

    let query = sb.from("articles").select(`*, ${REL}`, { count: "exact" }).eq("status","published");
    if (data.category) {
      const { data: cat } = await sb.from("categories").select("id").eq("slug", data.category).maybeSingle();
      if (!cat) return { rows: [] as any[], count: 0, page, perPage };
      query = query.eq("category_id", cat.id);
    }
    if (data.author) {
      const { data: au } = await sb.from("authors").select("id").eq("slug", data.author).maybeSingle();
      if (!au) return { rows: [] as any[], count: 0, page, perPage };
      query = query.eq("author_id", au.id);
    }
    if (data.type) query = query.eq("article_type", data.type as never);
    if (data.q && data.q.trim()) {
      const tsq = data.q.trim().split(/\s+/).map(t=>t.replace(/[^a-z0-9]/gi,"")).filter(Boolean).join(" & ");
      if (tsq) query = query.textSearch("search_tsv", tsq, { config: "english" });
    }
    if (data.sort === "oldest") query = query.order("published_at",{ ascending: true });
    else query = query.order("published_at",{ ascending: false });
    query = query.range((page-1)*perPage, page*perPage - 1);
    const { data: rows, count, error } = await query;
    if (error) throw error;
    return { rows: stripMany(rows as any), count: count ?? 0, page, perPage };
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
    const [{ data: refs }, { data: related }] = await Promise.all([
      sb.from("article_references").select("*").eq("article_id", (article as any).id).order("position"),
      sb.from("articles").select(`id,slug,title,description,published_at,reading_time_minutes,featured_image_url,featured_image_alt,article_type,provider,model, ${REL}`)
        .eq("status","published").eq("category_id", (article as any).category_id).neq("id", (article as any).id)
        .order("published_at",{ ascending: false }).limit(4),
    ]);
    return { article, refs: refs ?? [], related: related ?? [] };
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
    return { category: cat, articles: stripMany(articles as any), count: count ?? 0, page, perPage, authors: authors ?? [] };
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
    return { author, articles: stripMany(articles as any) };
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
