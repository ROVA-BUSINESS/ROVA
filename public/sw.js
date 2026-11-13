// ROVA Service Worker - Web Push Notifications & Background Reminders (100% Free / $0)
const CACHE_NAME = 'rova-sw-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for incoming Web Push events from VAPID server
self.addEventListener('push', (event) => {
  let data = {
    title: 'ROVA Transaction Reminder',
    body: "Time to record today's sales, expenses, and categorise pending transactions.",
    icon: '/rova.png',
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
    icon: data.icon || '/rova.png',
    badge: data.badge || '/favicon.svg',
    vibrate: [200, 100, 200],
    tag: data.tag || 'rova-reminder-tag',
    renotify: true,
    requireInteraction: false,
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

// Handle direct message from client app to display system notification via Service Worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'ROVA_SHOW_NOTIFICATION') {
    const { title, body, url, tag } = event.data;
    const options = {
      body: body || "Don't forget to update your daily transactions.",
      icon: '/rova.png',
      badge: '/favicon.svg',
      vibrate: [200, 100, 200],
      tag: tag || 'rova-local-reminder',
      renotify: true,
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
});
