import { createFileRoute } from "@tanstack/react-router";
import { FOOD_DRIVE_IDS } from "@/lib/food-image-library";

const ALLOWED = new Set<string>(FOOD_DRIVE_IDS);

function requestedWidth(request: Request) {
  const raw = Number(new URL(request.url).searchParams.get("w") ?? 720);
  if (!Number.isFinite(raw)) return 720;
  return Math.min(1600, Math.max(480, Math.round(raw / 80) * 80));
}

export const Route = createFileRoute("/api/public/food-image/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const id = params.id;
        if (!ALLOWED.has(id)) return new Response("Not found", { status: 404 });

        const width = requestedWidth(request);
        const upstream = await fetch(
          `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${width}`,
          {
            headers: {
              accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            },
            redirect: "follow",
          }
        );

        const contentType = upstream.headers.get("content-type") ?? "";
        if (!upstream.ok || !contentType.startsWith("image/")) {
          return new Response("Image unavailable", {
            status: 502,
            headers: { "cache-control": "no-store" },
          });
        }

        const headers = new Headers({
          "content-type": contentType,
          "cache-control": "public, max-age=604800, stale-while-revalidate=2592000",
          "cdn-cache-control": "public, max-age=31536000, immutable",
          "vercel-cdn-cache-control": "public, max-age=31536000, immutable",
          "x-content-type-options": "nosniff",
        });

        const length = upstream.headers.get("content-length");
        const etag = upstream.headers.get("etag");
        if (length) headers.set("content-length", length);
        if (etag) headers.set("etag", etag);

        return new Response(upstream.body, { status: 200, headers });
      },
    },
  },
});
