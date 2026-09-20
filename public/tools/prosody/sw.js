// Offline app shell for /tools/prosody. Scoped to this directory by default
// (a service worker's scope is its own URL's directory unless widened via
// the Service-Worker-Allowed header), so it never touches the rest of the
// site. API routes under /tools/prosody/api/ are deliberately left alone --
// they need a live network and should fail normally when offline.

const CACHE_NAME = "prosody-shell-v1";
const SHELL_URL = "/tools/prosody";
const SHELL_ASSETS = [SHELL_URL, "/tools/prosody/styles.css", "/tools/prosody/app.js"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/tools/prosody/api/")) return;

  // Any navigation under this tool (/tools/prosody, /tools/prosody/p/:id, ...)
  // falls back to the cached shell when offline -- the client-side router
  // then tries to load the specific paragraph itself.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(SHELL_URL, res.clone()));
          return res;
        })
        .catch(() => caches.match(SHELL_URL))
    );
    return;
  }

  if (SHELL_ASSETS.indexOf(url.pathname) !== -1) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
