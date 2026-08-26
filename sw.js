// Tile Runner service worker — NETWORK-FIRST so the newest deploy always wins,
// with an offline fallback to the last cached copy.
const CACHE = "tile-runner-v92";
const ASSETS = [
  "./",
  "./index.html",
  "./levels.js",
  "./manifest.webmanifest",
  "./Square.ttf",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (e) => {
  // grab a fresh copy of everything, then take over immediately
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// NETWORK-FIRST: try the network (and refresh the cache); only use the cache when offline.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return resp;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match("./index.html")))
  );
});

// let the page tell a waiting worker to activate right away
self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });
