const CACHE_NAME = "mm-islamic-erp-v2";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json"
];

// 1. INSTALL: App ki main files ko offline chalne ke liye save karna
self.addEventListener("install", (event) => {
  self.skipWaiting(); // Naya update aate hi turant install karega
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. ACTIVATE: Purana cache delete karke naya version lagu karna
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

// 3. FETCH: Network-First Strategy (Hamesha fresh data dikhayega, aur internet band hone par Offline khulega)
self.addEventListener("fetch", (event) => {
  // Firebase, Google Scripts ya POST requests ko chhod kar sirf GET requests handle karein
  if (
    event.request.method !== "GET" ||
    event.request.url.includes("firebaseio.com") ||
    event.request.url.includes("googleapis.com") ||
    event.request.url.includes("script.google.com")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Jab internet chalu ho, toh nayi copy cache mein update kar lo
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // Jab internet band ho (Offline Mode), toh saved cache se app khol do
        return caches.match(event.request);
      })
  );
});

// 4. NOTIFICATION CLICK: Notification par tap karne se sidha app khulegi
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("./index.html");
    })
  );
});
