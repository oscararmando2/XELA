// Service Worker v2 - Safari Web Push
// Firebase Cloud Messaging Service Worker
// Handles background push notifications for Xela Tortillería Sistema Interno

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyA5orV2cj41j6YZHi7Tn-fX62rM3zOLUfI',
  authDomain: 'xela-8a91d.firebaseapp.com',
  projectId: 'xela-8a91d',
  storageBucket: 'xela-8a91d.firebasestorage.app',
  messagingSenderId: '1024661076424',
  appId: '1:1024661076424:web:f889b065e1afb1c2cfe8fd',
});

const messaging = firebase.messaging();

// Handle FCM messages received while the app is in the background or closed
// (Chrome / non-Safari browsers)
messaging.onBackgroundMessage(function (payload) {
  const title = (payload.notification && payload.notification.title) || 'Xela Tortillería';
  const body = (payload.notification && payload.notification.body) || '';
  return self.registration.showNotification(title, {
    body: body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data || {},
    requireInteraction: false,
  });
});

// Handle native Web Push `push` events for Safari (iOS 16.4+ / macOS Ventura+).
// Safari sends a standard Web Push event — the FCM onBackgroundMessage handler
// above is NOT triggered for these, so we intercept the raw event here.
self.addEventListener('push', function (event) {
  // If the event was already handled by the Firebase SDK (Chrome/non-Safari),
  // it will not have a JSON text body with our custom fields.
  // We only act when the payload looks like a plain Web Push message.
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch (parseErr) {
    console.warn('[WebPush] push event payload is not JSON, treating as plain text:', parseErr);
    data = { notification: { title: 'Xela Tortillería', body: event.data.text() } };
  }

  const notification = data.notification || {};
  const title = notification.title || 'Xela Tortillería';
  const body = notification.body || '';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data.data || {},
      requireInteraction: false,
    })
  );
});
