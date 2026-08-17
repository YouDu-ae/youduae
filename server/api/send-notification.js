const admin = require('firebase-admin');
const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');

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

/**
 * Send push notification to a user
 * Used internally by other endpoints
 */
async function sendNotificationToUser(userId, notification, data = {}) {
  if (!admin.apps.length) {
    console.warn('Firebase Admin not initialized, skipping notification');
    return { success: false, reason: 'Firebase not configured' };
  }

  const integrationClientId = process.env.INTEGRATION_API_CLIENT_ID;
  const integrationClientSecret = process.env.INTEGRATION_API_CLIENT_SECRET;

  if (!integrationClientId || !integrationClientSecret) {
    console.warn('Integration API credentials not configured');
    return { success: false, reason: 'Integration API not configured' };
  }

  try {
    const integrationSdk = sharetribeIntegrationSdk.createInstance({
      clientId: integrationClientId,
      clientSecret: integrationClientSecret,
    });
    
    // Get user's device tokens from privateData
    const userRes = await integrationSdk.users.show({ 
      id: userId,
      include: ['profileImage'],
    });
    
    const user = userRes.data.data;
    const privateData = user.attributes.profile.privateData || {};
    const deviceTokens = privateData.deviceTokens || [];

    if (deviceTokens.length === 0) {
      console.log(`No device tokens for user ${userId}`);
      return { success: false, reason: 'No device tokens' };
    }

    // Send to all user's devices
    const tokens = deviceTokens.map(t => t.token);
    
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      tokens,
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`📤 Sent notification to ${response.successCount}/${tokens.length} devices for user ${userId}`);
    
    // Remove failed tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });
      
      // TODO: Clean up failed tokens from user's privateData
      console.log(`Failed tokens: ${failedTokens.length}`);
    }

    return { success: true, sent: response.successCount };
  } catch (error) {
    console.error('❌ Send notification error:', error.message);
    return { success: false, reason: error.message };
  }
}

/**
 * Send notification for new message
 */
async function sendNewMessageNotification(recipientId, senderName, messagePreview, transactionId) {
  return sendNotificationToUser(
    recipientId,
    {
      title: `Новое сообщение от ${senderName}`,
      body: messagePreview.substring(0, 100),
    },
    {
      type: 'message',
      transactionId,
    }
  );
}

/**
 * Send notification when executor is selected
 */
async function sendExecutorSelectedNotification(executorId, taskTitle, listingId) {
  return sendNotificationToUser(
    executorId,
    {
      title: 'Вас выбрали исполнителем!',
      body: `Вы выбраны для задания: ${taskTitle}`,
    },
    {
      type: 'executor_selected',
      listingId,
    }
  );
}

/**
 * Send notification when new review is received
 */
async function sendNewReviewNotification(userId, reviewerName, rating) {
  const stars = '⭐'.repeat(Math.round(rating));
  return sendNotificationToUser(
    userId,
    {
      title: 'Новый отзыв',
      body: `Отзыв от ${reviewerName} ${stars}`,
    },
    {
      type: 'review',
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

// Export functions for use in other endpoints
module.exports = {
  sendNotificationToUser,
  sendNewMessageNotification,
  sendExecutorSelectedNotification,
  sendNewReviewNotification,
  sendOfferStatusNotification,
};

// Also export as HTTP endpoint for testing
module.exports.handler = async (req, res) => {
  const { userId, title, body, data } = req.body;

  if (!userId || !title || !body) {
    return res.status(400).json({ 
      error: 'userId, title, and body are required' 
    }).end();
  }

  const result = await sendNotificationToUser(userId, { title, body }, data || {});
  
  res.status(200).json(result).end();
};
