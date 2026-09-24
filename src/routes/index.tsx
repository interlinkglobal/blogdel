import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { getHomepage } from "@/lib/public.functions";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/blogdel/SiteShell";
import { ArticleCard, type ArticleCardData } from "@/components/blogdel/ArticleCard";

const homeOpts = queryOptions({
  queryKey: ["home"],
  queryFn: () => getHomepage(),
  staleTime: 0,
  refetchOnMount: "always" as const,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Blogdel — Autonomous editorial publication" },
      { name: "description", content: "Ten desks. Disclosed models. Every article generated from named sources and validated against a strict schema." },
      { property: "og:title", content: "Blogdel — Autonomous editorial publication" },
      { property: "og:description", content: "Ten desks. Disclosed models. Every article generated from named sources and validated against a strict schema." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeOpts),
  errorComponent: ({ error, reset }) => {
    const r = useRouter();
    return <SiteShell><div className="py-16 text-center"><p className="text-red-600">{error.message}</p><button className="mt-4 border border-foreground px-3 py-1 text-sm" onClick={() => { r.invalidate(); reset(); }}>Retry</button></div></SiteShell>;
  },
  notFoundComponent: () => <SiteShell><p>Not found</p></SiteShell>,
  component: Home,
});

function Home() {
  const { data } = useSuspenseQuery(homeOpts);
  const articles = data.articles as unknown as ArticleCardData[];

  return (
    <SiteShell>
      <section className="mb-8 flex flex-col gap-4 border-b border-border pb-7 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="eyebrow">Latest publication</div>
          <h1 className="headline mt-2 text-4xl md:text-5xl">Stories from across the desks</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            New reporting, analysis and explainers appear here as soon as they are published.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.categories.slice(0, 6).map(c => (
            <Link
              key={c.id}
              to="/category/$slug"
              params={{ slug: c.slug }}
              className="border border-border bg-card px-3 py-2 text-xs hover:border-foreground"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </section>

      {articles.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-muted-foreground">No articles have been published yet.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-px border border-border bg-border md:grid-cols-2 xl:grid-cols-3">
            {articles.slice(0, 12).map((a, i) => (
              <div key={a.id} className="bg-background">
                <ArticleCard a={a} variant={i === 0 ? "lead" : "row"} />
              </div>
            ))}
          </div>

          {articles.length > 12 && (
            <section className="mt-12">
              <div className="mb-5 flex items-center justify-between border-b border-border pb-3">
                <h2 className="headline text-2xl">More from Blogdel</h2>
                <Link to="/blogs" className="text-sm font-medium hover:text-accent-ink">View all articles</Link>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {articles.slice(12, 20).map(a => <ArticleCard key={a.id} a={a} variant="compact" />)}
              </div>
            </section>
          )}
        </>
      )}
    </SiteShell>
  );
}
