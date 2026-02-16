const CACHE_NAME = "Tucks_v2.1";
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

