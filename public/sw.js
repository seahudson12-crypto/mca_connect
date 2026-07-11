// MCA CONNECT service worker — app shell caching + offline fallback.
// Kept simple and self-contained. Registration is guarded client-side so this
// worker never installs in Lovable preview, iframes, or dev.

const VERSION = "v1";
const RUNTIME_CACHE = `mca-runtime-${VERSION}`;
const ASSET_CACHE = `mca-assets-${VERSION}`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("mca-") && k !== RUNTIME_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isSameOriginAsset(url) {
  return (
    url.origin === self.location.origin &&
    /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico|gif)$/i.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never intercept auth / api / websockets / non-http
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_server") ||
    url.pathname.startsWith("/__l5e/") ||
    url.pathname.startsWith("/~oauth")
  ) {
    return;
  }

  // HTML navigations — network first, fall back to cached shell
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put("/", fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cache = await caches.open(RUNTIME_CACHE);
          const cached = (await cache.match(req)) || (await cache.match("/"));
          return (
            cached ||
            new Response(
              "<h1>Hors ligne</h1><p>Vérifiez votre connexion.</p>",
              { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
            )
          );
        }
      })(),
    );
    return;
  }

  // Static assets — cache first
  if (isSameOriginAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const fresh = await fetch(req);
          if (fresh.ok) cache.put(req, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          return cached || Response.error();
        }
      })(),
    );
  }
});
