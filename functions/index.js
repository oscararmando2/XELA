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

// ---- 4. Mercado Pago webhook: receives payment notifications ----
// Access token is read from Firebase environment config:
//   firebase functions:config:set mercadopago.access_token="APP_USR-..."
// Fallback to the default token if config is not set (for initial deploy).
const MP_ACCESS_TOKEN = (functions.config().mercadopago && functions.config().mercadopago.access_token)
  || 'APP_USR-4153790665353619-042016-4f1267ae7e1be9868033800f4ff94f7d-3348390313';

exports.mercadoPagoWebhook = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // Mercado Pago sends notifications via query params or body
  const topic = req.query.topic || (req.body && req.body.type);
  const rawId = req.query.id || (req.body && req.body.data && req.body.data.id);

  // Only process payment notifications
  if (topic !== 'payment' || !rawId) {
    res.status(200).send('OK');
    return;
  }

  // Validate paymentId is a numeric string to prevent SSRF
  const paymentId = String(rawId);
  if (!/^\d+$/.test(paymentId)) {
    console.warn(`[MP] Rejected non-numeric paymentId: ${paymentId}`);
    res.status(200).send('OK');
    return;
  }

  try {
    // Fetch payment details from Mercado Pago API
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
    });

    if (!mpRes.ok) {
      console.error(`[MP] Failed to fetch payment ${paymentId}: ${mpRes.status}`);
      res.status(200).send('OK');
      return;
    }

    const payment = await mpRes.json();

    if (payment.status !== 'approved') {
      // Not approved — acknowledge and ignore
      res.status(200).send('OK');
      return;
    }

    const db = admin.firestore();

    // Build payment record
    const amount = payment.transaction_amount || 0;
    const currency = payment.currency_id || 'MXN';
    const paymentMethod = payment.payment_type_id || payment.payment_method_id || 'unknown';
    const payerName = (payment.payer && (payment.payer.first_name || payment.payer.email)) || 'Desconocido';
    const dateApproved = payment.date_approved || payment.date_created || new Date().toISOString();
    const status = payment.status;

    const dateObj = new Date(dateApproved);
    const dateStr = dateObj.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }); // YYYY-MM-DD in MX timezone
    const timeStr = dateObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Mexico_City' });

    const pagoDoc = {
      paymentId,
      amount,
      currency,
      paymentMethod,
      payerName,
      dateApproved,
      date: dateStr,
      time: timeStr,
      status,
    };

    // Save to pagos_mp collection (idempotent by paymentId)
    await db.collection('pagos_mp').doc(paymentId).set(pagoDoc, { merge: true });
    console.log(`[MP] Payment ${paymentId} saved to pagos_mp.`);

    // Send push notification to all devices
    const subscriptions = await getAllSubscriptions();
    const amountFmt = parseFloat(amount).toFixed(2);
    await sendNotification(
      subscriptions,
      'Pago recibido',
      `💳 Pago recibido — $${amountFmt} MXN via ${paymentMethod}`
    );

    res.status(200).send('OK');
  } catch (err) {
    console.error('[MP] Error processing webhook:', err);
    // Return 200 to avoid MP retry storms; error is already logged above
    res.status(200).send('OK');
  }
});

