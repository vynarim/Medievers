// Service worker of the installed app (PWA): network first, so an online player always runs
// the build just published (two peers must run the same commit, TECH_SPEC §8.3); the copy kept
// of each page and asset only serves when the network is gone, for a match against the AI.
const CACHE = 'medieverse-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Only this site's own files: Firebase and the rest go their own way.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(request)
          .then((hit) => hit ?? caches.match('/'))
          .then((hit) => hit ?? Response.error()),
      ),
  );
});
