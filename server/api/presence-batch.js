const sharetribeSdk = require('sharetribe-flex-sdk');
const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const { typeHandlers } = require('../api-util/sdk');

const CLIENT_ID = process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID;
const BASE_URL = process.env.REACT_APP_SHARETRIBE_SDK_BASE_URL;
const INTEGRATION_CLIENT_ID = process.env.INTEGRATION_API_CLIENT_ID;
const INTEGRATION_CLIENT_SECRET = process.env.INTEGRATION_API_CLIENT_SECRET;

const MAX_IDS = 40;

/**
 * Batch presence for chat list. Query: ?transactionIds=id1,id2,...
 * Returns presence for the *other* party in each transaction (verified participant).
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

  if (!INTEGRATION_CLIENT_ID || !INTEGRATION_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Integration API not configured' }).end();
  }

  const raw = req.query.transactionIds || req.query.ids || '';
  const transactionIds = String(raw)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, MAX_IDS);

  if (transactionIds.length === 0) {
    return res.status(400).json({ error: 'transactionIds query required (comma-separated)' }).end();
  }

  try {
    const tokenStore = sharetribeSdk.tokenStore.memoryStore();
    tokenStore.setToken({
      access_token: accessToken,
      token_type: 'bearer',
    });

    const userSdk = sharetribeSdk.createInstance({
      clientId: CLIENT_ID,
      tokenStore,
      typeHandlers,
      ...(BASE_URL ? { baseUrl: BASE_URL } : {}),
    });

    const currentUserRes = await userSdk.currentUser.show();
    const viewerId = currentUserRes.data.data.id.uuid;

    const integrationSdk = sharetribeIntegrationSdk.createInstance({
      clientId: INTEGRATION_CLIENT_ID,
      clientSecret: INTEGRATION_CLIENT_SECRET,
    });

    const out = {};

    for (const transactionId of transactionIds) {
      try {
        const txResponse = await integrationSdk.transactions.show({
          id: transactionId,
        });
        const transaction = txResponse.data.data;
        const providerId = transaction.relationships?.provider?.data?.id?.uuid;
        const customerId = transaction.relationships?.customer?.data?.id?.uuid;

        if (!providerId || !customerId) {
          continue;
        }
        if (viewerId !== providerId && viewerId !== customerId) {
          continue;
        }

        const otherUserId = viewerId === providerId ? customerId : providerId;

        const userResponse = await integrationSdk.users.show({
          id: otherUserId,
        });
        const presence =
          userResponse.data.data.attributes?.profile?.privateData?.presence || {};

        const lastSeenAt = presence.lastSeenAt || null;
        const status = presence.status || 'offline';
        const activeConversationId = presence.activeConversationId || null;
        const inThisChat =
          status === 'online' &&
          activeConversationId &&
          String(activeConversationId) === String(transactionId);

        const onlineRecent =
          status === 'online' &&
          lastSeenAt &&
          Date.now() - new Date(lastSeenAt).getTime() < 2 * 60 * 1000;

        out[transactionId] = {
          userId: otherUserId,
          lastSeenAt,
          status,
          activeConversationId,
          inThisChat,
          onlineRecent,
        };
      } catch (e) {
        console.warn('presence-batch skip tx', transactionId, e.message);
      }
    }

    return res.status(200).json({ data: out }).end();
  } catch (err) {
    console.error('presence-batch error:', err.message);
    return res.status(500).json({ error: 'Failed to load presence' }).end();
  }
};
