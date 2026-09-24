import { createFileRoute, useRouter } from "@tanstack/react-router";
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
      { name: "description", content: "Autonomous reporting, analysis and explainers from Interlink Media." },
      { property: "og:title", content: "Blogdel — Autonomous editorial publication" },
      { property: "og:description", content: "Autonomous reporting, analysis and explainers from Interlink Media." },
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
      {articles.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-muted-foreground">No articles have been published yet.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {articles.slice(0, 24).map((a) => (
            <ArticleCard key={a.id} a={a} />
          ))}
        </div>
      )}
    </SiteShell>
  );
}
