/**
 * API for tracking viewed transactions (read/unread state)
 * Stores lastViewedAt timestamps in user's privateData
 * This syncs across all devices for the same user
 *
 * The user comes from the session (requireUser), never from the request:
 * user ids are public, so trusting one would expose anyone's read state.
 */

const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const db = require('../db');

// Initialize Integration SDK
const getIntegrationSdk = () => {
  const clientId = process.env.INTEGRATION_API_CLIENT_ID;
  const clientSecret = process.env.INTEGRATION_API_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Integration API credentials not configured');
  }
  
  return sharetribeIntegrationSdk.createInstance({
    clientId,
    clientSecret,
  });
};

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const SAVE_ATTEMPTS = 3;

/**
 * Marks the given transactions as viewed now and saves the whole map back.
 * privateData merges only on the top level, so the map is read, changed and
 * written as one value; when two marks overlap Sharetribe answers 409 to one
 * of them, and that one starts over from a fresh read.
 */
const saveViewedTransactions = async (integrationSdk, userId, transactionIds) => {
  for (let attempt = 1; ; attempt++) {
    const userResponse = await integrationSdk.users.show({ id: userId });
    const privateData = userResponse.data.data.attributes.profile.privateData || {};
    const viewedTransactions = privateData.viewedTransactions || {};

    const now = Date.now();
    transactionIds.forEach(txId => {
      viewedTransactions[txId] = now;
    });

    // Clean up old entries (older than 90 days) to prevent data bloat
    Object.keys(viewedTransactions).forEach(txId => {
      if (now - viewedTransactions[txId] > NINETY_DAYS_MS) {
        delete viewedTransactions[txId];
      }
    });

    try {
      await integrationSdk.users.updateProfile({
        id: userId,
        privateData: { viewedTransactions },
      });
      return now;
    } catch (error) {
      if (error.status !== 409 || attempt >= SAVE_ATTEMPTS) {
        throw error;
      }
    }
  }
};

/**
 * GET /api/viewed-transactions
 * Get all viewed transaction timestamps for user
 */
const getViewedTransactions = async (req, res) => {
  const userId = req.authUserId;

  try {
    const integrationSdk = getIntegrationSdk();
    
    const userResponse = await integrationSdk.users.show({
      id: userId,
    });
    
    const privateData = userResponse.data.data.attributes.profile.privateData || {};
    const viewedTransactions = privateData.viewedTransactions || {};

    // Without it the inbox falls back to transitions only; still worth answering.
    let lastIncomingMessages = {};
    try {
      lastIncomingMessages = await db.getLastIncomingMessageTimes(userId);
    } catch (error) {
      console.error('Error reading last incoming messages:', error.message);
    }

    res.json({
      success: true,
      viewedTransactions,
      lastIncomingMessages,
    });
  } catch (error) {
    console.error('Error getting viewed transactions:', error.message);
    res.status(500).json({ error: 'Failed to get viewed transactions' });
  }
};

/**
 * POST /api/viewed-transactions
 * Mark a transaction as viewed
 */
const markTransactionViewed = async (req, res) => {
  const userId = req.authUserId;
  const { transactionId } = req.body;

  if (!transactionId) {
    return res.status(400).json({ error: 'transactionId is required' });
  }
  
  try {
    const integrationSdk = getIntegrationSdk();
    const now = await saveViewedTransactions(integrationSdk, userId, [transactionId]);

    res.json({
      success: true,
      transactionId,
      viewedAt: now,
    });
  } catch (error) {
    console.error('Error marking transaction viewed:', error.message);
    res.status(500).json({ error: 'Failed to mark transaction as viewed' });
  }
};

/**
 * POST /api/viewed-transactions/batch
 * Mark multiple transactions as viewed at once
 */
const markTransactionsBatchViewed = async (req, res) => {
  const userId = req.authUserId;
  const { transactionIds } = req.body;

  if (!Array.isArray(transactionIds)) {
    return res.status(400).json({ error: 'transactionIds array is required' });
  }
  
  try {
    const integrationSdk = getIntegrationSdk();
    const now = await saveViewedTransactions(integrationSdk, userId, transactionIds);

    res.json({
      success: true,
      count: transactionIds.length,
      viewedAt: now,
    });
  } catch (error) {
    console.error('Error marking transactions batch viewed:', error.message);
    res.status(500).json({ error: 'Failed to mark transactions as viewed' });
  }
};

module.exports = {
  getViewedTransactions,
  markTransactionViewed,
  markTransactionsBatchViewed,
};
