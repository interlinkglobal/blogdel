import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { listArticles } from "@/lib/public.functions";
import { SiteShell } from "@/components/blogdel/SiteShell";
import { ArticleCard, type ArticleCardData } from "@/components/blogdel/ArticleCard";
import { LoaderCircle } from "lucide-react";
import { z } from "zod";
import { useEffect, useMemo, useRef } from "react";

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  q: z.string().optional(),
  category: z.string().optional(),
  type: z.string().optional(),
});

export const Route = createFileRoute("/blogs/")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "All articles — Blogdel" }, { name: "description", content: "Every article Blogdel has published, across all ten editorial desks." }] }),
  component: BlogsIndex,
});

function BlogsIndex() {
  const search = Route.useSearch();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const feedInput = useMemo(() => ({
    q: search.q,
    category: search.category,
    type: search.type,
  }), [search.q, search.category, search.type]);

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["blogs-infinite", feedInput],
    queryFn: ({ pageParam }) => listArticles({
      data: {
        ...feedInput,
        cursor: pageParam || undefined,
        perPage: 12,
      },
    }),
    initialPageParam: "",
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: !feedInput.q && !feedInput.category && !feedInput.type ? 5000 : false,
    refetchIntervalInBackground: true,
  });

  const rows = useMemo(() => {
    const seen = new Set<string>();
    const out: ArticleCardData[] = [];
    for (const page of data?.pages ?? []) {
      for (const article of page.rows as unknown as ArticleCardData[]) {
        if (seen.has(article.id)) continue;
        seen.add(article.id);
        out.push(article);
      }
    }
    return out;
  }, [data]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
    }, { rootMargin: "220px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (isLoading) {
    return <SiteShell><div className="flex min-h-48 items-center justify-center"><LoaderCircle className="h-6 w-6 animate-spin" /></div></SiteShell>;
  }

  if (isError) {
    return <SiteShell><div className="py-16 text-center text-sm text-muted-foreground">{error instanceof Error ? error.message : "Unable to load articles."}</div></SiteShell>;
  }

  return (
    <SiteShell>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((a) => <ArticleCard key={a.id} a={a} />)}
      </div>

      {rows.length === 0 && <p className="py-16 text-center text-muted-foreground">No matches.</p>}

      <div ref={loadMoreRef} className="flex h-20 items-center justify-center" aria-live="polite">
        {isFetchingNextPage && <LoaderCircle className="h-6 w-6 animate-spin" aria-label="Loading more articles" />}
        {!isFetchingNextPage && hasNextPage && <span className="sr-only">More articles load automatically.</span>}
      </div>
    </SiteShell>
  );
}
