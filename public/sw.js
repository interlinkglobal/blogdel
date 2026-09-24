const CACHE_VERSION = "blogdel-pwa-v1";
const STATIC_CACHE = CACHE_VERSION + "-static";
const PAGE_CACHE = CACHE_VERSION + "-pages";

const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/blogdel-48x48.png",
  "/blogdel-72x72.png",
  "/blogdel-96x96.png",
  "/blogdel-128x128.png",
  "/blogdel-144x144.png",
  "/blogdel-152x152.png",
  "/blogdel-180x180.png",
  "/blogdel-192x192.png",
  "/blogdel-384x384.png",
  "/blogdel-512x512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("/");
        })
    );
    return;
  }

  const cacheable = ["image", "style", "script", "font", "manifest"].includes(request.destination);
  if (!cacheable) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);

      return cached || network;
    })
  );
});
