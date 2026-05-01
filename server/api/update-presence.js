const sharetribeSdk = require('sharetribe-flex-sdk');
const { typeHandlers } = require('../api-util/sdk');

const CLIENT_ID = process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID;
const BASE_URL = process.env.REACT_APP_SHARETRIBE_SDK_BASE_URL;

/**
 * Update current user's presence (stored in profile.privateData.presence).
 * Mobile: AppState, login/logout, open/leave chat.
 */
module.exports = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' }).end();
  }

  const accessToken = authHeader.substring(7);
  if (!accessToken || accessToken === 'null' || accessToken === 'undefined') {
    return res.status(401).json({ error: 'Invalid access token' }).end();
  }

  const { status, activeConversationId } = req.body || {};
  if (status && status !== 'online' && status !== 'offline') {
    return res.status(400).json({ error: 'status must be online or offline' }).end();
  }

  try {
    const tokenStore = sharetribeSdk.tokenStore.memoryStore();
    tokenStore.setToken({
      access_token: accessToken,
      token_type: 'bearer',
    });

    const sdk = sharetribeSdk.createInstance({
      clientId: CLIENT_ID,
      tokenStore,
      typeHandlers,
      ...(BASE_URL ? { baseUrl: BASE_URL } : {}),
    });

    const currentUserRes = await sdk.currentUser.show();
    const currentUser = currentUserRes.data.data;
    const privateData = currentUser.attributes.profile.privateData || {};
    const prevPresence = privateData.presence || {};

    const now = new Date().toISOString();
    const nextPresence = {
      ...prevPresence,
      lastSeenAt: now,
    };

    if (status) {
      nextPresence.status = status;
    }
    if (activeConversationId !== undefined) {
      nextPresence.activeConversationId = activeConversationId || null;
    }

    await sdk.currentUser.updateProfile({
      privateData: {
        ...privateData,
        presence: nextPresence,
      },
    });

    return res.status(200).json({ success: true, presence: nextPresence }).end();
  } catch (err) {
    console.error('update-presence error:', err.message);
    return res.status(500).json({ error: 'Failed to update presence' }).end();
  }
};
