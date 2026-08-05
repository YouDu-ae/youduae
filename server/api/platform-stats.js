/**
 * API endpoint to fetch platform-wide statistics:
 * - Total completed tasks (transactions in 'complete' state)
 * - Total transaction value in AED
 */

const integrationSdk = require('sharetribe-flex-integration-sdk');
const { handleError } = require('../api-util/sdk');
const { createCache } = require('../api-util/cache');

// Use Integration API credentials for accessing transaction data
const INTEGRATION_CLIENT_ID = process.env.INTEGRATION_API_CLIENT_ID;
const INTEGRATION_CLIENT_SECRET = process.env.INTEGRATION_API_CLIENT_SECRET;
const TRANSIT_VERBOSE = process.env.REACT_APP_SHARETRIBE_SDK_TRANSIT_VERBOSE === 'true';

// Marketing counters on a public page: minutes of staleness are harmless, and
// this keeps the Integration API out of the per-view path.
const CACHE_TTL_MS = 15 * 60 * 1000;

const statsCache = createCache({ ttlMs: CACHE_TTL_MS, maxEntries: 1 });

const EXCLUDED_TRANSITIONS = [
  'transition/decline',
  'transition/cancel',
  'transition/expire',
  'transition/operator-cancel',
  'transition/payment-expired',
];

const fetchPlatformStats = async () => {
  const integrationSdkInstance = integrationSdk.createInstance({
    clientId: INTEGRATION_CLIENT_ID,
    clientSecret: INTEGRATION_CLIENT_SECRET,
    transitVerbose: TRANSIT_VERBOSE,
  });

  const response = await integrationSdkInstance.transactions.query({
    include: ['listing'],
    perPage: 100,
  });

  const allTransactions = response.data.data;

  // Count everything that is in progress or done, excluding dead-end states.
  const activeTransactions = allTransactions.filter(
    tx => !EXCLUDED_TRANSITIONS.includes(tx.attributes.lastTransition)
  );

  // In assignment-flow-v3 (inquiry process) the price lives in
  // protectedData.offer.price and is already in AED; purchase and booking
  // processes report payinTotal in cents.
  let totalSumAED = 0;

  activeTransactions.forEach(tx => {
    const payinTotal = tx.attributes.payinTotal;
    const protectedData = tx.attributes.protectedData || {};

    if (payinTotal && payinTotal.currency === 'AED') {
      totalSumAED += payinTotal.amount / 100;
    } else if (
      protectedData.offer &&
      protectedData.offer.price &&
      protectedData.offer.currency === 'AED'
    ) {
      totalSumAED += protectedData.offer.price;
    }
  });

  console.log(
    `📊 [Platform Stats] ${activeTransactions.length} active tasks, ${totalSumAED.toFixed(2)} AED (cache miss)`
  );

  return {
    data: {
      totalCompletedTasks: activeTransactions.length,
      totalSumAED,
      _debug: {
        totalTransactionsFetched: allTransactions.length,
        activeCount: activeTransactions.length,
      },
    },
  };
};

module.exports = (req, res) => {
  if (!INTEGRATION_CLIENT_ID || !INTEGRATION_CLIENT_SECRET) {
    console.error('❌ [Platform Stats] Integration API credentials are missing');
    return res.status(500).json({
      error: 'Integration API credentials not configured',
      data: {
        totalCompletedTasks: 0,
        totalSumAED: 0,
      },
    });
  }

  statsCache
    .get('platform-stats', fetchPlatformStats)
    .then(payload => {
      res.set('Cache-Control', `public, max-age=${CACHE_TTL_MS / 1000}`);
      res.status(200).send(payload);
    })
    .catch(e => {
      console.error('❌ [Platform Stats] Error:', e);
      handleError(res, e);
    });
};
