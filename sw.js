// ============================================
// ValeurFin Service Worker v2.1
// Enables offline support + caching
// © 2026 ValeurFin Technologies
// ============================================

const CACHE_NAME = 'valeurfin-v2.1';

// Files to cache for offline use
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './valeurfin-mobile.html',
  './manifest.json',
  './logo.png',
  './logo-192.png',
  './logo-512.png'
];

// ===== INSTALL =====
// Cache all essential files when service worker installs
self.addEventListener('install', function(event) {
  console.log('[ValeurFin SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('[ValeurFin SW] Caching app files');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(function() {
        console.log('[ValeurFin SW] Install complete');
      })
  );
  // Activate immediately without waiting
  self.skipWaiting();
});

// ===== ACTIVATE =====
// Clean up old caches when new version activates
self.addEventListener('activate', function(event) {
  console.log('[ValeurFin SW] Activating...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) {
            // Delete any cache that isn't our current version
            return name !== CACHE_NAME;
          })
          .map(function(name) {
            console.log('[ValeurFin SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// ===== FETCH =====
// Intercept network requests — serve from cache first, then network
self.addEventListener('fetch', function(event) {
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip external API calls (like MFAPI for mutual fund search)
  // These should always go to network
  if (event.request.url.includes('api.mfapi.in')) {
    event.respondWith(
      fetch(event.request).catch(function() {
        // If API fails, return empty JSON
        return new Response(JSON.stringify([]), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }
  
  // For our app files: Cache First, then Network
  event.respondWith(
    caches.match(event.request)
      .then(function(cachedResponse) {
        
        // If found in cache, return it
        if (cachedResponse) {
          // Also fetch from network in background to update cache
          fetch(event.request).then(function(networkResponse) {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then(function(cache) {
                cache.put(event.request, networkResponse);
              });
            }
          }).catch(function() {
            // Network failed, that's OK — we have cache
          });
          
          return cachedResponse;
        }
        
        // Not in cache — try network
        return fetch(event.request)
          .then(function(networkResponse) {
            // Cache the new response for next time
            if (networkResponse && networkResponse.status === 200) {
              var responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then(function(cache) {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(function() {
            // Both cache and network failed
            // If it's a page request, show the mobile app as fallback
            if (event.request.destination === 'document') {
              return caches.match('./valeurfin-mobile.html');
            }
            // For other requests, return nothing
            return new Response('', {
              status: 408,
              statusText: 'Offline'
            });
          });
      })
  );
});

// ===== BACKGROUND SYNC (Future) =====
// Placeholder for future features like syncing data
self.addEventListener('sync', function(event) {
  console.log('[ValeurFin SW] Background sync:', event.tag);
});

// ===== PUSH NOTIFICATIONS (Future) =====
// Placeholder for future push notification support
self.addEventListener('push', function(event) {
  if (event.data) {
    var data = event.data.json();
    self.registration.showNotification(data.title || 'ValeurFin', {
      body: data.body || 'You have an update',
      icon: './logo-192.png',
      badge: './logo-192.png',
      vibrate: [200, 100, 200]
    });
  }
});