import { createFileRoute, useRouter, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { getArticleBySlug } from "@/lib/public.functions";
import { SiteShell } from "@/components/blogdel/SiteShell";
import { ArticleCard, type ArticleCardData } from "@/components/blogdel/ArticleCard";
import { formatDate, readingMinutes } from "@/lib/blogdel";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { getArticleFallbackImage } from "@/lib/fallback-images";
import { EditorialImage } from "@/components/blogdel/EditorialImage";

const opts = (slug: string) => queryOptions({
  queryKey: ["article", slug],
  queryFn: () => getArticleBySlug({ data: { slug } }),
});

export const Route = createFileRoute("/blogs/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(opts(params.slug));
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const a: any = loaderData?.article;
    if (!a) return { meta: [{ title: "Article — Blogdel" }] };
    return {
      meta: [
        { title: `${a.title} | Blogdel` },
        { name: "description", content: a.description ?? "" },
        { property: "og:title", content: a.title },
        { property: "og:description", content: a.description ?? "" },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(() => {
          const image = a.featured_image_url || getArticleFallbackImage(a.categories?.slug, a.slug);
          return image ? [{ property: "og:image", content: image }, { name: "twitter:image", content: image }] : [];
        })(),
      ],
    };
  },
  errorComponent: ({ error, reset }) => {
    const r = useRouter();
    return <SiteShell><div className="text-center py-16"><p className="text-red-600">{error.message}</p><button className="mt-4 border border-foreground px-3 py-1 text-sm" onClick={() => { r.invalidate(); reset(); }}>Retry</button></div></SiteShell>;
  },
  notFoundComponent: () => <SiteShell><div className="text-center py-24"><h1 className="headline text-3xl">Article not found</h1><Link to="/blogs" className="text-accent-ink text-sm mt-4 inline-block">Back to all articles</Link></div></SiteShell>,
  component: BlogDetail,
});

function BlogDetail() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(opts(slug));
  if (!data) return null;
  const { article, refs, related } = data as any;

  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl">
        <div className="mb-2">
          {article.categories && (
            <Link to="/blogs" search={{ category: article.categories.slug } as any} className="eyebrow">{article.categories.label}</Link>
          )}
        </div>
        <h1 className="headline text-4xl md:text-5xl">{article.title}</h1>
        <p className="mt-4 text-xl text-muted-foreground font-serif leading-snug">{article.description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          {article.authors && <Link to="/authors/$slug" params={{ slug: article.authors.slug }} className="hover:text-foreground">By {article.authors.display_name}</Link>}
          <span>·</span>
          <span>{formatDate(article.published_at)}</span>
          <span>·</span>
          <span>{article.reading_time_minutes ?? readingMinutes(article.word_count ?? 700)} min read</span>
          <span>·</span>
          <span>{article.article_type}</span>
          {article.is_demo && <Badge variant="outline" className="ml-2">Demo article</Badge>}
        </div>

        <figure className="mt-8 overflow-hidden border border-border">
          <EditorialImage
            src={article.featured_image_url}
            categorySlug={article.categories?.slug}
            articleKey={article.slug}
            alt={article.featured_image_alt || article.title}
            className="aspect-[16/9] w-full object-cover"
          />
        </figure>

        <div className="prose-article mt-10">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}
            components={{
              h1: ({node, ...p}) => <h2 className="headline text-3xl mt-10 mb-3" {...p} />,
              h2: ({node, ...p}) => <h2 className="headline text-2xl mt-10 mb-3" {...p} />,
              h3: ({node, ...p}) => <h3 className="headline text-xl mt-8 mb-2" {...p} />,
              p: ({node, ...p}) => <p className="mb-5" {...p} />,
              a: ({node, ...p}) => <a className="text-accent-ink underline" target="_blank" rel="noreferrer" {...p} />,
              blockquote: ({node, ...p}) => <blockquote className="border-l-4 border-accent-ink pl-4 italic text-muted-foreground" {...p} />,
              ul: ({node, ...p}) => <ul className="list-disc pl-6 mb-5 space-y-1" {...p} />,
              ol: ({node, ...p}) => <ol className="list-decimal pl-6 mb-5 space-y-1" {...p} />,
              code: ({node, ...p}) => <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono" {...p} />,
            }}
          >{article.body_markdown}</ReactMarkdown>
        </div>

        <section className="mt-14 border-t border-border pt-6">
          <h3 className="eyebrow">References</h3>
          {(refs?.length ?? 0) === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No references on record.</p>
          ) : (
            <ol className="mt-3 space-y-2 text-sm">
              {refs.map((r: any) => (
                <li key={r.id}>
                  <a href={r.url} target="_blank" rel="noreferrer" className="text-accent-ink underline">{r.title}</a>
                  <span className="text-muted-foreground"> — {r.provider} · {r.authority}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {article.keywords?.length ? (
          <section className="mt-8">
            <h3 className="eyebrow">Topics</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {article.keywords.map((k: string) => <Badge key={k} variant="secondary">{k}</Badge>)}
            </div>
          </section>
        ) : null}

        <Alert className="mt-10 border-l-4 border-l-accent-ink">
          <Info className="h-4 w-4" />
          <AlertTitle>AI disclosure</AlertTitle>
          <AlertDescription>
            This article was drafted by <span className="font-mono text-xs">{article.model ?? "an AI model"}</span> via <span className="font-mono text-xs">{article.provider ?? "provider"}</span> from the sources listed above. Read with a critical eye. <Link to="/disclosure" className="underline">Read the full AI disclosure</Link>.
          </AlertDescription>
        </Alert>
      </article>

      {related?.length ? (
        <section className="mt-16">
          <div className="border-b-2 border-foreground pb-2 mb-4"><h2 className="eyebrow">More from this desk</h2></div>
          <div className="grid gap-6 md:grid-cols-2">
            {(related as ArticleCardData[]).map(r => <ArticleCard key={r.id} a={r} />)}
          </div>
        </section>
      ) : null}
    </SiteShell>
  );
}
