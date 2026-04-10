// ValeurFin v4.0 — Service Worker
// Strategy: Network-First with offline fallback
// Cache name — increment suffix (v4c → v4d) when pushing updates
// to force old caches to be deleted on next visit

var CACHE_NAME = 'valeurfin-v4c';

// Files to cache for offline use
var CACHE_FILES = [
  './',
  './index.html',
  './valeurfin-mobile.html',
  './manifest.json'
  // logo.png intentionally excluded — if missing, would fail Promise.allSettled
  // and break the entire service worker installation
];

// Never cache these — always fetch fresh (API endpoints, external scripts)
var SKIP_CACHE_PATTERNS = [
  'yahoo.com',
  'mfapi.in',
  'tradingview.com',
  'googleapis.com',
  'corsproxy.io',
  'allorigins.win',
  'generativelanguage',
  'cdn-cgi',
  'cloudflare'
];

function shouldSkipCache(url) {
  return SKIP_CACHE_PATTERNS.some(function(p) { return url.indexOf(p) !== -1; });
}

// ── INSTALL ──────────────────────────────────────────────────────────────────
// Use Promise.allSettled (NOT Promise.all) so that if one file fails to cache
// (e.g. valeurfin-mobile.html not yet uploaded), the SW still installs cleanly.
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.allSettled(
        CACHE_FILES.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[SW] Failed to cache:', url, err);
          });
        })
      );
    }).then(function() {
      // Activate immediately — don't wait for old SW to expire
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
// Delete all old caches except the current one
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    }).then(function() {
      // Take control of all open clients immediately
      return self.clients.claim();
    })
  );
});

// ── FETCH ─────────────────────────────────────────────────────────────────────
// Network-First strategy:
//   1. Try network — if success, update cache and return response
//   2. If network fails (offline) — return cached version
//   3. If neither — return a minimal offline fallback response
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API endpoints and external scripts — always fresh, never cached
  if (shouldSkipCache(url)) return;

  // Skip chrome-extension and non-http URLs
  if (!url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then(function(networkResponse) {
        // Network success — clone and store in cache for offline use
        if (networkResponse && networkResponse.status === 200) {
          var responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(function() {
        // Network failed — try cache
        return caches.match(event.request).then(function(cached) {
          if (cached) return cached;
          // Nothing in cache — return minimal offline page
          if (event.request.headers.get('accept') &&
              event.request.headers.get('accept').indexOf('text/html') !== -1) {
            return new Response(
              '<!DOCTYPE html><html><head><meta charset="UTF-8">'
              + '<meta name="viewport" content="width=device-width,initial-scale=1">'
              + '<title>ValeurFin — Offline</title>'
              + '<style>body{font-family:sans-serif;background:#0f0f23;color:#e0e0e0;'
              + 'display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}'
              + 'h1{color:#6C5CE7;font-size:28px}p{color:#a0a0b0;font-size:14px}'
              + 'button{margin-top:20px;padding:12px 24px;background:#6C5CE7;color:#fff;'
              + 'border:none;border-radius:10px;font-size:14px;cursor:pointer}</style>'
              + '</head><body>'
              + '<div><h1>ValeurFin</h1>'
              + '<p>You appear to be offline.<br>Your data is safe on this device.</p>'
              + '<button onclick="location.reload()">Try Again</button></div>'
              + '</body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          }
          return new Response('', { status: 503 });
        });
      })
  );
});

// ── MESSAGE ───────────────────────────────────────────────────────────────────
// Allow the app to trigger a cache update on demand
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CACHE_URLS') {
    var urls = event.data.urls || [];
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(urls);
    });
  }
});
