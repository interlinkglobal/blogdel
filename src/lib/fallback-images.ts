const FALLBACKS: Record<string, string[]> = {
  technology: [
    "/fallback-images/tech-fallback-1.png",
    "/fallback-images/tech-fallback-2.png",
    "/fallback-images/tech-fallback-3.png",
  ],
  health: [
    "/fallback-images/health-fallback-1.png",
    "/fallback-images/health-fallback-2.png",
    "/fallback-images/health-fallback-3.png",
  ],
  sports: [
    "/fallback-images/sports-fallback-1.png",
    "/fallback-images/sports-fallback-2.png",
    "/fallback-images/sports-fallback-3.png",
    "/fallback-images/sports-fallback-4.png",
  ],
  politics: [
    "/fallback-images/politics-fallback-1.png",
    "/fallback-images/politics-fallback-2.png",
    "/fallback-images/politics-fallback-3.png",
  ],
  entertainment: [
    "/fallback-images/entertainment-fallback-2.png",
    "/fallback-images/entertainment-fallback-3.png",
  ],
  business: [
    "/fallback-images/business-fallback-1.png",
    "/fallback-images/business-fallback-2.png",
    "/fallback-images/business-fallback-3.png",
  ],
  science: [
    "/fallback-images/science-fallback-1.png",
    "/fallback-images/science-fallback-2.png",
    "/fallback-images/science-fallback-3.png",
  ],
  education: [
    "/fallback-images/education-fallback-1.png",
    "/fallback-images/education-fallback-2.png",
    "/fallback-images/education-fallback-3.png",
  ],
  food: [
    "/fallback-images/food-fallback-1.png",
    "/fallback-images/food-fallback-2.png",
    "/fallback-images/food-fallback-3.png",
  ],
  history: [
    "/fallback-images/history-fallback-1.png",
    "/fallback-images/history-fallback-2.png",
    "/fallback-images/history-fallback-3.png",
  ],
};

const GENERIC_FALLBACK = "/editorial-fallback.svg";

function stableIndex(value: string, length: number) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

export function getArticleFallbackImage(categorySlug?: string | null, articleKey?: string | null) {
  if (!categorySlug) return GENERIC_FALLBACK;
  const options = FALLBACKS[categorySlug.toLowerCase()];
  if (!options?.length) return GENERIC_FALLBACK;
  return options[stableIndex(articleKey || categorySlug, options.length)];
}

export function getGenericEditorialFallback() {
  return GENERIC_FALLBACK;
}
