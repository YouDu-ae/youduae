/**
 * Utility functions for tracking read/unread transactions
 * 
 * Uses server-side storage (Sharetribe privateData) to sync across devices.
 * Falls back to localStorage for immediate UI updates before server sync.
 */

// In-memory cache of viewed transactions (synced from server)
let viewedTransactionsCache = {};
let cacheInitialized = false;

/**
 * Initialize cache from server
 * @param {string} userId - Current user UUID
 */
export const initViewedTransactionsCache = async (userId) => {
  if (!userId) return;
  
  try {
    const response = await fetch(`/api/viewed-transactions?userId=${userId}`);
    const data = await response.json();
    
    if (data.success && data.viewedTransactions) {
      viewedTransactionsCache = data.viewedTransactions;
      cacheInitialized = true;
      console.log('📬 Viewed transactions cache initialized:', Object.keys(viewedTransactionsCache).length);
    }
  } catch (error) {
    console.error('Error initializing viewed transactions cache:', error);
  }
};

/**
 * Set cache directly (used when data comes from user.duck.js)
 * @param {Object} viewedTransactions - Object with transactionId: timestamp
 */
export const setViewedTransactionsCache = (viewedTransactions) => {
  viewedTransactionsCache = viewedTransactions || {};
  cacheInitialized = true;
};

/**
 * Get cached viewed transactions
 */
export const getViewedTransactionsCache = () => viewedTransactionsCache;

/**
 * Mark transaction as viewed - updates server and local cache
 * @param {string} transactionId - Transaction UUID
 * @param {string} userId - Current user UUID
 */
export const markTransactionAsViewed = async (transactionId, userId) => {
  if (!transactionId || !userId) return;
  
  const now = Date.now();
  
  // Update local cache immediately for responsive UI
  viewedTransactionsCache[transactionId] = now;
  
  // Sync to server in background
  try {
    await fetch('/api/viewed-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, transactionId }),
    });
  } catch (error) {
    console.error('Error syncing viewed transaction to server:', error);
  }
};

/**
 * Mark multiple transactions as viewed
 * @param {Array<string>} transactionIds - Array of transaction UUIDs
 * @param {string} userId - Current user UUID
 */
export const markTransactionsBatchViewed = async (transactionIds, userId) => {
  if (!transactionIds?.length || !userId) return;
  
  const now = Date.now();
  
  // Update local cache immediately
  transactionIds.forEach(txId => {
    viewedTransactionsCache[txId] = now;
  });
  
  // Sync to server in background
  try {
    await fetch('/api/viewed-transactions/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, transactionIds }),
    });
  } catch (error) {
    console.error('Error syncing viewed transactions batch to server:', error);
  }
};

/**
 * Get timestamp when transaction was last viewed by user
 * @param {string} transactionId - Transaction UUID
 * @returns {number|null} Timestamp in milliseconds or null if never viewed
 */
export const getTransactionLastViewedAt = (transactionId) => {
  return viewedTransactionsCache[transactionId] || null;
};

/**
 * Check if transaction has unread updates
 * @param {Object} transaction - Transaction entity from Sharetribe API
 * @param {string} currentUserId - Current user UUID (not used but kept for API compatibility)
 * @returns {boolean} True if transaction has unread updates
 */
export const hasUnreadUpdates = (transaction, currentUserId) => {
  if (!transaction || !transaction.id) {
    return false;
  }

  const transactionId = transaction.id.uuid;
  const lastViewedAt = getTransactionLastViewedAt(transactionId);

  // If cache not initialized yet, don't show false positives
  if (!cacheInitialized) {
    return false;
  }

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
 * Clear cache (useful for logout)
 */
export const clearViewedTransactionsCache = () => {
  viewedTransactionsCache = {};
  cacheInitialized = false;
};

