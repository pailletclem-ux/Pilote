/**
 * sw.js — Service worker : met l'application en cache pour un fonctionnement
 * hors ligne. Ne touche jamais aux données (elles sont dans IndexedDB).
 *
 * À chaque nouvelle version publiée, incrémenter VERSION pour forcer la mise à jour.
 */
const VERSION = 'pilote-v1';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/store.js', 'js/db.js', 'js/calc.js', 'js/format.js', 'js/presets.js', 'js/crypto.js', 'js/theme.js',
  'js/imports/index.js', 'js/imports/pdf-text.js', 'js/imports/pea-orders.js', 'js/imports/av-supports.js', 'js/imports/saxo-statement.js',
  'js/views/ui.js', 'js/views/home.js', 'js/views/account.js', 'js/views/allocation.js', 'js/views/imports.js', 'js/views/settings.js',
  'vendor/pdfjs/pdf.min.mjs', 'vendor/pdfjs/pdf.worker.min.mjs',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Fichiers de l'app : cache d'abord (hors ligne), puis réseau
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
