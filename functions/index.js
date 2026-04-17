// Firebase Cloud Functions — Xela Tortillería
// Sends push notifications via Firebase Admin SDK (FCM) and web-push (Safari)
// Triggered by Firestore document events
// Deployment: triggered via GitHub Actions using FIREBASE_TOKEN secret

'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const webpush = require('web-push');

admin.initializeApp();

// VAPID credentials — used for native Web Push (Safari iOS / macOS)
webpush.setVapidDetails(
  'mailto:xelatortillas@gmail.com',
  'BCXgc4b0uTff3ZabmF7Ev7eSeV0r151SKUxv5sb-ZlX1Gl4A5-dtexrywrJrCCngyleRgXBLvfbMEBGtNuFiRVU',
  'wQ__xtSnwRUfpahButNjkqHXoaOwzFAcd4pl_P8nraM'
);

// ---- Helper: retrieve all push subscriptions from the configuracion collection ----
// Returns:
//   fcmTokens     – { tokens: string[], docsByToken: Map<string, DocumentReference> }
//   safariSubs    – Array<{ endpoint, p256dh, auth, ref: DocumentReference }>
async function getAllSubscriptions() {
  try {
    const snapshot = await admin.firestore().collection('configuracion').get();
    const tokens = [];
    const docsByToken = new Map();
    const safariSubs = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.type === 'safari') {
        if (data.endpoint && data.p256dh && data.auth) {
          safariSubs.push({
            endpoint: data.endpoint,
            p256dh: data.p256dh,
            auth: data.auth,
            ref: doc.ref,
          });
        }
      } else {
        const token = data.fcmToken;
        if (token) {
          tokens.push(token);
          docsByToken.set(token, doc.ref);
        }
      }
    });

    return { fcmTokens: { tokens, docsByToken }, safariSubs };
  } catch (e) {
    console.error('Failed to read push subscriptions:', e);
    return { fcmTokens: { tokens: [], docsByToken: new Map() }, safariSubs: [] };
  }
}

// ---- Helper: send Web Push notifications to Safari subscribers ----
async function sendWebPushNotifications(safariSubs, title, body) {
  if (!safariSubs || safariSubs.length === 0) return;

  const payload = JSON.stringify({ notification: { title, body } });

  const results = await Promise.allSettled(
    safariSubs.map(({ endpoint, p256dh, auth, ref }) =>
      webpush.sendNotification(
        { endpoint, keys: { p256dh, auth } },
        payload
      ).catch(async (err) => {
        // 410 Gone means the subscription has expired/unsubscribed — clean it up
        if (err.statusCode === 410) {
          console.log(`[WebPush] Removing expired Safari subscription: ${endpoint.substring(0, 40)}…`);
          await ref.delete().catch((e) => console.error('[WebPush] Failed to delete stale sub:', e));
        } else {
          console.error(`[WebPush] Failed to send to ${endpoint.substring(0, 40)}…:`, err.message);
        }
      })
    )
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value !== undefined).length;
  console.log(`[WebPush] Safari notifications: ${succeeded} succeeded of ${results.length} attempted.`);
}

// ---- Helper: send FCM notifications to Chrome/non-Safari subscribers ----
async function sendFCMNotifications(fcmTokens, title, body) {
  const { tokens, docsByToken } = fcmTokens;
  if (!tokens || tokens.length === 0) return;

  const message = {
    tokens,
    notification: { title, body },
    apns: {
      payload: {
        aps: {
          alert: { title, body },
          sound: 'default',
          badge: 1,
        },
      },
    },
    android: {
      priority: 'high',
      notification: { sound: 'default' },
    },
    webpush: {
      notification: {
        icon: '/icon-192.png',
        requireInteraction: false,
      },
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`[FCM] Notifications sent: ${response.successCount} succeeded, ${response.failureCount} failed.`);

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
        console.log(`[FCM] Removed ${staleSet.size} stale token(s).`);
      }
    }
  } catch (e) {
    console.error('[FCM] Failed to send notifications:', e);
  }
}

// ---- Helper: send push notifications to all subscribers (FCM + Safari) ----
async function sendNotification(subscriptions, title, body) {
  const { fcmTokens, safariSubs } = subscriptions;
  await Promise.all([
    sendFCMNotifications(fcmTokens, title, body),
    sendWebPushNotifications(safariSubs, title, body),
  ]);
}

// ---- 1. New sale: "🛒 Venta $[total] — Ticket [ticketId] — [N] productos — [payment]" ----
exports.onNewSale = functions.firestore
  .document('ventas/{saleId}')
  .onCreate(async (snap) => {
    const sale = snap.data();
    if (sale.notified === true) return;
    await snap.ref.update({ notified: true });
    const subscriptions = await getAllSubscriptions();
    const total = parseFloat(sale.total || 0).toFixed(2);
    const ticketId = sale.ticketId || snap.id;
    const itemCount = Array.isArray(sale.items) ? sale.items.reduce((a, i) => a + (i.qty || 0), 0) : (sale.qty || 0);
    const payment = sale.payment || 'efectivo';
    await sendNotification(
      subscriptions,
      'Venta registrada',
      `🛒 Venta $${total} — Ticket ${ticketId} — ${itemCount} producto(s) — ${payment}`
    );
  });

// ---- 2. New delivery order: "Nuevo pedido a domicilio — [cliente] — [dirección]" ----
exports.onNewOrder = functions.firestore
  .document('pedidos/{orderId}')
  .onCreate(async (snap) => {
    const order = snap.data();
    if (order.status !== 'pendiente') return;
    if (order.notified === true) return;
    await snap.ref.update({ notified: true });
    const subscriptions = await getAllSubscriptions();
    await sendNotification(
      subscriptions,
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

    const subscriptions = await getAllSubscriptions();

    if (after.status === 'entregado') {
      // "Entrega completada — [cliente] en [dirección]"
      await sendNotification(
        subscriptions,
        'Entrega completada',
        `${after.clientName || 'Cliente'} en ${after.clientAddress || 'Sin dirección'}`
      );
    } else if (after.status === 'cancelado') {
      // "Pedido cancelado — [cliente] — [motivo]"
      const motivo = after.cancelReason ? ` — ${after.cancelReason}` : '';
      await sendNotification(
        subscriptions,
        'Pedido cancelado',
        `${after.clientName || 'Cliente'}${motivo}`
      );
    }
  });

