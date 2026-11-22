// Service Worker: cache "stale-while-revalidate" para todos os recursos do próprio domínio.
// Após a primeira visita, módulos educativos, cena 3D e cálculos locais funcionam offline.
const CACHE = 'engefril3d-v3';
const CORE = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './favicon.ico', './icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
// A página envia a lista de recursos já carregados (inclusive antes da ativação do SW)
self.addEventListener('message', (e) => {
  if (e.data?.type === 'cache' && Array.isArray(e.data.urls)) {
    e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(e.data.urls.map((u) => c.add(u)))));
  }
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached || (req.mode === 'navigate' ? cache.match('./index.html') : undefined));
      return cached || network;
    }),
  );
});
