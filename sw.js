const CACHE = 'tango-infinite-v23';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './engine.js', './solver.js', './hint-plus.js', './li-puzzles.js', './archive-loader.js', './linkedin-generator.js', './generator-lab.js', './ui.js', './ui-next.js'];

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

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const request = url.pathname.endsWith('/ui.js') ? './ui-next.js' : event.request;
  event.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
