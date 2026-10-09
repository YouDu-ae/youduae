/**
 * Conversations holding a message the user has not read — the number on the
 * app's icon badge.
 *
 * A conversation counts when the other party wrote after the user last opened
 * it, on the site or in the app (viewed-transactions), unless the user has
 * blocked them or hid the conversation since. Only deals at a step where the
 * app shows the chat count; otherwise the badge would point at a conversation
 * the chat list does not have, and nothing could clear it.
 */

const db = require('../db');
const { createIntegrationSdk } = require('../reminders/context');

// Same list as CHAT_AVAILABLE_TRANSITIONS in YouDuMobile
// src/utils/transactionStatus.ts; the two must change together.
const CHAT_TRANSITIONS = new Set([
  'transition/accept-offer',
  'transition/complete',
  'transition/review-1-by-customer',
  'transition/review-1-by-provider',
  'transition/review-2-by-customer',
  'transition/review-2-by-provider',
  'transition/expire-review-period',
  'transition/expire-customer-review-period',
  'transition/expire-provider-review-period',
  'transition/reviewed',
  'transition/add-portfolio',
]);

const loadViewedTransactions = async userId => {
  const integrationSdk = createIntegrationSdk();
  if (!integrationSdk) throw new Error('Integration API credentials not configured');
  const response = await integrationSdk.users.show({ id: userId });
  return response.data.data.attributes.profile.privateData?.viewedTransactions || {};
};

/**
 * @param {string} userId
 * @param {Object} [options.viewedTransactions] read marks just saved, so they need no reading back
 * @returns {Promise<string[]>} ids of the unread conversations
 */
const getUnreadConversations = async (userId, { viewedTransactions } = {}) => {
  const [received, hidden, viewed] = await Promise.all([
    db.getReceivedMessages(userId),
    db.getHiddenConversations(userId),
    viewedTransactions || loadViewedTransactions(userId),
  ]);
  return received
    .filter(
      ({ transactionId, receivedAt, lastTransition }) =>
        CHAT_TRANSITIONS.has(lastTransition) &&
        receivedAt > Math.max(viewed[transactionId] || 0, hidden[transactionId] || 0)
    )
    .map(({ transactionId }) => transactionId);
};

module.exports = { getUnreadConversations, CHAT_TRANSITIONS };
