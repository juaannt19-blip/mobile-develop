<<<<<<< HEAD
const CACHE_NAME = "sarpras-id-cache-v2";
const BASE_URL = self.registration.scope;

const urlsToCache = [
  `${BASE_URL}`,
  `${BASE_URL}index.html`,
  `${BASE_URL}manifest.json`,
  `${BASE_URL}icons/logo1.png`,
  // Hapus assets/style.css karena CSS Anda sudah inline di dalam index.html
  // Tambahkan offline.html jika Anda memilikinya, jika tidak, hapus baris di bawah
  `${BASE_URL}offline.html`, 
];

// Install Service Worker & simpan file ke cache
self.addEventListener("install", event => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log("SarprasID: Membuka cache dan menambahkan aset");
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error("Cache gagal dimuat:", err))
  );
});

// Aktivasi dan hapus cache lama agar update langsung terasa
self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log("Menghapus cache lama SarprasID:", key);
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim(); 
    })()
  );
});

// Fetch event: Strategi Cache-First untuk aset statis
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.protocol.startsWith("chrome-extension")) return;
  if (request.method !== "GET") return;

  // Penanganan untuk file lokal/internal
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(response => {
        return (
          response ||
          fetch(request).catch(() => {
            // Jika network gagal dan file tidak ada di cache, arahkan ke index atau offline page
            if (request.mode === 'navigate') {
              return caches.match(`${BASE_URL}index.html`);
            }
          })
        );
      })
    );
  } 
  // Resource eksternal (CDN atau API jika ada) menggunakan Network-First
  else {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
  }
=======
const CACHE_NAME = "sarpras-id-cache-v2";
const BASE_URL = self.registration.scope;

const urlsToCache = [
  `${BASE_URL}`,
  `${BASE_URL}index.html`,
  `${BASE_URL}manifest.json`,
  `${BASE_URL}icons/logo1.png`,
  // Hapus assets/style.css karena CSS Anda sudah inline di dalam index.html
  // Tambahkan offline.html jika Anda memilikinya, jika tidak, hapus baris di bawah
  `${BASE_URL}offline.html`, 
];

// Install Service Worker & simpan file ke cache
self.addEventListener("install", event => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log("SarprasID: Membuka cache dan menambahkan aset");
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error("Cache gagal dimuat:", err))
  );
});

// Aktivasi dan hapus cache lama agar update langsung terasa
self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log("Menghapus cache lama SarprasID:", key);
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim(); 
    })()
  );
});

// Fetch event: Strategi Cache-First untuk aset statis
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.protocol.startsWith("chrome-extension")) return;
  if (request.method !== "GET") return;

  // Penanganan untuk file lokal/internal
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(response => {
        return (
          response ||
          fetch(request).catch(() => {
            // Jika network gagal dan file tidak ada di cache, arahkan ke index atau offline page
            if (request.mode === 'navigate') {
              return caches.match(`${BASE_URL}index.html`);
            }
          })
        );
      })
    );
  } 
  // Resource eksternal (CDN atau API jika ada) menggunakan Network-First
  else {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
  }
>>>>>>> ef275b581a4cdade0dea4ab3487d692e9bf6d995
});