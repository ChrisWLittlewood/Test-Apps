// Offline cache for the app shell. Bump VERSION whenever files change.
const VERSION = 'vte-v1.4.0';
const FILES = [
  './', './index.html', './styles.css', './app.js', './checklist.js', './report.js', './pipedims.js', './pipeclasses.js', './ech.js', './viewer.js', './isotool.js',
  './manifest.webmanifest', './vendor/docx.js', './vendor/jszip.min.js', './vendor/pdf.min.mjs', './vendor/pdf.worker.min.mjs',
  './img/icon-192.png', './img/icon-512.png', './img/icon-180.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
