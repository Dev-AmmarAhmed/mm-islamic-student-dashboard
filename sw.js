const CACHE_NAME = "mm-islamic-erp-v1";

// Install Event - Turant active karne ke liye
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activate Event - Purana cache clean karne ke liye
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event (PWA Install Prompt ke liye ye zaroori hota hai)
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// In-App Notification Click Handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow("./index.html");
    })
  );
});
