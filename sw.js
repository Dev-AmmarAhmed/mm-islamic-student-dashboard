/**
 * ====================================================================
 * SERVICE WORKER (sw.js)
 * M.M ISLAMIC ENGLISH SCHOOL ERP
 * ====================================================================
 */

const CACHE_NAME = "mm-islamic-erp-cache-v3";
const ICON_PATH = "https://raw.githubusercontent.com/Dev-AmmarAhmed/mm-islamic-student-dashboard/d6d24f3e257c37e211f227d935af222dd37de7ca/icon%20blue.png";

// Static assets jo offline mode me turant load hone chahiye
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./igris.js"
];

// --- INSTALL EVENT ---
self.addEventListener("install", (event) => {
  // Purane service worker ko wait karwaye bina naye ko turant activate karein
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("Pre-cache warning:", err);
      });
    })
  );
});

// --- ACTIVATE EVENT (CACHE CLEANUP) ---
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("🧹 Purana cache saaf kiya ja raha hai:", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// --- FETCH EVENT (STALE-WHILE-REVALIDATE / NETWORK FIRST) ---
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Firebase API, Google Auth, Firestore, aur CDN calls ko normal network se jaane dein (Igris handle karega)
  if (
    url.origin.includes("firebaseio.com") ||
    url.origin.includes("firestore.googleapis.com") ||
    url.origin.includes("identitytoolkit") ||
    url.origin.includes("gstatic.com") ||
    event.request.method !== "GET"
  ) {
    return;
  }

  // App ke apne static files ke liye Network-first strategy
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Network fail hone par cache se le aao
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
      })
  );
});

// --- PUSH NOTIFICATION RECEIVE ---
self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "School Notification", body: event.data.text() };
    }
  }

  const title = data.title || "M.M Islamic School";
  const options = {
    body: data.body || "New update available.",
    icon: ICON_PATH,
    badge: ICON_PATH,
    vibrate: [200, 100, 200, 100, 200],
    data: data.url || "./",
    requireInteraction: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// --- NOTIFICATION CLICK ACTION ---
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Agar app pehle se open hai toh uspe focus karein
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      // Warna naya window kholein
      if (clients.openWindow) {
        return clients.openWindow("./");
      }
    })
  );
});
