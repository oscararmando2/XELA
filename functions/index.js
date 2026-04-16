// Firebase Cloud Functions — Xela Tortillería
// Sends FCM V1 push notifications via Firebase Admin SDK
// Triggered by Firestore document events
// Deployment: triggered via GitHub Actions using FIREBASE_TOKEN secret

'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// ---- Helper: retrieve all FCM tokens from the configuracion collection ----
// Returns { tokens: string[], docsByToken: Map<string, DocumentReference> }
async function getAllFCMTokens() {
  try {
    const snapshot = await admin.firestore().collection('configuracion').get();
    const tokens = [];
    const docsByToken = new Map();
    snapshot.forEach((doc) => {
      const token = doc.data().fcmToken;
      if (token) {
        tokens.push(token);
        docsByToken.set(token, doc.ref);
      }
    });
    return { tokens, docsByToken };
  } catch (e) {
    console.error('Failed to read FCM tokens:', e);
    return { tokens: [], docsByToken: new Map() };
  }
}

// ---- Helper: send a push notification to all registered tokens ----
async function sendNotification(tokensResult, title, body) {
  const { tokens, docsByToken } = tokensResult;
  if (!tokens || tokens.length === 0) {
    console.log('No FCM tokens stored — skipping notification.');
    return;
  }
  const message = {
    tokens,
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
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`Notifications sent: ${response.successCount} succeeded, ${response.failureCount} failed.`);

    // Remove stale tokens that are no longer valid
    if (response.failureCount > 0) {
      const staleSet = new Set();
      response.responses.forEach((res, idx) => {
        if (!res.success) {
          const code = res.error && res.error.code;
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            staleSet.add(tokens[idx]);
          }
        }
      });
      if (staleSet.size > 0) {
        const db = admin.firestore();
        const batch = db.batch();
        staleSet.forEach((staleToken) => {
          const ref = docsByToken.get(staleToken);
          if (ref) batch.delete(ref);
        });
        await batch.commit();
        console.log(`Removed ${staleSet.size} stale token(s).`);
      }
    }
  } catch (e) {
    console.error('Failed to send notifications:', e);
  }
}

// ---- 1. New sale: "Venta registrada — [producto] x[cantidad] — $[total]" ----
exports.onNewSale = functions.firestore
  .document('ventas/{saleId}')
  .onCreate(async (snap) => {
    const sale = snap.data();
    const tokens = await getAllFCMTokens();
    const productName = (sale.productName || '').replace('Tortilla de ', '');
    const qty = sale.qty || 0;
    const total = parseFloat(sale.total || 0).toFixed(2);
    await sendNotification(
      tokens,
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
    const tokens = await getAllFCMTokens();
    await sendNotification(
      tokens,
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

    const tokens = await getAllFCMTokens();

    if (after.status === 'entregado') {
      // "Entrega completada — [cliente] en [dirección]"
      await sendNotification(
        tokens,
        'Entrega completada',
        `${after.clientName || 'Cliente'} en ${after.clientAddress || 'Sin dirección'}`
      );
    } else if (after.status === 'cancelado') {
      // "Pedido cancelado — [cliente] — [motivo]"
      const motivo = after.cancelReason ? ` — ${after.cancelReason}` : '';
      await sendNotification(
        tokens,
        'Pedido cancelado',
        `${after.clientName || 'Cliente'}${motivo}`
      );
    }
  });

