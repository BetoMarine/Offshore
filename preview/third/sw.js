/* Offshore service worker. Scope is the folder this file is served from.
   Cleanup touches only offshore- caches. */
const CACHE = 'offshore-shell-1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([
      './',
      './index.html',
      './manifest.webmanifest',
      './icon-192.png',
      './icon-512.png',
    ]).catch(() => undefined)),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(
      names
        .filter((name) => name.startsWith('offshore-') && name !== CACHE)
        .map((name) => caches.delete(name)),
    )
    await self.clients.claim()
  })())
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  const scope = self.registration.scope
  if (!url.href.startsWith(scope) && url.href + '/' !== scope) return
  event.respondWith((async () => {
    try {
      const fresh = await fetch(request)
      if (fresh.ok) {
        const cache = await caches.open(CACHE)
        cache.put(request, fresh.clone())
      }
      return fresh
    } catch {
      const cached = await caches.match(request)
      if (cached) return cached
      return caches.match('./index.html')
    }
  })())
})
