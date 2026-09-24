import { Link } from "@tanstack/react-router";
import { formatDate, readingMinutes } from "@/lib/blogdel";
import { Badge } from "@/components/ui/badge";

export interface ArticleCardData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  published_at: string | null;
  reading_time_minutes: number | null;
  word_count?: number | null;
  article_type: string;
  provider: string | null;
  model: string | null;
  featured_image_url?: string | null;
  featured_image_alt?: string | null;
  is_demo?: boolean | null;
  categories?: { slug: string; label: string } | null;
  authors?: { slug: string; display_name: string } | null;
}

const fallback = "/editorial-fallback.svg";

function StoryImage({ a, eager = false }: { a: ArticleCardData; eager?: boolean }) {
  return (
    <img
      src={a.featured_image_url || fallback}
      alt={a.featured_image_alt || a.title}
      loading={eager ? "eager" : "lazy"}
      className="aspect-[16/10] w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
      onError={(e) => {
        const img = e.currentTarget;
        if (!img.src.endsWith(fallback)) img.src = fallback;
      }}
    />
  );
}

export function ArticleCard({ a, variant = "row" }: { a: ArticleCardData; variant?: "row" | "lead" | "compact" }) {
  const cat = a.categories;
  const author = a.authors;
  const minutes = a.reading_time_minutes ?? readingMinutes(a.word_count ?? 700);

  if (variant === "compact") {
    return (
      <article className="group overflow-hidden border border-border bg-card">
        <Link to="/blogs/$slug" params={{ slug: a.slug }} className="block overflow-hidden border-b border-border">
          <StoryImage a={a} />
        </Link>
        <div className="p-4">
          {cat && (
            <Link to="/category/$slug" params={{ slug: cat.slug }} className="eyebrow">
              {cat.label}
            </Link>
          )}
          <Link to="/blogs/$slug" params={{ slug: a.slug }} className="mt-2 block">
            <h3 className="headline text-xl leading-tight transition-colors group-hover:text-accent-ink">{a.title}</h3>
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            {author && <span>{author.display_name}</span>}
            {author && <span>·</span>}
            <span>{formatDate(a.published_at)}</span>
            <span>·</span>
            <span>{minutes} min read</span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex h-full flex-col overflow-hidden border border-border bg-card">
      <Link to="/blogs/$slug" params={{ slug: a.slug }} className="block overflow-hidden border-b border-border">
        <StoryImage a={a} eager={variant === "lead"} />
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3">
          {cat ? (
            <Link to="/category/$slug" params={{ slug: cat.slug }} className="eyebrow">
              {cat.label}
            </Link>
          ) : (
            <span className="eyebrow">{a.article_type}</span>
          )}
          {a.is_demo && <Badge variant="outline">Demo</Badge>}
        </div>

        <Link to="/blogs/$slug" params={{ slug: a.slug }} className="mt-3 block">
          <h2 className={variant === "lead" ? "headline text-3xl leading-tight md:text-4xl" : "headline text-2xl leading-tight"}>
            {a.title}
          </h2>
        </Link>

        {a.description && (
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
            {a.description}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {author && (
            <Link to="/authors/$slug" params={{ slug: author.slug }} className="hover:text-foreground">
              {author.display_name}
            </Link>
          )}
          {author && <span>·</span>}
          <span>{formatDate(a.published_at)}</span>
          <span>·</span>
          <span>{minutes} min read</span>
        </div>

        <div className="mt-auto pt-5">
          <Link
            to="/blogs/$slug"
            params={{ slug: a.slug }}
            className="inline-flex min-h-10 w-full items-center justify-center border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-transparent hover:text-foreground"
          >
            Read
          </Link>
        </div>
      </div>
    </article>
  );
}
