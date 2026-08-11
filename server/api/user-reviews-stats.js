const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const sharetribeSdk = require('sharetribe-flex-sdk');
const { handleError, serialize } = require('../api-util/sdk');
const { createCache } = require('../api-util/cache');
const { parseRole, fetchReviewStats, fetchCompletedCount } = require('../api-util/reputation');

const CACHE_TTL_MS = 5 * 60 * 1000;

// Everything returned here is derived from the subject user alone, never from
// who is asking, so one cached entry can serve every caller. OfferList requests
// one of these per offer, which makes the de-duplication worth having.
const statsCache = createCache({ ttlMs: CACHE_TTL_MS, maxEntries: 500 });

let marketplaceSdkInstance = null;
let integrationSdkInstance = null;

// Both are built on first use: creating them at module load crashes the whole
// API router in environments where the credentials are absent.
const getMarketplaceSdk = () => {
  if (!marketplaceSdkInstance) {
    marketplaceSdkInstance = sharetribeSdk.createInstance({
      clientId: process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID,
      clientSecret: process.env.SHARETRIBE_SDK_CLIENT_SECRET,
    });
  }
  return marketplaceSdkInstance;
};

const getIntegrationSdk = () => {
  if (!integrationSdkInstance) {
    integrationSdkInstance = sharetribeIntegrationSdk.createInstance({
      clientId: process.env.INTEGRATION_API_CLIENT_ID,
      clientSecret: process.env.INTEGRATION_API_CLIENT_SECRET,
    });
  }
  return integrationSdkInstance;
};

/**
 * Public reputation for one user: average rating, review count and how many
 * tasks they completed.
 *
 * `role` selects which side of the marketplace to report on — `specialist`
 * (default) for someone doing the work, `client` for someone posting tasks. A
 * user active on both sides has separate standings, and mixing them is wrong in
 * both directions.
 *
 * Only published reviews and completed transaction counts are exposed, so the
 * response is the same for every caller and is served with application
 * credentials rather than the requester's session.
 */
module.exports = (req, res) => {
  const { userId } = req.query;
  const role = parseRole(req.query.role);

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' }).end();
  }

  const hasIntegrationCredentials =
    !!process.env.INTEGRATION_API_CLIENT_ID && !!process.env.INTEGRATION_API_CLIENT_SECRET;

  const buildStats = async () => {
    const [reviews, completedCount] = await Promise.all([
      fetchReviewStats(getMarketplaceSdk(), { subjectId: userId, role }),
      hasIntegrationCredentials
        ? fetchCompletedCount(getIntegrationSdk(), { userId, role })
        : Promise.resolve(0),
    ]);

    return {
      userId,
      role,
      reviewCount: reviews.count,
      averageRating: reviews.averageRating,
      completedCount,
    };
  };

  statsCache
    .get(`${role}:${userId}`, buildStats)
    .then(data => {
      res
        .status(200)
        .set('Content-Type', 'application/transit+json')
        .send(serialize({ status: 200, statusText: 'OK', data }))
        .end();
    })
    .catch(e => {
      console.error('❌ user-reviews-stats error:', e?.status, e?.statusText || e?.message);
      handleError(res, e);
    });
};
