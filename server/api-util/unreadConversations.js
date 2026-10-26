/**
 * Conversations holding a message the user has not read — the number on the
 * app's icon badge.
 *
 * A deal counts when the other party wrote after the user last opened it, on
 * the site or in the app (viewed-transactions), unless the user has blocked
 * them, hid the deal or deleted their history with that person since. Only
 * deals at a step where the app shows the chat count; otherwise the badge
 * would point at a conversation the chat list does not have, and nothing
 * could clear it.
 *
 * The app shows one chat per person across all deals with them, so the badge
 * counts people: three unread deals with one specialist are one chat.
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
 * @returns {Promise<{transactionIds: string[], counterpartyIds: string[]}>} the unread
 *   deals, and the people who wrote in them, whose number the badge shows
 */
const getUnreadConversations = async (userId, { viewedTransactions } = {}) => {
  const [received, hidden, deleted, viewed] = await Promise.all([
    db.getReceivedMessages(userId),
    db.getHiddenConversations(userId),
    db.getDeletedConversations(userId),
    viewedTransactions || loadViewedTransactions(userId),
  ]);
  const unread = received.filter(
    ({ transactionId, senderId, receivedAt, lastTransition }) =>
      CHAT_TRANSITIONS.has(lastTransition) &&
      receivedAt >
        Math.max(viewed[transactionId] || 0, hidden[transactionId] || 0, deleted[senderId] || 0)
  );
  return {
    transactionIds: unread.map(row => row.transactionId),
    counterpartyIds: [...new Set(unread.map(row => row.senderId))],
  };
};

module.exports = { getUnreadConversations, CHAT_TRANSITIONS };
