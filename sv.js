// Updated Service Worker - Cache Busting & Auto Update
const CACHE_NAME = 'mm-islamic-v2'; // Cache version updated to v2

const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// Install Event
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Naye service worker ko turant activate karein
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

// Activate Event - Purane Cache (v1) ko delete karne ke liye
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache); // Purana v1 cache clear ho jayega
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-First Strategy: Pehle internet se naya code layega, fail hone par cache use karega
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Agar net se naye files mil gaye toh cache update kar lo
        if (event.request.method === 'GET' && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request)) // Network fail hone par hi cache se uthayega
  );
});
