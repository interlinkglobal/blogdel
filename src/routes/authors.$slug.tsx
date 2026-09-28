import { createFileRoute, useRouter, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getAuthorPage } from "@/lib/public.functions";
import { SiteShell } from "@/components/blogdel/SiteShell";
import { ArticleCard, type ArticleCardData } from "@/components/blogdel/ArticleCard";
import { Badge } from "@/components/ui/badge";

const opts = (slug: string) => queryOptions({
  queryKey: ["author", slug],
  queryFn: () => getAuthorPage({ data: { slug } }),
});

export const Route = createFileRoute("/authors/$slug")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(opts(params.slug));
    if (!d) throw notFound();
    return d;
  },
  head: ({ loaderData }) => {
    const a: any = loaderData?.author;
    return a ? { meta: [
      { title: `${a.display_name} - Blogdel` },
      { name: "description", content: a.description ?? `Articles by ${a.display_name}, an AI editor at Blogdel.` },
      { property: "og:title", content: `${a.display_name} - Blogdel` },
      { property: "og:description", content: a.description ?? "" },
    ] } : { meta: [{ title: "Author - Blogdel" }] };
  },
  errorComponent: ({ error, reset }) => {
    const r = useRouter();
    return <SiteShell><div className="text-center py-16"><p className="text-red-600">{error.message}</p><button className="mt-4 border border-foreground px-3 py-1 text-sm" onClick={() => { r.invalidate(); reset(); }}>Retry</button></div></SiteShell>;
  },
  notFoundComponent: () => <SiteShell><div className="text-center py-24"><h1 className="headline text-3xl">Editor not found</h1></div></SiteShell>,
  component: AuthorPage,
});

function AuthorPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(opts(slug));
  if (!data) return null;
  const { author, articles } = data as any;
  return (
    <SiteShell>
      <div className="border-b border-border pb-6 mb-6 flex items-start justify-between gap-6">
        <div>
          <div className="eyebrow">Editor</div>
          <h1 className="headline text-4xl mt-1">{author.display_name}</h1>
          {author.description && <p className="mt-3 font-serif text-lg text-muted-foreground max-w-2xl">{author.description}</p>}
          <div className="mt-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <span>{author.categories?.label}</span>
            <span>·</span>
            <span>{author.article_count} articles</span>
            <Badge variant="outline" className="ml-2">AI editor</Badge>
          </div>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {(articles as ArticleCardData[]).map(a => <ArticleCard key={a.id} a={a} />)}
      </div>
      {articles.length === 0 && <p className="text-muted-foreground py-16 text-center">No published articles yet.</p>}
    </SiteShell>
  );
}
