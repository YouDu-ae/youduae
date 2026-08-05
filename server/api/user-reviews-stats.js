const { getSdk, handleError, serialize } = require('../api-util/sdk');
const { createCache } = require('../api-util/cache');

const REVIEWS_CACHE_TTL_MS = 5 * 60 * 1000;

// Public reviews depend only on the subject, so they are safe to share between
// callers. The transaction query below is scoped to the requesting user's own
// sales and must stay outside the cache.
const reviewsCache = createCache({ ttlMs: REVIEWS_CACHE_TTL_MS, maxEntries: 200 });

/**
 * Get review statistics for a user
 * Returns average rating and review count
 */
module.exports = (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' }).end();
  }

  const sdk = getSdk(req, res);

  // Query reviews where this user is the subject (reviews about them)
  const reviewsPromise = reviewsCache.get(userId, () =>
    sdk.reviews.query({
      subject_id: userId,
      state: 'public',
      perPage: 100, // Get all reviews to calculate average
    })
  );

  // Query transactions where this user is the provider and status is completed
  const transactionsPromise = sdk.transactions.query({
    only: 'sale',
    last_transitions: ['transition/complete', 'transition/review-1-by-provider', 'transition/review-1-by-customer', 'transition/review-2-by-provider', 'transition/review-2-by-customer'],
    perPage: 100,
  });

  Promise.all([reviewsPromise, transactionsPromise])
    .then(([reviewsResponse, transactionsResponse]) => {
      const { status, statusText } = reviewsResponse;
      const reviews = reviewsResponse.data.data || [];
      const transactions = transactionsResponse.data.data || [];

      // Calculate average rating
      let totalRating = 0;
      let count = 0;
      
      reviews.forEach(review => {
        const rating = review.attributes?.rating;
        if (rating) {
          totalRating += rating;
          count++;
        }
      });
      
      const averageRating = count > 0 ? totalRating / count : 0;
      
      // Count completed tasks where user is provider
      const completedCount = transactions.filter(tx => {
        const providerId = tx.relationships?.provider?.data?.id?.uuid;
        return providerId === userId;
      }).length;

      res
        .status(status)
        .set('Content-Type', 'application/transit+json')
        .send(
          serialize({
            status,
            statusText,
            data: {
              userId,
              reviewCount: count,
              averageRating: parseFloat(averageRating.toFixed(2)),
              completedCount,
            },
          })
        )
        .end();
    })
    .catch(e => {
      console.error('❌ user-reviews-stats error:', e?.status, e?.statusText);
      handleError(res, e);
    });
};

