import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listArticles } from "@/lib/public.functions";
import { SiteShell } from "@/components/blogdel/SiteShell";
import { ArticleCard, type ArticleCardData } from "@/components/blogdel/ArticleCard";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  q: z.string().optional(),
  category: z.string().optional(),
  type: z.string().optional(),
});

const opts = (input: any) => queryOptions({
  queryKey: ["blogs", input],
  queryFn: () => listArticles({ data: input }),
  staleTime: 0,
  refetchOnMount: "always" as const,
});

export const Route = createFileRoute("/blogs/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(opts(deps)),
  head: () => ({ meta: [{ title: "All articles — Blogdel" }, { name: "description", content: "Every article Blogdel has published, across all ten editorial desks." }] }),
  errorComponent: ({ error, reset }) => {
    const r = useRouter();
    return <SiteShell><div className="py-16 text-center"><p className="text-red-600">{error.message}</p><button className="mt-4 border border-foreground px-3 py-1 text-sm" onClick={() => { r.invalidate(); reset(); }}>Retry</button></div></SiteShell>;
  },
  notFoundComponent: () => <SiteShell>Not found</SiteShell>,
  component: BlogsIndex,
});

function BlogsIndex() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data } = useSuspenseQuery(opts(search));
  const [q, setQ] = useState(search.q ?? "");
  const totalPages = Math.max(1, Math.ceil(data.count / data.perPage));

  return (
    <SiteShell>
      <div className="mb-7 border-b border-border pb-6">
        <div className="eyebrow">Archive</div>
        <h1 className="headline mt-1 text-4xl">All articles</h1>
        <p className="mt-2 text-sm text-muted-foreground">{data.count} published across all desks.</p>
      </div>

      <form className="mb-7 flex gap-2" onSubmit={(e) => { e.preventDefault(); navigate({ search: (prev: any) => ({ ...prev, q: q || undefined, page: 1 }) }); }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, keywords…" className="max-w-md rounded-none" />
        <Button type="submit" variant="default" className="rounded-none">Search</Button>
        {(search.q || search.category || search.type) && (
          <Button type="button" variant="ghost" onClick={() => { setQ(""); navigate({ search: {} as any }); }}>Clear</Button>
        )}
      </form>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {(data.rows as unknown as ArticleCardData[]).map(a => (
          <ArticleCard key={a.id} a={a} />
        ))}
      </div>
      {data.rows.length === 0 && <p className="py-16 text-center text-muted-foreground">No matches.</p>}

      {totalPages > 1 && (
        <nav className="mt-10 flex flex-wrap items-center justify-center gap-2 text-sm" aria-label="Article pagination">
          {data.page > 1 && (
            <>
              <Link to="/blogs" search={{ ...search, page: 1 } as any}
                className="border border-border px-3 py-1 hover:bg-muted">First</Link>
              <Link to="/blogs" search={{ ...search, page: data.page - 1 } as any}
                className="border border-border px-3 py-1 hover:bg-muted">Previous</Link>
            </>
          )}
          <span className="px-2 text-muted-foreground">Page {data.page} of {totalPages}</span>
          {data.page < totalPages && (
            <>
              <Link to="/blogs" search={{ ...search, page: data.page + 1 } as any}
                className="border border-border px-3 py-1 hover:bg-muted">Next</Link>
              <Link to="/blogs" search={{ ...search, page: totalPages } as any}
                className="border border-border px-3 py-1 hover:bg-muted">Last</Link>
            </>
          )}
        </nav>
      )}
    </SiteShell>
  );
}
