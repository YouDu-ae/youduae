const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const sharetribeSdk = require('sharetribe-flex-sdk');
const { createCache } = require('../api-util/cache');

const CACHE_TTL_MS = 5 * 60 * 1000;

// Sharetribe caps the Integration API at 10 concurrent requests per IP, and the
// whole app shares one dyno IP. Each executor costs two upstream calls, so keep
// the fan-out well under that ceiling to leave room for other endpoints.
const MAX_CONCURRENT_EXECUTOR_LOOKUPS = 4;

const executorsCache = createCache({ ttlMs: CACHE_TTL_MS });

const COMPLETED_TRANSITIONS = [
  'transition/complete',
  'transition/review-1-by-customer',
  'transition/review-2-by-customer',
  'transition/review-1-by-provider',
  'transition/review-2-by-provider',
];

/** Runs `task` over `items`, keeping at most `limit` calls in flight. */
const mapWithConcurrency = async (items, limit, task) => {
  const results = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await task(items[index], index);
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
};

/**
 * Ranking order: verified with reviews, then verified only, then reviewed only,
 * then by rating, and finally newest first.
 */
const compareExecutors = (a, b) => {
  const aVerified = a.isVerified;
  const bVerified = b.isVerified;
  const aHasReviews = a.reviews.count > 0;
  const bHasReviews = b.reviews.count > 0;

  const aBoth = aVerified && aHasReviews;
  const bBoth = bVerified && bHasReviews;

  if (aBoth && !bBoth) return -1;
  if (!aBoth && bBoth) return 1;

  if (aBoth && bBoth) {
    if (b.reviews.averageRating !== a.reviews.averageRating) {
      return b.reviews.averageRating - a.reviews.averageRating;
    }
    if (b.reviews.count !== a.reviews.count) {
      return b.reviews.count - a.reviews.count;
    }
  }

  const aVerifiedOnly = aVerified && !aHasReviews;
  const bVerifiedOnly = bVerified && !bHasReviews;

  if (aVerifiedOnly && !bVerifiedOnly) return -1;
  if (!aVerifiedOnly && bVerifiedOnly) return 1;

  const aReviewsOnly = !aVerified && aHasReviews;
  const bReviewsOnly = !bVerified && bHasReviews;

  if (aReviewsOnly && !bReviewsOnly) return -1;
  if (!aReviewsOnly && bReviewsOnly) return 1;

  if (aReviewsOnly && bReviewsOnly) {
    if (b.reviews.averageRating !== a.reviews.averageRating) {
      return b.reviews.averageRating - a.reviews.averageRating;
    }
    if (b.reviews.count !== a.reviews.count) {
      return b.reviews.count - a.reviews.count;
    }
  }

  if (b.reviews.averageRating !== a.reviews.averageRating) {
    return b.reviews.averageRating - a.reviews.averageRating;
  }

  return new Date(b.createdAt) - new Date(a.createdAt);
};

const buildExecutor = async ({ user, included, integrationSdk, marketplaceSdk }) => {
  const profileImage = included.find(
    item =>
      item.type === 'image' &&
      item.id.uuid === user.relationships?.profileImage?.data?.id?.uuid
  );

  let reviewCount = 0;
  let averageRating = 0;
  let completedTasksCount = 0;

  try {
    const reviewsResponse = await marketplaceSdk.reviews.query({
      subjectId: user.id.uuid,
      state: 'public',
      perPage: 100,
    });
    const reviews = reviewsResponse.data.data;
    reviewCount = reviews.length;
    const totalRating = reviews.reduce((sum, review) => sum + (review.attributes.rating || 0), 0);
    averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;
  } catch (err) {
    console.error('❌ Error fetching reviews for user:', user.id.uuid, err.message);
  }

  // In YouDu terms a Sharetribe "customer" is the executor doing the work.
  try {
    const transactionsResponse = await integrationSdk.transactions.query({
      customerId: user.id.uuid,
      perPage: 100,
    });
    const allTx = transactionsResponse.data.data || [];
    completedTasksCount = allTx.filter(tx =>
      COMPLETED_TRANSITIONS.includes(tx.attributes.lastTransition)
    ).length;
  } catch (err) {
    console.error('❌ Error fetching transactions for user:', user.id.uuid, err.message);
  }

  return {
    id: user.id.uuid,
    displayName: user.attributes.profile.displayName,
    abbreviatedName: user.attributes.profile.abbreviatedName,
    bio: user.attributes.profile.bio || '',
    publicData: user.attributes.profile.publicData || {},
    metadata: user.attributes.profile.metadata || {},
    isVerified: user.attributes.profile.metadata?.isVerified === true,
    createdAt: user.attributes.createdAt,
    profileImage,
    reviews: {
      count: reviewCount,
      averageRating: Math.round(averageRating * 10) / 10,
    },
    completedTasks: completedTasksCount,
  };
};

const fetchExecutors = async category => {
  const integrationSdk = sharetribeIntegrationSdk.createInstance({
    clientId: process.env.INTEGRATION_API_CLIENT_ID,
    clientSecret: process.env.INTEGRATION_API_CLIENT_SECRET,
  });

  const marketplaceSdk = sharetribeSdk.createInstance({
    clientId: process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID,
    clientSecret: process.env.SHARETRIBE_SDK_CLIENT_SECRET,
  });

  const response = await integrationSdk.users.query({
    include: ['profileImage'],
    perPage: 100,
  });

  const users = response.data.data;
  const included = response.data.included || [];

  const filteredUsers = users.filter(user => {
    const serviceCategories = user.attributes?.profile?.publicData?.serviceCategories;
    return Array.isArray(serviceCategories) && serviceCategories.includes(category);
  });

  const executors = await mapWithConcurrency(
    filteredUsers,
    MAX_CONCURRENT_EXECUTOR_LOOKUPS,
    user => buildExecutor({ user, included, integrationSdk, marketplaceSdk })
  );

  const sortedExecutors = executors.sort(compareExecutors);

  console.log(
    `🔍 Executors for "${category}": ${sortedExecutors.length} of ${users.length} users (cache miss)`
  );

  return {
    data: sortedExecutors,
    meta: {
      totalCount: sortedExecutors.length,
      category,
    },
  };
};

module.exports = (req, res) => {
  const { category } = req.query;

  if (!category) {
    return res.status(400).json({ error: 'Category parameter is required' });
  }

  if (!process.env.INTEGRATION_API_CLIENT_ID || !process.env.INTEGRATION_API_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Integration API credentials not configured' });
  }

  executorsCache
    .get(category, () => fetchExecutors(category))
    .then(payload => {
      res.set('Cache-Control', `public, max-age=${CACHE_TTL_MS / 1000}`);
      res.status(200).json(payload);
    })
    .catch(err => {
      const status = err?.status || err?.statusCode;
      const data = err?.data || err?.response?.data;

      console.error('❌ Executor search failed:', {
        message: err?.message,
        status,
        apiErrors: data?.errors || data,
      });

      res.status(500).json({
        error: 'Query failed',
        details: err?.message,
        status,
      });
    });
};
