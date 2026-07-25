/**
 * API endpoint to fetch platform-wide statistics:
 * - Total completed tasks (transactions in 'complete' state)
 * - Total transaction value in AED
 */

const integrationSdk = require('sharetribe-flex-integration-sdk');
const { handleError } = require('../api-util/sdk');

// Use Integration API credentials for accessing transaction data
const INTEGRATION_CLIENT_ID = process.env.INTEGRATION_API_CLIENT_ID;
const INTEGRATION_CLIENT_SECRET = process.env.INTEGRATION_API_CLIENT_SECRET;
const TRANSIT_VERBOSE = process.env.REACT_APP_SHARETRIBE_SDK_TRANSIT_VERBOSE === 'true';

module.exports = (req, res) => {
  // Check if Integration API credentials are configured
  if (!INTEGRATION_CLIENT_ID || !INTEGRATION_CLIENT_SECRET) {
    console.error('❌ [Platform Stats] Integration API credentials are missing');
    return res.status(500).json({
      error: 'Integration API credentials not configured',
      data: {
        totalCompletedTasks: 0,
        totalSumAED: 0,
      }
    });
  }

  // Create Integration SDK instance for accessing transaction data
  const integrationSdkInstance = integrationSdk.createInstance({
    clientId: INTEGRATION_CLIENT_ID,
    clientSecret: INTEGRATION_CLIENT_SECRET,
    transitVerbose: TRANSIT_VERBOSE,
  });

  // Query all transactions to see what we have
  integrationSdkInstance.transactions
    .query({
      include: ['listing'],
      perPage: 100,
    })
    .then(response => {
      const allTransactions = response.data.data;
      
      console.log('📊 [Platform Stats] Total transactions fetched:', allTransactions.length);
      
      // Filter active transactions (exclude only canceled/declined/expired ones)
      // We count all tasks that are in progress or completed
      const excludedTransitions = [
        'transition/decline',
        'transition/cancel',
        'transition/expire',
        'transition/operator-cancel',
        'transition/payment-expired',
      ];
      
      const activeTransactions = allTransactions.filter(tx => {
        const lastTransition = tx.attributes.lastTransition;
        return !excludedTransitions.some(excluded => lastTransition === excluded);
      });
      
      const totalCount = activeTransactions.length;

      // Calculate total sum from all active transactions
      // In assignment-flow-v3 (inquiry process), price is in protectedData.offer.price (already in AED)
      // In purchase/booking processes, price is in payinTotal (in cents)
      let totalSum = 0;
      
      activeTransactions.forEach((tx) => {
        const payinTotal = tx.attributes.payinTotal;
        const protectedData = tx.attributes.protectedData || {};
        
        // Try payinTotal first (for purchase/booking processes)
        if (payinTotal && payinTotal.currency === 'AED') {
          totalSum += payinTotal.amount / 100; // Convert cents to AED
        }
        // For inquiry process (assignment-flow-v3), price is in protectedData.offer.price
        else if (protectedData.offer && protectedData.offer.price && protectedData.offer.currency === 'AED') {
          totalSum += protectedData.offer.price; // Already in AED
        }
      });

      const totalSumAED = totalSum;
      
      console.log('📊 [Platform Stats] Active:', totalCount, 'tasks, Total:', totalSumAED.toFixed(2), 'AED');

      res.status(200).send({
        data: {
          totalCompletedTasks: totalCount,
          totalSumAED: totalSumAED,
          _debug: {
            totalTransactionsFetched: allTransactions.length,
            activeCount: totalCount,
          }
        },
      });
    })
    .catch(e => {
      console.error('❌ [Platform Stats] Error:', e);
      handleError(res, e);
    });
};

