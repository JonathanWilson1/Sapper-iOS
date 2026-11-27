// Offline support: keep a copy of the game so the home-screen app runs with no signal.
// Network first (so updates arrive when online), cached copy when offline.
// Only the game's own files are ever written to the cache.
const CACHE = 'sapper-v4';
const FILES = [
  './', './index.html', './manifest.json', './icon-180.png', './icon-512.png', './peerjs.min.js', './css/style.css',
  ...['core', 'buildings', 'physics', 'combat', 'miners', 'director', 'render', 'ui', 'flow', 'share', 'multiplayer', 'debug', 'main']
    .map(n => `./js/${n}.js`),
];
const base = new URL('./', self.location);
const paths = new Set(FILES.map(f => new URL(f, base).pathname));
const docPaths = new Set([new URL('./', base).pathname, new URL('./index.html', base).pathname]);
self.addEventListener('install', e => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then(c => c.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches
      .keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || !paths.has(url.pathname)) return; // not ours: leave it alone
  const isDoc = docPaths.has(url.pathname);
  const key = isDoc ? './index.html' : url.pathname; // fixed keys: a query string can't create or pick an entry
  // the page itself skips the browser's HTTP cache so a new version shows up straight away
  e.respondWith(
    fetch(isDoc ? new Request(url.href, { cache: 'no-store' }) : e.request)
      .then(r => {
        const html = (r.headers.get('content-type') || '').includes('text/html');
        if (r.ok && r.type === 'basic' && !r.redirected && (!isDoc || html)) {
          const copy = r.clone();
          caches
            .open(CACHE)
            .then(c => c.put(key, copy))
            .catch(() => {});
        }
        return r;
      })
      .catch(() => caches.match(key))
  );
});
