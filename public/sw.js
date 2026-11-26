// ROVA Service Worker - PWA Offline Shell + Web Push Notifications & Background Reminders
const CACHE_VERSION = 'rova-pwa-v3';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
  '/rova.png',
  '/favicon.svg',
];

// Never cache live API, auth, payment, or third-party data endpoints
const NETWORK_ONLY_HOST_PATTERNS = [
  'supabase.co',
  'paystack.co',
  'paystack.com',
  'mono.co',
  'sentry.io',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined)
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests over http/https
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Always bypass cache for backend API routes & external live services
  if (
    url.pathname.startsWith('/api/') ||
    NETWORK_ONLY_HOST_PATTERNS.some((host) => url.hostname.includes(host))
  ) {
    return;
  }

  // Navigation requests (SPA routes): network-first, fallback to cached index.html, then offline.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok && url.origin === self.location.origin) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', copy)).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const cachedShell =
            (await caches.match('/index.html')) || (await caches.match('/'));
          if (cachedShell) return cachedShell;
          const offlinePage = await caches.match('/offline.html');
          return (
            offlinePage ||
            new Response('Offline - please check your connection.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            })
          );
        })
    );
    return;
  }

  // Same-origin static assets (/assets/*, /icons/*, /banks/*, images, css, js): stale-while-revalidate
  if (url.origin === self.location.origin) {
    const isStaticAsset =
      url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/icons/') ||
      url.pathname.startsWith('/banks/') ||
      /\.(?:js|css|png|jpg|jpeg|svg|webp|woff2?|ico|webmanifest)$/i.test(url.pathname);

    if (isStaticAsset) {
      event.respondWith(
        caches.open(ASSET_CACHE).then(async (cache) => {
          const cached = await cache.match(request);
          const networkPromise = fetch(request)
            .then((networkRes) => {
              if (networkRes && networkRes.ok) {
                cache.put(request, networkRes.clone()).catch(() => {});
              }
              return networkRes;
            })
            .catch(() => cached);

          return cached || networkPromise;
        })
      );
    }
  }
});

// Listen for incoming Web Push events from VAPID server
self.addEventListener('push', (event) => {
  let data = {
    title: 'ROVA Transaction Reminder',
    body: "Time to record today's sales, expenses, and categorise pending transactions.",
    icon: '/icons/icon-192x192.png',
    badge: '/favicon.svg',
    url: '/app/transactions',
    tag: 'rova-transaction-reminder',
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      const text = event.data.text();
      if (text) {
        data.body = text;
      }
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/favicon.svg',
    vibrate: [250, 100, 250],
    tag: data.tag || 'rova-reminder-tag',
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || '/app/transactions',
      dateOfArrival: Date.now(),
    },
    actions: [
      { action: 'open_transactions', title: 'Open Transactions' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle clicking on the lock-screen or banner notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl =
    (event.notification.data && event.notification.data.url) || '/app/transactions';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open with the app, focus it
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && 'focus' in client) {
            return client.focus();
          }
        }
        // If no matching window, open a new window/tab
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// Handle direct messages from client app
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  // 1. Show notification immediately
  if (event.data.type === 'ROVA_SHOW_NOTIFICATION') {
    const { title, body, url, tag } = event.data;
    const options = {
      body: body || "Don't forget to update your daily transactions.",
      icon: '/icons/icon-192x192.png',
      badge: '/favicon.svg',
      vibrate: [250, 100, 250],
      tag: tag || 'rova-local-reminder',
      renotify: true,
      requireInteraction: false,
      data: {
        url: url || '/app/transactions',
        dateOfArrival: Date.now(),
      },
      actions: [
        { action: 'open_transactions', title: 'Open Transactions' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    };
    event.waitUntil(self.registration.showNotification(title || 'ROVA Reminder', options));
  }

  // 2. Schedule background notification (keeps service worker alive until delay expires even when tab closes!)
  if (event.data.type === 'ROVA_SCHEDULE_NOTIFICATION') {
    const { delayMs = 10000, title, body, url } = event.data;
    const scheduledPromise = new Promise((resolve) => {
      setTimeout(async () => {
        try {
          await self.registration.showNotification(
            title || 'ROVA Daily Reminder (Closed-Site Alert)',
            {
              body:
                body ||
                'Success! Lock-screen alert received while ROVA was completely closed.',
              icon: '/icons/icon-192x192.png',
              badge: '/favicon.svg',
              vibrate: [300, 150, 300],
              tag: 'rova-scheduled-alert',
              renotify: true,
              requireInteraction: true,
              data: {
                url: url || '/app/transactions',
                dateOfArrival: Date.now(),
              },
              actions: [
                { action: 'open_transactions', title: 'Open Transactions' },
                { action: 'dismiss', title: 'Dismiss' },
              ],
            }
          );
        } catch (e) {
          console.error('Scheduled notification failed:', e);
        }
        resolve();
      }, delayMs);
    });

    event.waitUntil(scheduledPromise);
  }
});
