import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { getArticleFallbackImage } from "@/lib/fallback-images";
import { supabaseImageCopy } from "@/lib/supabase-image-library";

export function EditorialFallback({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-muted text-foreground", className)} role="img" aria-label="Blogdel editorial fallback">
      <div className="absolute left-6 top-4 z-10">
        <div className="headline text-xl">Blogdel</div>
        <div className="mt-1 text-[0.52rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Editorial fallback</div>
      </div>
      <div className="absolute right-7 top-5 h-12 w-12 rounded-full bg-foreground/20" />
      <div className="absolute bottom-0 left-0 h-[54%] w-[48%] bg-foreground/10" style={{ clipPath: "polygon(0 55%, 45% 10%, 100% 65%, 100% 100%, 0 100%)" }} />
      <div className="absolute bottom-0 left-[32%] h-[72%] w-[68%] bg-foreground/15" style={{ clipPath: "polygon(0 72%, 47% 8%, 100% 70%, 100% 100%, 0 100%)" }} />
    </div>
  );
}

type EditorialImageProps = {
  src?: string | null;
  candidateUrls?: string[] | null;
  categorySlug?: string | null;
  articleKey?: string | null;
  alt: string;
  className?: string;
  renditionWidth?: number;
  priority?: boolean;
};

function sizeDriveImage(url: string, width: number) {
  const match = url.match(/^https:\/\/drive\.google\.com\/thumbnail\?id=([^&]+)/);
  if (!match) return url;
  let id = match[1];
  try { id = decodeURIComponent(id); } catch {}
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${width}`;
}

export function EditorialImage({ src, candidateUrls, categorySlug, articleKey, alt, className, renditionWidth = 1280, priority = false }: EditorialImageProps) {
  const categoryFallback = getArticleFallbackImage(categorySlug, articleKey);
  const candidates = useMemo(() => {
    const primary = [src, ...(candidateUrls ?? [])].filter((url): url is string => !!url);
    const copies = primary.map(supabaseImageCopy).filter((url): url is string => !!url);
    const urls = [
      ...primary.filter((url) => !url.startsWith("/")),
      ...copies,
      ...primary.filter((url) => url.startsWith("/")),
      categoryFallback,
    ];
    return [...new Set(urls.filter((url): url is string => !!url && !url.includes("editorial-fallback")))]
      .map((url) => sizeDriveImage(url, renditionWidth));
  }, [src, candidateUrls, categoryFallback, renditionWidth]);
  const candidateKey = candidates.join("\n");
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [candidateKey]);
  const currentSrc = candidates[index];

  if (!currentSrc) return <EditorialFallback className={className} />;

  return (
    <img
      key={currentSrc}
      src={currentSrc}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      data-blog-image
      className={className}
      onError={() => setIndex((current) => current + 1)}
    />
  );
}
