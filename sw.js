var CACHE_NAME = 'valeurfin-v4';
var urlsToCache = [
  './',
  './index.html',
  './valeurfin-mobile.html',
  './logo.png',
  './manifest.json'
];

// Install
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) { return name !== CACHE_NAME; })
             .map(function(name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', function(event) {
  // Skip non-GET and external API requests
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('yahoo.com')) return;
  if (event.request.url.includes('mfapi.in')) return;
  if (event.request.url.includes('tradingview.com')) return;
  if (event.request.url.includes('googleapis.com')) return;
  if (event.request.url.includes('corsproxy.io')) return;
  if (event.request.url.includes('allorigins.win')) return;

  event.respondWith(
    fetch(event.request).then(function(response) {
      // Cache successful responses
      if (response && response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(function() {
      // Offline — serve from cache
      return caches.match(event.request);
    })
  );
});
