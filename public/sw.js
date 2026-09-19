// Vite replaces this token with the immutable release SHA during production builds.
const BUILD_ID = '__TAKOSAN_BUILD_ID__';
const CACHE_NAME = `takosan-pwa-${BUILD_ID}`;

const STATIC_PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/takosan/app-icons/favicon.svg',
  '/takosan/app-icons/icon-192.png',
  '/takosan/app-icons/icon-512.png',
  '/takosan/brand/takosan-logo-horizontal-primary.svg',
  '/takosan/brand/takosan-symbol.svg',
  '/takosan/mascot/takosan-neutral.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      const previousReleaseCaches = keys.filter(
        (key) => key.startsWith('takosan-pwa-') && key !== CACHE_NAME
      );

      await Promise.all(previousReleaseCaches.map((key) => caches.delete(key)));
      await self.clients.claim();

      if (previousReleaseCaches.length > 0) {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const sameOriginWindows = windows.filter(
          (client) => new URL(client.url).origin === self.location.origin
        );

        // Navigation cannot be awaited from activate: the new document fetch may wait
        // for activation to finish. Start it only after cache cleanup and client claim.
        sameOriginWindows.forEach((client) => {
          void client.navigate(client.url).catch((err) => {
            console.warn('Failed to refresh an existing client:', err);
          });
        });
      }
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Static assets (images, fonts, css, js): Cache first, fallback to network
  if (
    url.pathname.startsWith('/frigo/') ||
    url.pathname.startsWith('/takosan/') ||
    url.pathname.startsWith('/assets/') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('fonts.googleapis.com')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            return caches.open(CACHE_NAME)
              .then((cache) => cache.put(request, copy))
              .catch((err) => console.warn('Failed to cache static asset:', err))
              .then(() => networkResponse);
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Navigation requests: Network first, fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            return caches.open(CACHE_NAME)
              .then((cache) => cache.put('/index.html', copy))
              .catch((err) => console.warn('Failed to refresh app shell:', err))
              .then(() => response);
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Default: Network with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});
