const CACHE = 'tango-infinite-v11';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './engine.js', './solver.js', './hint-plus.js', './ui.js', './ui-next.js'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

async function cachedOrFetched(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  const copy = response.clone();
  caches.open(CACHE).then(cache => cache.put(request, copy));
  return response;
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (url.pathname.endsWith('/ui-next.js')) {
    event.respondWith(Promise.all([
      cachedOrFetched('./hint-plus.js').then(r => r.text()),
      cachedOrFetched(event.request).then(r => r.text())
    ]).then(([hint, ui]) => new Response(hint + '\n' + ui, { headers: { 'Content-Type': 'application/javascript; charset=utf-8' } })));
    return;
  }

  const request = url.pathname.endsWith('/ui.js') ? './ui-next.js' : event.request;
  event.respondWith(cachedOrFetched(request).catch(() => caches.match('./index.html')));
});
