// Offline support: keep a copy of the game so the home-screen app runs with no signal.
// Network first (so updates arrive when online), cached copy when offline.
const CACHE = 'sapper-v2';
const FILES = ['./', './index.html', './manifest.json', './icon-180.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;   // same-origin only
  // page loads all share one fixed key, so a query string can never create or pick a cache entry
  const key = e.request.mode === 'navigate' ? './index.html' : e.request;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && r.type === 'basic' && !r.redirected) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(key, copy)).catch(() => {}); }
    return r;
  }).catch(() => caches.match(key).then(r => r || caches.match('./index.html'))));
});
