/**
 * API for tracking viewed transactions (read/unread state)
 * Stores lastViewedAt timestamps in user's privateData
 * This syncs across all devices for the same user
 *
 * The user comes from the session (requireUser), never from the request:
 * user ids are public, so trusting one would expose anyone's read state.
 *
 * POST /api/viewed-transactions       { transactionId, seenUntil? }
 * POST /api/viewed-transactions/batch { transactionIds, seenUntil?: { transactionId: time } }
 *
 * seenUntil (ISO or ms) is the newest message or step the person actually saw.
 * Without it the mark is now, which would also mark read a message that came
 * in after the screen was loaded.
 */

const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const db = require('../db');
const { hasBearerToken } = require('../api-util/mobileSdk');
const { sendBadgeUpdate } = require('./send-notification');

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
// A mark past the cleanup below would vanish on the next save and read as
// "never opened"; messages that old are no longer counted as unread.
const OLDEST_MARK_MS = 89 * 24 * 60 * 60 * 1000;
const SAVE_ATTEMPTS = 3;

/** ms, undefined when absent, NaN when not a time. */
const parseSeenUntil = value => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value === 'string') return Date.parse(value);
  return NaN;
};

/**
 * Marks the given transactions as viewed and saves the whole map back.
 * privateData merges only on the top level, so the map is read, changed and
 * written as one value; when two marks overlap Sharetribe answers 409 to one
 * of them, and that one starts over from a fresh read.
 *
 * A mark never moves back, so a stale or repeated request cannot make a read
 * chat unread again.
 *
 * @param {Map<string, number>} [seenUntil] per transaction; the rest are marked now
 * @returns {Promise<{viewedAt: number, viewedTransactions: Object}>} the saved map
 */
const saveViewedTransactions = async (
  integrationSdk,
  userId,
  transactionIds,
  seenUntil = new Map()
) => {
  for (let attempt = 1; ; attempt++) {
    const userResponse = await integrationSdk.users.show({ id: userId });
    const privateData = userResponse.data.data.attributes.profile.privateData || {};
    const viewedTransactions = privateData.viewedTransactions || {};

    const now = Date.now();
    transactionIds.forEach(txId => {
      const mark = seenUntil.has(txId)
        ? Math.max(Math.min(seenUntil.get(txId), now), now - OLDEST_MARK_MS)
        : now;
      viewedTransactions[txId] = Math.max(Number(viewedTransactions[txId]) || 0, mark);
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
      return { viewedAt: now, viewedTransactions };
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
  const seenUntil = parseSeenUntil(req.body.seenUntil);
  if (Number.isNaN(seenUntil)) {
    return res.status(400).json({ error: 'seenUntil must be a time' });
  }

  try {
    const integrationSdk = getIntegrationSdk();
    const { viewedTransactions } = await saveViewedTransactions(
      integrationSdk,
      userId,
      [transactionId],
      new Map(seenUntil === undefined ? [] : [[transactionId, seenUntil]])
    );
    // The answer does not wait for the phones. A mark made in the app is not
    // sent to them: the open app sets its own icon, and builds up to 1.0 (2)
    // show a badge-only push that reaches them in the foreground as an empty alert.
    if (!hasBearerToken(req)) sendBadgeUpdate(userId, { viewedTransactions });

    res.json({
      success: true,
      transactionId,
      viewedAt: viewedTransactions[transactionId],
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
  const times = req.body.seenUntil == null ? {} : req.body.seenUntil;
  if (typeof times !== 'object' || Array.isArray(times)) {
    return res.status(400).json({ error: 'seenUntil must map transactions to times' });
  }
  const seenUntil = new Map();
  for (const txId of transactionIds) {
    if (!Object.prototype.hasOwnProperty.call(times, txId)) continue;
    const time = parseSeenUntil(times[txId]);
    if (Number.isNaN(time)) {
      return res.status(400).json({ error: 'seenUntil must map transactions to times' });
    }
    if (time !== undefined) seenUntil.set(txId, time);
  }

  try {
    const integrationSdk = getIntegrationSdk();
    const { viewedAt, viewedTransactions } = await saveViewedTransactions(
      integrationSdk,
      userId,
      transactionIds,
      seenUntil
    );
    if (!hasBearerToken(req)) sendBadgeUpdate(userId, { viewedTransactions });

    res.json({
      success: true,
      count: transactionIds.length,
      viewedAt,
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
