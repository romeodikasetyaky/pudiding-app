// Install Service Worker
self.addEventListener('install', evt => {
    console.log('Service worker terinstal');
    self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', evt => {
    console.log('Service worker aktif');
});

// Fetch event (Dibiarkan default agar web selalu memuat data terbaru)
self.addEventListener('fetch', evt => {
    evt.respondWith(fetch(evt.request).catch(() => {
        return new Response('Anda sedang offline.');
    }));
});