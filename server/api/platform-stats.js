/**
 * API endpoint to fetch platform-wide statistics:
 * - Total completed tasks (transactions in 'complete' state)
 * - Total transaction value in AED
 */

const integrationSdk = require('sharetribe-flex-integration-sdk');
const { handleError } = require('../api-util/sdk');
const { createCache } = require('../api-util/cache');
const { COMPLETED_TRANSITIONS } = require('../api-util/reputation');
const { queryAllPages } = require('../api-util/paginate');

// Use Integration API credentials for accessing transaction data
const INTEGRATION_CLIENT_ID = process.env.INTEGRATION_API_CLIENT_ID;
const INTEGRATION_CLIENT_SECRET = process.env.INTEGRATION_API_CLIENT_SECRET;
const TRANSIT_VERBOSE = process.env.REACT_APP_SHARETRIBE_SDK_TRANSIT_VERBOSE === 'true';

// Marketing counters on a public page: minutes of staleness are harmless, and
// this keeps the Integration API out of the per-view path.
const CACHE_TTL_MS = 15 * 60 * 1000;

const statsCache = createCache({ ttlMs: CACHE_TTL_MS, maxEntries: 1 });

/**
 * Value of one finished task in AED.
 *
 * In assignment-flow-v3 the agreed price lives in protectedData.offer.price and
 * is already in AED; the purchase and booking processes report payinTotal in
 * cents instead.
 */
const transactionValueAED = tx => {
  const payinTotal = tx.attributes.payinTotal;
  const offer = (tx.attributes.protectedData || {}).offer;

  if (payinTotal && payinTotal.currency === 'AED') {
    return payinTotal.amount / 100;
  }
  if (offer && offer.price && offer.currency === 'AED') {
    return offer.price;
  }
  return 0;
};

const fetchPlatformStats = async () => {
  const integrationSdkInstance = integrationSdk.createInstance({
    clientId: INTEGRATION_CLIENT_ID,
    clientSecret: INTEGRATION_CLIENT_SECRET,
    transitVerbose: TRANSIT_VERBOSE,
  });

  // The API applies the transition filter, so only finished tasks come back and
  // the count cannot drift from what the reputation figures report. An earlier
  // version fetched everything and subtracted a list of dead-end transitions
  // that assignment-flow-v3 does not declare, so nothing was ever subtracted
  // and every unanswered offer counted as a completed task.
  const { items: completed } = await queryAllPages(({ page, perPage }) =>
    integrationSdkInstance.transactions.query({
      lastTransitions: COMPLETED_TRANSITIONS,
      page,
      perPage,
    })
  );

  const totalSumAED = completed.reduce((sum, tx) => sum + transactionValueAED(tx), 0);

  console.log(
    `📊 [Platform Stats] ${completed.length} completed tasks, ${totalSumAED.toFixed(2)} AED (cache miss)`
  );

  return {
    data: {
      totalCompletedTasks: completed.length,
      totalSumAED,
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
