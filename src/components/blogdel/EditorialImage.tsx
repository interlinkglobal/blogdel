import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { getArticleFallbackImage } from "@/lib/fallback-images";

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
  categorySlug?: string | null;
  articleKey?: string | null;
  alt: string;
  className?: string;
};

export function EditorialImage({ src, categorySlug, articleKey, alt, className }: EditorialImageProps) {
  const fallback = useMemo(() => getArticleFallbackImage(categorySlug, articleKey), [categorySlug, articleKey]);
  const original = (src ?? "").trim();
  const usableOriginal = original && !original.includes("editorial-fallback") ? original : "";
  const startsAsFallback = !usableOriginal || usableOriginal.startsWith("/fallback-images/");
  const [currentSrc, setCurrentSrc] = useState(usableOriginal || fallback || "");
  const [usingFallback, setUsingFallback] = useState(startsAsFallback);
  const [loaded, setLoaded] = useState(false);
  const [showEditorial, setShowEditorial] = useState(false);

  const useCategoryFallback = () => {
    if (!fallback) {
      setShowEditorial(true);
      return;
    }
    setLoaded(false);
    setUsingFallback(true);
    setCurrentSrc(fallback);
  };

  useEffect(() => {
    setLoaded(false);
    setShowEditorial(false);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setShowEditorial(true);
      return;
    }
    if (usableOriginal) {
      setCurrentSrc(usableOriginal);
      setUsingFallback(usableOriginal.startsWith("/fallback-images/"));
    } else if (fallback) {
      setCurrentSrc(fallback);
      setUsingFallback(true);
    } else {
      setCurrentSrc("");
      setUsingFallback(true);
      setShowEditorial(true);
    }
  }, [usableOriginal, fallback]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const offline = () => setShowEditorial(true);
    const online = () => {
      setShowEditorial(false);
      setLoaded(false);
      if (usableOriginal) {
        setCurrentSrc(usableOriginal);
        setUsingFallback(usableOriginal.startsWith("/fallback-images/"));
      } else if (fallback) {
        setCurrentSrc(fallback);
        setUsingFallback(true);
      }
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [usableOriginal, fallback]);

  useEffect(() => {
    if (!usingFallback || loaded || showEditorial || !currentSrc) return;
    const timer = setTimeout(() => setShowEditorial(true), 4500);
    return () => clearTimeout(timer);
  }, [usingFallback, loaded, showEditorial, currentSrc]);

  if (showEditorial || !currentSrc) return <EditorialFallback className={className} />;

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading="lazy"
      data-blog-image
      data-original-src={!usingFallback ? usableOriginal : ""}
      className={className}
      onLoad={(e) => {
        setLoaded(true);
        if (usingFallback || !usableOriginal) return;
        const matches = Array.from(document.querySelectorAll<HTMLImageElement>("img[data-blog-image]"))
          .filter((img) => img.dataset.originalSrc === usableOriginal);
        if (matches[0] !== e.currentTarget) useCategoryFallback();
      }}
      onError={() => {
        if (usingFallback) setShowEditorial(true);
        else useCategoryFallback();
      }}
    />
  );
}
