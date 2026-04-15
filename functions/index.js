// Firebase Cloud Functions — Xela Tortillería
// Sends FCM V1 push notifications via Firebase Admin SDK
// Triggered by Firestore document events

'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// ---- Helper: retrieve saved FCM token from Firestore ----
async function getFCMToken() {
  try {
    const doc = await admin.firestore().collection('configuracion').doc('notificaciones').get();
    return doc.exists ? (doc.data().fcmToken || null) : null;
  } catch (e) {
    console.error('Failed to read FCM token:', e);
    return null;
  }
}

// ---- Helper: send a push notification via FCM V1 API (Admin SDK) ----
async function sendNotification(token, title, body) {
  if (!token) {
    console.log('No FCM token stored — skipping notification.');
    return;
  }
  const message = {
    token,
    notification: { title, body },
    // iOS-specific options for lock-screen display
    apns: {
      payload: {
        aps: {
          alert: { title, body },
          sound: 'default',
          badge: 1,
        },
      },
    },
    // Android options
    android: {
      priority: 'high',
      notification: { sound: 'default' },
    },
    // Web push options
    webpush: {
      notification: {
        icon: '/icon-192.png',
        requireInteraction: false,
      },
    },
  };
  try {
    const response = await admin.messaging().send(message);
    console.log('Notification sent:', response);
  } catch (e) {
    console.error('Failed to send notification:', e);
  }
}

// ---- 1. New sale: "Venta registrada — [producto] x[cantidad] — $[total]" ----
exports.onNewSale = functions.firestore
  .document('ventas/{saleId}')
  .onCreate(async (snap) => {
    const sale = snap.data();
    const token = await getFCMToken();
    const productName = (sale.productName || '').replace('Tortilla de ', '');
    const qty = sale.qty || 0;
    const total = parseFloat(sale.total || 0).toFixed(2);
    await sendNotification(
      token,
      'Venta registrada',
      `${productName} x${qty} — $${total}`
    );
  });

// ---- 2. New delivery order: "Nuevo pedido a domicilio — [cliente] — [dirección]" ----
exports.onNewOrder = functions.firestore
  .document('pedidos/{orderId}')
  .onCreate(async (snap) => {
    const order = snap.data();
    if (order.status !== 'pendiente') return;
    const token = await getFCMToken();
    await sendNotification(
      token,
      'Nuevo pedido a domicilio',
      `${order.clientName || 'Cliente'} — ${order.clientAddress || 'Sin dirección'}`
    );
  });

// ---- 3. Order status change: delivered or cancelled ----
exports.onOrderStatusChange = functions.firestore
  .document('pedidos/{orderId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    // Only act when the status field actually changes
    if (before.status === after.status) return;

    const token = await getFCMToken();

    if (after.status === 'entregado') {
      // "Entrega completada — [cliente] en [dirección]"
      await sendNotification(
        token,
        'Entrega completada',
        `${after.clientName || 'Cliente'} en ${after.clientAddress || 'Sin dirección'}`
      );
    } else if (after.status === 'cancelado') {
      // "Pedido cancelado — [cliente] — [motivo]"
      const motivo = after.cancelReason ? ` — ${after.cancelReason}` : '';
      await sendNotification(
        token,
        'Pedido cancelado',
        `${after.clientName || 'Cliente'}${motivo}`
      );
    }
  });
