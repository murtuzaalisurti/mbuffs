// The placeholder below is replaced at build time by vite.config.ts with a
// unique timestamp. In development it stays as-is, which is fine since the
// browser will always fetch the latest SW from the dev server anyway.
const CACHE_NAME = "mbuffs-__BUILD_HASH__";

// Install: skip waiting only if the app explicitly tells us to (via message).
// This lets us show an "Update available" prompt instead of silently updating.
self.addEventListener("install", (event) => {
  // Don't call skipWaiting() here — we wait for user confirmation.
});

// Activate: clean up old caches and claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Listen for skipWaiting message from the app
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Fetch: network-first strategy
// Try the network first; if it fails, fall back to the cache.
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  // Skip chrome-extension and non-http(s) requests
  if (!request.url.startsWith("http")) return;

  // Skip cross-origin requests (API calls to the backend domain).
  // - Cross-origin cookies are only sent when the browser controls the request;
  //   serving a cached cross-origin response would bypass cookie handling and
  //   return stale auth state, making the PWA appear logged-in when it isn't.
  // - Auth session endpoints must always hit the real network.
  if (new URL(request.url).origin !== self.location.origin) return;

  // Skip any auth-related same-origin paths just in case
  if (request.url.includes("/api/auth/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Don't cache opaque responses or errors
        if (!response || response.status !== 200) {
          return response;
        }

        // Clone the response before caching (streams can only be read once)
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // Network failed — try the cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          // For navigation requests, serve the cached index.html (SPA fallback)
          if (request.mode === "navigate") {
            return caches.match("/index.html");
          }

          return new Response("Offline", {
            status: 503,
            statusText: "Service Unavailable",
          });
        });
      })
  );
});
