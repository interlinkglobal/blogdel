import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const SITE = "https://blogdel.blog";
const STATIC_PATHS = ["/", "/blogs", "/about", "/disclosure", "/contact", "/privacy-policy"];

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

async function sitemapResponse(): Promise<Response> {
  const paths = [...STATIC_PATHS];
  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (supabaseUrl && publishableKey) {
    try {
      const supabase = createClient(supabaseUrl, publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase.from("articles")
          .select("slug,published_at")
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        for (const article of data ?? []) {
          if (typeof article.slug === "string" && /^[a-z0-9-]{1,120}$/.test(article.slug)) {
            paths.push(`/blogs/${article.slug}`);
          }
        }
        if (!data || data.length < pageSize) break;
        offset += pageSize;
      }
    } catch (error) {
      console.error("Blogdel sitemap could not load published article URLs", error);
    }
  }

  const uniquePaths = [...new Set(paths)];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${uniquePaths.map((path) => `  <url><loc>${xmlEscape(SITE + path)}</loc></url>`).join("\n")}\n</urlset>\n`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => sitemapResponse(),
    },
  },
});
