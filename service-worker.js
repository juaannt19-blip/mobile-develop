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
});


// ============================================================
// BACKGROUND SYNC
// ============================================================
// Menangani antrian request yang gagal saat offline.
// Cara pakai di sisi client:
//   navigator.serviceWorker.ready.then(sw => sw.sync.register('sync-sarpras-data'));
// Data yang ingin disinkronkan disimpan terlebih dahulu di IndexedDB,
// lalu dikirim ulang di sini ketika koneksi pulih.

self.addEventListener("sync", event => {
  console.log("SarprasID: Background Sync dipicu, tag:", event.tag);

  if (event.tag === "sync-sarpras-data") {
    event.waitUntil(syncPendingData());
  }
});

async function syncPendingData() {
  try {
    // Buka IndexedDB untuk mengambil data yang tertunda
    const db = await openIndexedDB();
    const pendingItems = await getAllPendingItems(db);

    if (pendingItems.length === 0) {
      console.log("SarprasID: Tidak ada data tertunda untuk disinkronkan.");
      return;
    }

    for (const item of pendingItems) {
      try {
        const response = await fetch(`${BASE_URL}api/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.data),
        });

        if (response.ok) {
          await deletePendingItem(db, item.id);
          console.log("SarprasID: Data berhasil disinkronkan, id:", item.id);
        } else {
          console.warn("SarprasID: Server menolak data, id:", item.id, "status:", response.status);
        }
      } catch (err) {
        console.error("SarprasID: Gagal mengirim item, akan dicoba lagi nanti:", err);
        // Lempar error agar Background Sync menjadwal ulang percobaan
        throw err;
      }
    }
  } catch (err) {
    console.error("SarprasID: syncPendingData gagal:", err);
    throw err;
  }
}


// ============================================================
// PUSH NOTIFICATIONS
// ============================================================
// Menangani notifikasi push dari server.
// Server harus mengirim payload JSON dengan format:
//   { title: "...", body: "...", icon: "...", url: "..." }
// Cara subscribe di client:
//   const sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(PUBLIC_VAPID_KEY) });
//   // Kirim `sub` ke server untuk disimpan

self.addEventListener("push", event => {
  console.log("SarprasID: Push notification diterima.");

  let payload = {
    title: "SarprasID",
    body: "Ada informasi baru untuk Anda.",
    icon: `${BASE_URL}icons/logo1.png`,
    badge: `${BASE_URL}icons/logo1.png`,
    url: BASE_URL,
  };

  if (event.data) {
    try {
      const data = event.data.json();
      payload = { ...payload, ...data };
    } catch {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    data: { url: payload.url },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// Menangani klik pada notifikasi push
self.addEventListener("notificationclick", event => {
  console.log("SarprasID: Notifikasi diklik.");
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : BASE_URL;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      // Jika tab sudah terbuka, fokuskan tab tersebut
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      // Jika tidak ada tab yang terbuka, buka tab baru
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});


// ============================================================
// PERIODIC BACKGROUND SYNC
// ============================================================
// Menjalankan tugas terjadwal secara berkala (misal: prefetch konten terbaru).
// Cara registrasi di client:
//   const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
//   if (status.state === 'granted') {
//     await registration.periodicSync.register('refresh-sarpras-content', { minInterval: 24 * 60 * 60 * 1000 });
//   }
// Catatan: Periodic Sync hanya berjalan di browser yang mendukung
//   (Chromium-based) dan memerlukan izin pengguna.

self.addEventListener("periodicsync", event => {
  console.log("SarprasID: Periodic Sync dipicu, tag:", event.tag);

  if (event.tag === "refresh-sarpras-content") {
    event.waitUntil(refreshContent());
  }
});

async function refreshContent() {
  try {
    console.log("SarprasID: Memperbarui konten di latar belakang...");
    const cache = await caches.open(CACHE_NAME);

    // Daftar URL yang ingin di-refresh secara berkala
    const urlsToRefresh = [
      `${BASE_URL}`,
      `${BASE_URL}index.html`,
    ];

    await Promise.all(
      urlsToRefresh.map(async url => {
        try {
          const response = await fetch(url, { cache: "no-store" });
          if (response.ok) {
            await cache.put(url, response);
            console.log("SarprasID: Konten diperbarui:", url);
          }
        } catch (err) {
          console.warn("SarprasID: Gagal memperbarui:", url, err);
        }
      })
    );
  } catch (err) {
    console.error("SarprasID: refreshContent gagal:", err);
  }
}


// ============================================================
// HELPER: IndexedDB untuk Background Sync
// ============================================================

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("sarpras-sync-db", 1);

    request.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("pending-items")) {
        db.createObjectStore("pending-items", { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = e => resolve(e.target.result);
    request.onerror = e => reject(e.target.error);
  });
}

function getAllPendingItems(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending-items", "readonly");
    const store = tx.objectStore("pending-items");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = e => reject(e.target.error);
  });
}

function deletePendingItem(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending-items", "readwrite");
    const store = tx.objectStore("pending-items");
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = e => reject(e.target.error);
  });
}