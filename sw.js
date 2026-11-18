// Offline shell for the tablet. Text, fonts, photos and the one meadow
// recording are cached. Any other video stays on the network.

import { VIDEO_PATH, byteRange } from "./src/shell.js";

const CACHE = "paarden-gids-shell-v3";
const SHELL = [
  "/",
  "/index.html",
  "/app.css",
  "/app.js",
  "/src/logic.js",
  "/src/store.js",
  "/src/copy.js",
  "/src/render.js",
  "/src/shell.js",
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

let videoBytes = null;

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
      await cacheVideo();
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
      if (url.endsWith(".mp4")) return;
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

async function tellVideo() {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) client.postMessage({ type: "video-cached" });
}

async function cacheVideo() {
  try {
    const cache = await caches.open(CACHE);
    if (await cache.match(VIDEO_PATH)) {
      await tellVideo();
      return;
    }
    const fresh = await fetch(VIDEO_PATH);
    if (!fresh.ok) return;
    await cache.put(VIDEO_PATH, fresh);
    videoBytes = null;
    await tellVideo();
  } catch {
    /* the recording can arrive on the next visit */
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js") return;
  if (url.pathname === VIDEO_PATH) {
    event.respondWith(rangedVideo(request));
    return;
  }
  if (url.pathname.endsWith(".mp4")) return;
  if (url.searchParams.has("opnieuw")) {
    event.respondWith(fetch(request).catch(() => missing(request)));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});

function offlineDocument() {
  const html = `<!DOCTYPE html>
<html lang="nl-BE">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Alles over paarden</title>
  <style>
    body { margin: 0; background: #f3eee4; color: #1c1915; font: 18px/1.55 "Segoe UI", sans-serif; }
    main { max-width: 38rem; margin: 0 auto; padding: 2.2rem 1.2rem 3rem; }
    h1 { font-family: Georgia, serif; font-weight: 560; font-size: 2.1rem; line-height: 1.15; margin: 0.2rem 0 0.8rem; }
    p { margin: 0.6rem 0; }
    button { font: inherit; min-height: 3rem; margin-top: 0.8rem; padding: 0.55rem 1rem; border-radius: 0.85rem; border: 0; background: #243e32; color: #f3eee4; }
  </style>
</head>
<body>
  <main>
    <p>Naslagwerk</p>
    <h1>Alles over paarden</h1>
    <p>Je bent offline, en deze tablet heeft de gids nog niet bewaard. Ga online en open de gids één keer. Daarna blijven de tekst en de foto's hier staan. De korte opname niet: die heeft altijd internet nodig.</p>
    <p><button type="button" onclick="location.reload()">Opnieuw proberen</button></p>
  </main>
</body>
</html>`;
  return new Response(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function missing(request) {
  if (request.destination === "image" || new URL(request.url).pathname.endsWith(".jpg")) {
    return new Response("", { status: 504, statusText: "offline" });
  }
  return new Response("Niet op deze tablet.", {
    status: 504,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function loadVideoBytes() {
  if (videoBytes) return videoBytes;
  const cache = await caches.open(CACHE);
  let hit = await cache.match(VIDEO_PATH);
  if (!hit) {
    const fresh = await fetch(VIDEO_PATH);
    if (!fresh.ok) return null;
    await cache.put(VIDEO_PATH, fresh.clone());
    hit = fresh;
    await tellVideo();
  }
  videoBytes = await hit.arrayBuffer();
  return videoBytes;
}

async function rangedVideo(request) {
  let bytes;
  try {
    bytes = await loadVideoBytes();
  } catch {
    bytes = null;
  }
  if (!bytes) return new Response("", { status: 504, statusText: "offline", headers: { "Content-Type": "video/mp4" } });
  const range = request.headers.get("range");
  const span = range ? byteRange(bytes.byteLength, range) : null;
  if (!span) {
    const whole = bytes.slice(0);
    return new Response(whole, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(whole.byteLength),
        "Accept-Ranges": "bytes",
      },
    });
  }
  const slice = bytes.slice(span.start, span.end + 1);
  return new Response(slice, {
    status: 206,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(slice.byteLength),
      "Content-Range": `bytes ${span.start}-${span.end}/${span.total}`,
      "Accept-Ranges": "bytes",
    },
  });
}

async function networkFirstPage(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) await cache.put("/index.html", fresh.clone());
    return fresh;
  } catch {
    const cached = (await cache.match("/index.html")) || (await cache.match("/"));
    if (cached) return cached;
    return offlineDocument();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh.ok && !new URL(request.url).pathname.endsWith(".mp4")) await cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return missing(request);
  }
}
