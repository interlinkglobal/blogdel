import { curatedImageUrl } from "./curated-images";
import { FOOD_DRIVE_IDS, foodImageUrl } from "./food-image-library";
import { getArticleFallbackImage } from "./fallback-images";
import { supabaseImageCopy } from "./supabase-image-library";

function imageHost(url: string) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ""; }
}

function isCloudinary(url: string) {
  const host = imageHost(url);
  return host === "res.cloudinary.com" || host.endsWith(".cloudinary.com");
}

function isDrive(url: string) {
  const host = imageHost(url);
  return host === "drive.google.com" || host === "googleusercontent.com" || host.endsWith(".googleusercontent.com");
}

function isSupabase(url: string) {
  const host = imageHost(url);
  return (host.endsWith(".supabase.co") || host.endsWith(".supabase.in")) && url.includes("/storage/v1/");
}

function normalizeImageUrl(url: string) {
  const match = url.match(/^https:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)\//);
  return match ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(match[1])}&sz=w3840` : url;
}

function isUsableRelative(url: string) {
  // Old generated /fallback-images/<category>-1.jpg URLs do not exist on disk.
  return url.startsWith("/fallback-images/") && !/-1\.jpg$/i.test(url) && /\.(?:png|jpe?g|webp|svg)$/i.test(url);
}

export function thumbnailCandidates(category: string | null | undefined, articleKey: string, rank: number, storedUrl: string | null | undefined) {
  const original = (storedUrl ?? "").trim();
  const candidates: string[] = [];
  const add = (url: string | null | undefined) => {
    if (url && !candidates.includes(url)) candidates.push(url);
  };

  if (isCloudinary(original)) add(original);
  if (category && rank >= 0) add(curatedImageUrl(category, rank));
  if (isDrive(original)) add(normalizeImageUrl(original));
  if (category === "food" && rank >= 0) add(foodImageUrl(FOOD_DRIVE_IDS[rank % FOOD_DRIVE_IDS.length]));
  if (/^https?:\/\//i.test(original) && !isCloudinary(original) && !isDrive(original)) add(original);
  // Only add verified copies. No Storage request is made until earlier images fail.
  for (const url of [...candidates]) add(supabaseImageCopy(url));
  if (isUsableRelative(original)) add(original);
  add(getArticleFallbackImage(category, articleKey));
  return candidates.sort((a, b) => thumbnailTier(a) - thumbnailTier(b));
}

export function thumbnailTier(url: string | undefined) {
  if (!url) return 5; // In-app component fallback
  if (isCloudinary(url)) return 0;
  if (isDrive(url)) return 1;
  if (isSupabase(url)) return 3;
  if (/^https?:\/\//i.test(url)) return 2;
  return 4; // Codebase-relative image
}
