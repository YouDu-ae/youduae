/**
 * API for tracking viewed transactions (read/unread state)
 * Stores lastViewedAt timestamps in user's privateData
 * This syncs across all devices for the same user
 */

const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');

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

/**
 * GET /api/viewed-transactions
 * Get all viewed transaction timestamps for user
 */
const getViewedTransactions = async (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  try {
    const integrationSdk = getIntegrationSdk();
    
    const userResponse = await integrationSdk.users.show({
      id: userId,
    });
    
    const privateData = userResponse.data.data.attributes.profile.privateData || {};
    const viewedTransactions = privateData.viewedTransactions || {};
    
    res.json({
      success: true,
      viewedTransactions,
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
  const { userId, transactionId } = req.body;
  
  if (!userId || !transactionId) {
    return res.status(400).json({ error: 'userId and transactionId are required' });
  }
  
  try {
    const integrationSdk = getIntegrationSdk();
    
    // Get current viewedTransactions
    const userResponse = await integrationSdk.users.show({
      id: userId,
    });
    
    const privateData = userResponse.data.data.attributes.profile.privateData || {};
    const viewedTransactions = privateData.viewedTransactions || {};
    
    // Update with new timestamp
    const now = Date.now();
    viewedTransactions[transactionId] = now;
    
    // Clean up old entries (older than 90 days) to prevent data bloat
    const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
    Object.keys(viewedTransactions).forEach(txId => {
      if (now - viewedTransactions[txId] > NINETY_DAYS_MS) {
        delete viewedTransactions[txId];
      }
    });
    
    // Save updated viewedTransactions
    await integrationSdk.users.updateProfile({
      id: userId,
      privateData: {
        viewedTransactions,
      },
    });
    
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
  const { userId, transactionIds } = req.body;
  
  if (!userId || !transactionIds || !Array.isArray(transactionIds)) {
    return res.status(400).json({ error: 'userId and transactionIds array are required' });
  }
  
  try {
    const integrationSdk = getIntegrationSdk();
    
    // Get current viewedTransactions
    const userResponse = await integrationSdk.users.show({
      id: userId,
    });
    
    const privateData = userResponse.data.data.attributes.profile.privateData || {};
    const viewedTransactions = privateData.viewedTransactions || {};
    
    // Update all transactions with current timestamp
    const now = Date.now();
    transactionIds.forEach(txId => {
      viewedTransactions[txId] = now;
    });
    
    // Clean up old entries
    const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
    Object.keys(viewedTransactions).forEach(txId => {
      if (now - viewedTransactions[txId] > NINETY_DAYS_MS) {
        delete viewedTransactions[txId];
      }
    });
    
    // Save updated viewedTransactions
    await integrationSdk.users.updateProfile({
      id: userId,
      privateData: {
        viewedTransactions,
      },
    });
    
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
