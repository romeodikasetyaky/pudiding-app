<<<<<<< HEAD
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
=======
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
>>>>>>> 0785fa1c68e95eae495436e1c6c9db8b1ca1d04b
});