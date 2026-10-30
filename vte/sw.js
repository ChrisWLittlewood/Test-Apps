// Offline cache for the app shell. Bump VERSION whenever files change.
const VERSION = 'vte-v2.8.1';
const FILES = [
  './', './index.html', './styles.css', './app.js', './checklist.js', './dm.js', './launch.js', './report.js', './pipedims.js', './pipeclasses.js', './ech.js', './viewer.js', './isotool.js', './pdfview.js', './tools.js', './face.js', './refs.js', './xray.js', './help.js', './echbulk.js', './prepdrop.js', './pidapp.js',
  './manifest.webmanifest', './vendor/docx.js', './vendor/jszip.min.js', './vendor/pdf.min.mjs', './vendor/pdf.worker.min.mjs',
  './img/icon-192.png', './img/icon-512.png', './img/icon-180.png', './img/imsnt-192.png'
];
// cache: 'reload' bypasses the browser's HTTP cache so a new version never stores stale copies of the old files
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'version') e.source.postMessage({ version: VERSION }); });
const put = (req, res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; };
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  const fromCache = () => caches.match(req, { ignoreSearch: true }).then(h => h || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
  // big libraries and images: cache first
  if (/\/vendor\/|\/img\//.test(url.pathname)) { e.respondWith(caches.match(req, { ignoreSearch: true }).then(h => h || fetch(req).then(r => put(req, r)))); return; }
  // app files: network first (so updates show straight away when there is signal), cache if offline or slow
  e.respondWith(new Promise(resolve => {
    let done = false; const fin = r => { if (!done) { done = true; resolve(r); } };
    const t = setTimeout(() => fromCache().then(fin), 3000);
    fetch(req, { cache: 'no-cache' }).then(r => { clearTimeout(t); fin(put(req, r)); }).catch(() => { clearTimeout(t); fromCache().then(fin); });
  }));
});
