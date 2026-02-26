/**
 * Horizon POS Service Worker
 * Caches the app shell so /pos loads offline.
 * API GET requests use stale-while-revalidate.
 * POST requests pass through (offline sales handled by IndexedDB).
 */

const CACHE_NAME = "horizon-pos-v2";

// App shell — index.html is enough; CRA injects JS/CSS bundles as <script>/<link>
// and the browser will request them, which we cache dynamically on first load.
const APP_SHELL = ["/pos", "/index.html"];

// Patterns we should cache dynamically (JS/CSS bundles, fonts, images)
const CACHEABLE_EXTENSIONS = /\.(js|css|woff2?|ttf|eot|svg|png|jpg|ico)(\?.*)?$/;

// API paths to cache with stale-while-revalidate (GET only)
const CACHEABLE_API = ["/api/pos/products", "/api/pos/summary"];

// ─── Install: pre-cache the app shell ────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ─── Activate: clean old caches ──────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch strategy ──────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Never intercept POST/PUT/DELETE — IndexedDB handles offline sales
  if (request.method !== "GET") return;

  // Navigation requests (e.g. /pos) — network first, fallback to cache
  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // API GET requests — stale-while-revalidate
  if (CACHEABLE_API.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Static assets (JS, CSS, fonts) — stale-while-revalidate
  // CRA production builds use content-hashed filenames (main.abc123.js),
  // so a new deploy = new URLs = no stale cache. Old URLs expire naturally.
  if (CACHEABLE_EXTENSIONS.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
});

// ─── Strategies ──────────────────────────────────────────────────────────────

async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    // Fallback: serve /index.html for any navigation (SPA)
    return cached || caches.match("/index.html");
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || (await networkFetch) || new Response("{}", { status: 503 });
}

async function cacheFirstWithNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 503, statusText: "Offline" });
  }
}

// ─── Background Sync ─────────────────────────────────────────────────────────

self.addEventListener("sync", (event) => {
  if (event.tag === "pos-offline-sync") {
    event.waitUntil(syncOfflineSales());
  }
});

async function syncOfflineSales() {
  // Open IndexedDB directly from the SW
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open("horizon_pos", 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const queue = await new Promise((resolve, reject) => {
    const tx = db.transaction("offline_queue", "readonly");
    const store = tx.objectStore("offline_queue");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  if (!queue.length) return;

  // Get auth token from all clients
  const clients = await self.clients.matchAll();
  let token = null;
  for (const client of clients) {
    // We can't access localStorage from SW, so try to find token via message
    // For now, rely on the cookie or skip if no token available
  }

  // Background sync is best-effort; the app will retry on next open
  // The main thread handles the actual sync with auth tokens
}
