// Tile Runner service worker — NETWORK-FIRST so the newest deploy always wins,
// with an offline fallback to the last cached copy.
const CACHE = "tile-runner-v145";
const ASSETS = [
  "./",
  "./index.html",
  "./levels.js",
  "./copy.js",
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

// NETWORK-FIRST, AND REALLY THE NETWORK. A plain fetch() from here still reads through the
// browser's own HTTP cache, which will happily hand back a copy.js or levels.js from before the
// last deploy alongside the index.html from after it — and since the talismans' names moved into
// copy.js, that pairing draws them blank. So the game's own files are asked for with "no-cache":
// the browser must check with the server first, which is one cheap 304 when nothing changed.
// Page NAVIGATIONS are left exactly as they were — refetching one by URL loses its redirect
// handling — and anything from another origin (fonts) is fetched as it always was.
const fresh = (req) => {
  if (req.mode === "navigate" || new URL(req.url).origin !== self.location.origin) return fetch(req);
  return fetch(req.url, { cache: "no-cache", credentials: "same-origin" });
};

// NETWORK-FIRST: try the network (and refresh the cache); only use the cache when offline.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fresh(e.request)
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
