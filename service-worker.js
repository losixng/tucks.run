const CACHE_NAME = "Tucks_v2.2";
const urlsToCache = [
  "/",
  "/index.html",
  "/offline.html",
  "/home.html",
  "/food.html",
  "/cart.html",
  "/profile.html",
  "/order.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// Install Service Worker
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});


// Fetch from Cache + Network + Offline Page
self.addEventListener("fetch", event => {

  event.respondWith(

    caches.match(event.request).then(response => {

      // If file exists in cache
      if (response) {
        return response;
      }

      // Cache Images Automatically
  if (event.request.destination === "image") {

    event.respondWith(
      caches.open("image-cache").then(cache => {

        return cache.match(event.request).then(response => {

          return response || fetch(event.request).then(networkResponse => {

            cache.put(event.request, networkResponse.clone());
            return networkResponse;

          });

        });

      })
    );

    return;
  }

      // Try network
      return fetch(event.request).catch(() => {

        // If network fails show offline page
        return caches.match("/offline.html");

      });

    })

  );

});

/* Firebase Messaging background handler - show notifications when message arrives */
self.addEventListener('push', function(event) {
  try {
    const payload = event.data ? event.data.json() : null;
    const title = payload && payload.notification && payload.notification.title ? payload.notification.title : 'Tucks';
    const body = payload && payload.notification && payload.notification.body ? payload.notification.body : (payload && payload.body) || '';
    const options = {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: payload && payload.data ? payload.data : {}
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.warn('push handler error', e);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/home.html';
  event.waitUntil(clients.matchAll({ type: 'window' }).then(windowClients => {
    for (let client of windowClients) {
      if (client.url === url && 'focus' in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});

