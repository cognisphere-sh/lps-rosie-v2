// Service worker for the installable app. Its *existence* (plus a fetch
// handler) is what makes Chrome consider the app installable at all — the
// caching below is a bonus, not the point.
//
// Strategy: network-first, with the last successful page kept as an offline
// app shell. Nothing is precached: every page is behind the harness login, so
// an install-time fetch would just cache a redirect to /login.

const CACHE = 'lps-app-shell-v1'
const FALLBACK = '/suppliers'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only whole-page loads are cached. API calls and assets fall through to the
  // network untouched — stale supplier data would be worse than no data.
  if (request.method !== 'GET' || request.mode !== 'navigate') return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // `cache.put` throws on a redirected response, and a redirect here is
        // the login bounce anyway — not something worth serving offline.
        if (response.ok && !response.redirected) {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(async () => {
        // Next varies HTML on its router headers, so a plain match would miss.
        const cache = await caches.open(CACHE)
        return (
          (await cache.match(request, { ignoreVary: true })) ??
          (await cache.match(FALLBACK, { ignoreVary: true, ignoreSearch: true })) ??
          Response.error()
        )
      }),
  )
})
