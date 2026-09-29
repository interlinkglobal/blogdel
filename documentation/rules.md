# Blogdel operating rules

These rules apply whenever Blogdel is developed, published, backfilled, or run. Preserve them when changing feed queries, image acquisition, article publication, or card UI.

## Rule 1 — Blog card thumbnails

1. Every rendered blog card must have an image area and a usable thumbnail. Never publish or render a broken image URL as the only candidate. The in-app editorial image component is the final emergency state after all real image candidates fail.
2. Choose a card's available image candidates in this exact order: **Cloudinary image URL → Google Drive image URL → public internet image URL → Supabase Storage image URL → valid codebase-relative image → in-app fallback component**. The category link lists in `thumbnails/` supply Google Drive candidates; keep their category mapping and order stable. A higher-priority working image must not be overwritten by a lower-priority one.
3. Order feed cards by the quality tier of their selected thumbnail before applying pagination. Within a tier, preserve the feed's editorial order. Cards with Cloudinary, Drive, or other public images come before cards that only have codebase-relative or component fallbacks. This applies to the homepage and every filtered feed.
4. Request a 3840-pixel-wide rendition for Google Drive card thumbnails. Prefer source images that are at least 3840 × 2160 pixels in a 16:9 frame. Do not describe a smaller source, a CSS-scaled image, or a vector placeholder as verified 4K photography. Validate new collections for working public URLs, actual pixel dimensions, category relevance, and distinct images before using them.
5. For the first 100 cards in a category with 100 distinct curated links, use distinct images. Rotate a collection only after exhausting it, so repeated images are as far apart as the collection allows. If fewer than 100 distinct links exist, use distinct real images from higher-priority sources where possible and record the shortfall; do not claim that 100 supplied links exist.
6. Try candidates in priority order on image load failure. A missing or slow image must not prematurely force the in-app component fallback. Keep valid codebase-relative category assets available for offline and last-resort display; never generate a path to a file that does not exist.
7. Before publishing thumbnail or feed changes, check the source counts, uniqueness of the first 100 selections, a production build, rendered cards in multiple categories, fallback behavior, and deployment/runtime health. Record any category without a 4K-capable public collection as an unmet image supply requirement.

8. Use verified Supabase copies of the category Drive images before codebase-relative assets. Request a Supabase image only after earlier candidates fail; do not prefetch or preload these backup copies.
