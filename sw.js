const CACHE_NAME = 'medattend-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  'https://fonts.googleapis.com/icon?family=Material+Icons+Round',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', event => {
  // Try network first, fall back to cache for offline support
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
