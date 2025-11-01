/**
 * Utility functions for tracking read/unread transactions
 */

const STORAGE_KEY_PREFIX = 'lastViewedTx_';
const STORAGE_KEY_ALL_VIEWED = 'viewedTransactions';

/**
 * Mark transaction as viewed by saving current timestamp
 * @param {string} transactionId - Transaction UUID
 */
export const markTransactionAsViewed = transactionId => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const now = new Date().getTime();
    window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${transactionId}`, now.toString());

    // Also add to the list of all viewed transactions
    const viewed = getViewedTransactions();
    if (!viewed.includes(transactionId)) {
      viewed.push(transactionId);
      window.localStorage.setItem(STORAGE_KEY_ALL_VIEWED, JSON.stringify(viewed));
    }
  } catch (e) {
    console.error('Error marking transaction as viewed:', e);
  }
};

/**
 * Get timestamp when transaction was last viewed by user
 * @param {string} transactionId - Transaction UUID
 * @returns {number|null} Timestamp in milliseconds or null if never viewed
 */
export const getTransactionLastViewedAt = transactionId => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const timestamp = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${transactionId}`);
    return timestamp ? parseInt(timestamp, 10) : null;
  } catch (e) {
    console.error('Error getting transaction last viewed time:', e);
    return null;
  }
};

/**
 * Check if transaction has unread updates
 * @param {Object} transaction - Transaction entity from Sharetribe API
 * @param {string} currentUserId - Current user UUID
 * @returns {boolean} True if transaction has unread updates
 */
export const hasUnreadUpdates = (transaction, currentUserId) => {
  if (!transaction || !transaction.id) {
    return false;
  }

  const transactionId = transaction.id.uuid;
  const lastViewedAt = getTransactionLastViewedAt(transactionId);

  // If never viewed, consider it unread
  if (!lastViewedAt) {
    return true;
  }

  // Get the last transition time from transaction
  const lastTransitionedAt = transaction.attributes?.lastTransitionedAt;
  if (!lastTransitionedAt) {
    return false;
  }

  const lastTransitionTime = new Date(lastTransitionedAt).getTime();

  // Transaction is unread if it was updated after last view
  return lastTransitionTime > lastViewedAt;
};

/**
 * Get list of all viewed transaction IDs
 * @returns {Array<string>} Array of transaction UUIDs
 */
export const getViewedTransactions = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  try {
    const viewed = window.localStorage.getItem(STORAGE_KEY_ALL_VIEWED);
    return viewed ? JSON.parse(viewed) : [];
  } catch (e) {
    console.error('Error getting viewed transactions:', e);
    return [];
  }
};

/**
 * Clear all viewed transaction records (useful for testing or logout)
 */
export const clearAllViewedTransactions = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const viewed = getViewedTransactions();
    viewed.forEach(txId => {
      window.localStorage.removeItem(`${STORAGE_KEY_PREFIX}${txId}`);
    });
    window.localStorage.removeItem(STORAGE_KEY_ALL_VIEWED);
  } catch (e) {
    console.error('Error clearing viewed transactions:', e);
  }
};

/**
 * Clean up old viewed transaction records (older than 90 days)
 * This prevents localStorage from growing indefinitely
 */
export const cleanupOldViewedTransactions = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
    const now = new Date().getTime();
    const viewed = getViewedTransactions();
    const stillValid = [];

    viewed.forEach(txId => {
      const lastViewed = getTransactionLastViewedAt(txId);
      if (lastViewed && now - lastViewed < NINETY_DAYS_MS) {
        stillValid.push(txId);
      } else {
        // Remove old entry
        window.localStorage.removeItem(`${STORAGE_KEY_PREFIX}${txId}`);
      }
    });

    window.localStorage.setItem(STORAGE_KEY_ALL_VIEWED, JSON.stringify(stillValid));
  } catch (e) {
    console.error('Error cleaning up old viewed transactions:', e);
  }
};

