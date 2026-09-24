import { createFileRoute, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { searchArticles } from "@/lib/public.functions";
import { SiteShell } from "@/components/blogdel/SiteShell";
import { ArticleCard, type ArticleCardData } from "@/components/blogdel/ArticleCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { useState } from "react";

const searchSchema = z.object({ q: z.string().optional().default(""), category: z.string().optional() });

const opts = (q: string, cat?: string) => queryOptions({
  queryKey: ["search", q, cat],
  queryFn: () => searchArticles({ data: { q, category: cat } }),
  staleTime: 0,
  refetchOnMount: "always" as const,
});

export const Route = createFileRoute("/search")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(opts(deps.q ?? "", deps.category)),
  head: () => ({ meta: [{ title: "Search — Blogdel" }] }),
  errorComponent: ({ error, reset }) => {
    const r = useRouter();
    return <SiteShell><div className="py-16 text-center"><p className="text-red-600">{error.message}</p><button className="mt-4 border border-foreground px-3 py-1 text-sm" onClick={() => { r.invalidate(); reset(); }}>Retry</button></div></SiteShell>;
  },
  notFoundComponent: () => <SiteShell>Not found</SiteShell>,
  component: SearchPage,
});

function SearchPage() {
  const s = Route.useSearch();
  const nav = Route.useNavigate();
  const [q, setQ] = useState(s.q ?? "");
  const { data } = useSuspenseQuery(opts(s.q ?? "", s.category));

  return (
    <SiteShell>
      <div className="mb-6">
        <div className="eyebrow">Search</div>
        <h1 className="headline mt-1 text-4xl">Find articles</h1>
      </div>

      <form className="mb-7 flex gap-2" onSubmit={(e) => { e.preventDefault(); nav({ search: { q, category: s.category } }); }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Titles, keywords, topics…" className="max-w-md" />
        <Button type="submit">Search</Button>
      </form>

      {s.q && <p className="mb-4 text-sm text-muted-foreground">{data.rows.length} results for “{s.q}”.</p>}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {(data.rows as ArticleCardData[]).map((a) => (
          <ArticleCard key={a.id} a={a} />
        ))}
      </div>
      {s.q && data.rows.length === 0 && <p className="py-16 text-center text-muted-foreground">No matches.</p>}
    </SiteShell>
  );
}
