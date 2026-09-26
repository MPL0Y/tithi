// Offline support. Our own files: network first, so a deploy shows on the next visit; cache when offline.
// CDN script and fonts: cache first, they don't change at a given URL.
const CACHE = 'tithi-v2';
const CORE = ['./', 'panchang.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/astronomy-engine@2/astronomy.browser.min.js'];

self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE))); });
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const { request } = e, url = new URL(request.url);
  if (request.method !== 'GET' || url.hostname.startsWith('geocoding-api')) return; // city search needs the network anyway
  e.respondWith(caches.open(CACHE).then(async cache => {
    const save = r => { if (r.ok || r.type === 'opaque') cache.put(request, r.clone()); return r; };
    if (url.origin === location.origin) {
      try { return save(await fetch(request)); } catch { return (await cache.match(request, { ignoreSearch: true })) || Response.error(); }
    }
    return (await cache.match(request)) || save(await fetch(request));
  }));
});
