const admin = require('firebase-admin');
const db = require('../db');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  // Firebase Admin can be initialized with service account JSON or environment variables
  // Option 1: Using environment variables (recommended for production)
  if (process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase Admin initialized');
  } else {
    console.warn('⚠️ Firebase Admin not configured - push notifications disabled');
  }
}

// Firebase will never deliver to these again: the app was removed, or the
// phone signed out and deleted its token.
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);
const TRANSIENT_CODES = new Set(['messaging/server-unavailable', 'messaging/internal-error']);
const RETRY_DELAY_MS = 1000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// FCM accepts only string values in data.
const stringData = data =>
  Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, String(value)])
  );

/**
 * No badge: the server does not know how many conversations are unread, and
 * iOS leaves the icon badge as it is when the payload has none.
 */
const buildMessage = (notification, data) => ({
  notification: {
    title: notification.title,
    body: notification.body,
  },
  data: stringData({
    ...data,
    dedupeKey:
      data.dedupeKey ||
      (data.transactionId ? `push_${data.type}_${data.transactionId}` : undefined),
  }),
  apns: {
    headers: {
      'apns-priority': '10',
      'apns-push-type': 'alert',
    },
    payload: {
      aps: {
        sound: 'default',
        ...(data.transactionId ? { threadId: String(data.transactionId) } : {}),
      },
    },
  },
});

/**
 * Send push notification to a user
 * Used internally by other endpoints
 */
async function sendNotificationToUser(userId, notification, data = {}) {
  if (!admin.apps.length) {
    console.warn('Firebase Admin not initialized, skipping notification');
    return { success: false, reason: 'Firebase not configured' };
  }

  try {
    const tokens = await db.getDeviceTokens(userId);
    if (tokens.length === 0) {
      console.log(`No device tokens for user ${userId}`);
      return { success: false, reason: 'No device tokens' };
    }

    const message = buildMessage(notification, { ...data, recipientUserId: userId });
    let pending = tokens;
    let sent = 0;
    const failures = [];

    // One retry, for a failed request or for tokens Firebase could not take
    // for a moment.
    for (let attempt = 0; attempt < 2 && pending.length > 0; attempt++) {
      if (attempt > 0) await sleep(RETRY_DELAY_MS);
      let response;
      try {
        response = await admin.messaging().sendEachForMulticast({ ...message, tokens: pending });
      } catch (error) {
        if (attempt > 0) throw error;
        continue;
      }
      sent += response.successCount;
      const retry = [];
      response.responses.forEach((result, idx) => {
        if (result.success) return;
        const code = result.error?.code;
        if (attempt === 0 && TRANSIENT_CODES.has(code)) {
          retry.push(pending[idx]);
        } else {
          failures.push({ token: pending[idx], code });
        }
      });
      pending = retry;
    }

    const dead = failures.filter(f => DEAD_TOKEN_CODES.has(f.code)).map(f => f.token);
    if (dead.length > 0) {
      await db.removeDeviceTokens(dead);
    }

    console.log(`📤 Sent notification to ${sent}/${tokens.length} devices for user ${userId}`);
    if (failures.length > 0) {
      const codes = [...new Set(failures.map(f => f.code))].join(', ');
      console.log(`Failed tokens: ${failures.length} (${codes}), removed as dead: ${dead.length}`);
    }

    return { success: sent > 0, sent };
  } catch (error) {
    console.error('❌ Send notification error:', error.message);
    return { success: false, reason: error.message };
  }
}

/**
 * Send notification for new message
 */
async function sendNewMessageNotification({
  recipientId,
  senderId,
  senderName,
  preview,
  transactionId,
  messageId,
  messageCreatedAt,
}) {
  return sendNotificationToUser(
    recipientId,
    {
      title: `Новое сообщение от ${senderName}`,
      body: preview.substring(0, 100),
    },
    {
      type: 'message',
      transactionId,
      messageId,
      messageCreatedAt,
      senderUserId: senderId,
    }
  );
}

/**
 * A specialist's offer on the recipient's task. The app keeps a single inbox
 * entry per task for all its offers, so the push updates that entry instead of
 * adding one per offer.
 */
async function sendNewOfferNotification({
  recipientId,
  senderId,
  executorName,
  listingTitle,
  listingId,
  transactionId,
  price,
}) {
  return sendNotificationToUser(
    recipientId,
    {
      title: `Новый отклик на «${listingTitle}»`,
      body: price ? `${executorName} предлагает ${price}` : `Отклик от ${executorName}`,
    },
    {
      type: 'new_offer',
      listingId,
      transactionId,
      senderUserId: senderId,
      dedupeKey: `offers_${listingId}`,
    }
  );
}

/**
 * Send notification when executor is selected
 */
async function sendExecutorSelectedNotification(executorId, taskTitle, listingId, transactionId) {
  return sendNotificationToUser(
    executorId,
    {
      title: 'Вас выбрали исполнителем!',
      body: `Вы выбраны для задания: ${taskTitle}`,
    },
    {
      type: 'executor_selected',
      listingId,
      transactionId,
    }
  );
}

/**
 * A review of the recipient. A first review stays hidden until the recipient
 * leaves theirs, so neither push reveals the rating.
 */
async function sendReviewNotification({
  recipientId,
  reviewerId,
  reviewerName,
  transactionId,
  published,
}) {
  const notification = published
    ? { title: 'Отзывы опубликованы', body: `${reviewerName} ответил(а) на ваш отзыв.` }
    : { title: `Новый отзыв от ${reviewerName}`, body: 'Оставьте свой отзыв, чтобы увидеть его.' };
  return sendNotificationToUser(
    recipientId,
    notification,
    {
      type: 'review',
      transactionId,
      senderUserId: reviewerId,
    }
  );
}

/**
 * Send notification when offer status changes
 */
async function sendOfferStatusNotification(userId, taskTitle, status) {
  const statusMessages = {
    accepted: { title: 'Ваш отклик принят!', body: `Заказчик принял ваш отклик на: ${taskTitle}` },
    declined: { title: 'Отклик отклонён', body: `Заказчик отклонил ваш отклик на: ${taskTitle}` },
  };

  const msg = statusMessages[status];
  if (!msg) return { success: false, reason: 'Unknown status' };

  return sendNotificationToUser(
    userId,
    msg,
    {
      type: 'offer_status',
      status,
    }
  );
}

module.exports = {
  sendNotificationToUser,
  sendNewMessageNotification,
  sendNewOfferNotification,
  sendExecutorSelectedNotification,
  sendReviewNotification,
  sendOfferStatusNotification,
};
