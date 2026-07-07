const CACHE = 'tango-infinite-v15';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './engine.js', './solver.js', './hint-plus.js', './ui.js', './ui-next.js'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

async function getText(pathOrRequest) {
  const cached = await caches.match(pathOrRequest);
  if (cached) return cached.text();
  const response = await fetch(pathOrRequest);
  const copy = response.clone();
  caches.open(CACHE).then(cache => cache.put(pathOrRequest, copy));
  return response.text();
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.endsWith('/solver.js')) {
    event.respondWith((async () => {
      const solverText = await getText(event.request);
      const hintText = await getText('./hint-plus.js');
      const body = [solverText, hintText].join('\n');
      return new Response(body, { headers: { 'Content-Type': 'application/javascript; charset=utf-8' } });
    })());
    return;
  }
  const request = url.pathname.endsWith('/ui.js') ? './ui-next.js' : event.request;
  event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(request, copy));
    return response;
  }).catch(() => caches.match('./index.html'))));
});
