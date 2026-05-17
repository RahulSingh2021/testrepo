// v25 — Fixed haccp_observation_followup variable order to match approved Meta template
// (PWA-mode share now downloads the image and hands off to WhatsApp via
// deep-link instead of using navigator.share, which fails inside an
// Android standalone PWA with "Can't send empty message").
const CACHE_NAME = 'haccp-pro-cache-v27';
const ASSETS_TO_CACHE = [
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) {
              return caches.delete(cache);
            }
          })
        );
      })
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  let url;
  try { url = new URL(req.url); } catch { return; }

  // Never intercept anything we shouldn't be caching. Letting these
  // pass through to the browser's default handling avoids the
  // `respondWith(undefined)` failure mode that surfaced as
  // "TypeError: Failed to fetch" in the page.
  if (
    req.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/__nextjs') ||
    url.pathname.endsWith('/sw.js')
  ) {
    return;
  }

  // Document / navigation requests: network-first, fall back to the
  // cached shell only when we actually have one.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req).catch(async () => {
        const cached = await caches.match('/');
        return cached || new Response('', { status: 504, statusText: 'Offline' });
      })
    );
    return;
  }

  // Static assets: network-first, populate the cache on success, fall
  // back to a cached copy if one exists. Always return a real Response.
  event.respondWith(
    fetch(req).then((response) => {
      if (response && response.status === 200 && response.type === 'basic') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(req);
      return cached || new Response('', { status: 504, statusText: 'Offline' });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, data, icon } = event.data;
    self.registration.showNotification(title, {
      body: body || '',
      icon: icon || '/logo-192.png',
      badge: '/logo-192.png',
      tag: tag || 'haccp-' + Date.now(),
      vibrate: [200, 100, 200],
      requireInteraction: false,
      data: data || {},
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    });
  }
});

self.addEventListener('push', (event) => {
  let payload = { title: 'HACCP PRO', body: 'New notification' };
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'HACCP PRO', {
      body: payload.body || '',
      icon: payload.icon || '/logo-192.png',
      badge: '/logo-192.png',
      tag: payload.tag || 'haccp-push-' + Date.now(),
      vibrate: [200, 100, 200],
      data: payload.data || {},
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
