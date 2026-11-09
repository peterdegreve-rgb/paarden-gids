// Offline shell for the tablet. Text, fonts and photos are cached.
// The meadow video stays on the network: it is large and only plays online.

const CACHE = "paarden-gids-shell-v1";
const SHELL = [
  "/",
  "/index.html",
  "/app.css",
  "/app.js",
  "/src/logic.js",
  "/src/store.js",
  "/src/copy.js",
  "/src/render.js",
  "/content/site.json",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/icons/icon-180.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/fonts/fraunces.woff2",
  "/fonts/fraunces-italic.woff2",
  "/fonts/source-sans-3.woff2",
  "/fonts/source-sans-3-italic.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
      await cachePhotos();
    })(),
  );
});

async function cachePhotos() {
  const cache = await caches.open(CACHE);
  let site;
  try {
    const response = await cache.match("/content/site.json");
    site = await response.json();
  } catch {
    return;
  }
  const urls = new Set(["/horses/weide.jpg", "/horses/lichaam.jpg"]);
  const walk = (value) => {
    if (typeof value === "string" && value.startsWith("/horses/") && value.endsWith(".jpg")) urls.add(value);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(site);
  for (const breed of site.breeds ?? []) urls.add(`/horses/${breed.slug}.jpg`);
  await Promise.all(
    [...urls].map(async (url) => {
      try {
        const hit = await cache.match(url);
        if (hit) return;
        const fresh = await fetch(url);
        if (fresh.ok) await cache.put(url, fresh);
      } catch {
        /* a missing photo should not block the rest */
      }
    }),
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js" || url.pathname.endsWith(".mp4")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});

async function networkFirstPage(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) await cache.put("/index.html", fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match("/index.html");
    if (cached) return cached;
    return new Response("De gids is offline en nog niet op deze tablet opgeslagen.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh.ok) await cache.put(request, fresh.clone());
  return fresh;
}
