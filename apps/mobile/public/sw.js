/*
 * Service worker: makes the PWA installable and keeps the app shell available
 * offline. API calls are never handled here (HTTP cache headers + React Query
 * own their freshness).
 *
 * Bump CACHE when the caching strategy changes: old caches are deleted on activate.
 */
const CACHE = "canape-shell-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/", "/manifest.json"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function putInCache(request, response) {
  if (response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // SPA: every route is the shell. Network first (fresh deploys), cached shell when offline.
    event.respondWith(
      fetch(request)
        .then((response) => putInCache("/", response))
        .catch(() => caches.match("/")),
    );
    return;
  }

  if (url.pathname.startsWith("/_expo/static/") || url.pathname.startsWith("/assets/")) {
    // Content-hashed file names: a URL never changes content → cache first.
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((r) => putInCache(request, r))));
    return;
  }

  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.json") {
    // Stable names whose content can change (e.g. new app colour): serve cached, refresh in background.
    event.respondWith(
      caches.match(request).then((hit) => {
        const refresh = fetch(request)
          .then((r) => putInCache(request, r))
          .catch(() => hit); // offline: keep the cached copy
        return hit || refresh;
      }),
    );
  }
});
