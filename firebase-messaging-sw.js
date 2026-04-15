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

// Handle messages received while the app is in the background or closed
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
