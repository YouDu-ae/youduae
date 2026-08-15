/**
 * Real reviews for the landing page.
 *
 * Replaces the invented testimonials that used to be hardcoded in
 * LandingPage.js — made-up names under a "real reviews" heading are a
 * reputational risk, and UAE advertising rules treat them as misleading.
 *
 * Only reviews earned by specialists are returned. Note the inverted Sharetribe
 * vocabulary described in api-util/reputation.js: the client posts the task and
 * is the Sharetribe *provider*, so praise for a specialist arrives as an
 * `ofCustomer` review.
 */

const integrationSdk = require('sharetribe-flex-integration-sdk');
const { handleError } = require('../api-util/sdk');
const { createCache } = require('../api-util/cache');
const { queryAllPages } = require('../api-util/paginate');
const { ROLE, REVIEW_TYPE_BY_ROLE } = require('../api-util/reputation');

const INTEGRATION_CLIENT_ID = process.env.INTEGRATION_API_CLIENT_ID;
const INTEGRATION_CLIENT_SECRET = process.env.INTEGRATION_API_CLIENT_SECRET;
const TRANSIT_VERBOSE = process.env.REACT_APP_SHARETRIBE_SDK_TRANSIT_VERBOSE === 'true';

// A public marketing block: minutes of staleness cost nothing, and this keeps
// the Integration API off the per-view path.
const CACHE_TTL_MS = 15 * 60 * 1000;

const reviewsCache = createCache({ ttlMs: CACHE_TTL_MS, maxEntries: 1 });

// How many cards the landing page shows at most.
const MAX_REVIEWS = 6;

// One-word reviews ("все отлично))") are genuine but read as filler on a
// storefront and undermine the very trust this block exists to build.
const MIN_CONTENT_LENGTH = 20;

const SPECIALIST_REVIEW_TYPE = REVIEW_TYPE_BY_ROLE[ROLE.SPECIALIST];

const resourceKey = ref => (ref ? `${ref.type || 'user'}:${ref.id.uuid}` : null);

/**
 * Flattens transactions into the specialist reviews worth showing.
 *
 * Reviews are read through transactions rather than a review query because the
 * task each one belongs to is what the card actually displays: most of the
 * reviewed specialists have since deleted their accounts, leaving no name,
 * category or avatar to show, while the task title survives and explains what
 * the review is about.
 */
const collectReviews = ({ transactions, included }) => {
  const byId = included.reduce((acc, resource) => {
    acc[`${resource.type}:${resource.id.uuid}`] = resource;
    return acc;
  }, {});

  const collected = [];

  transactions.forEach(tx => {
    const listing = byId[resourceKey(tx.relationships?.listing?.data)];
    const taskTitle = listing?.attributes?.title;

    // Deleted tasks come back without a title, which would leave the card
    // without the context that replaces the specialist's name.
    if (!taskTitle) return;

    (tx.relationships?.reviews?.data || []).forEach(ref => {
      const review = byId[resourceKey({ ...ref, type: 'review' })];
      if (!review) return;

      const { type, state, rating, content, createdAt } = review.attributes;

      if (type !== SPECIALIST_REVIEW_TYPE || state !== 'public' || !rating) return;

      const text = (content || '').trim();
      if (text.length < MIN_CONTENT_LENGTH) return;

      const author = byId[resourceKey(review.relationships?.author?.data)];
      const authorProfile = author?.attributes?.profile;

      // The author is the client who posted the task. Their display name is
      // already public wherever this review is shown on the marketplace.
      if (!authorProfile?.displayName) return;

      collected.push({
        id: review.id.uuid,
        rating,
        content: text,
        createdAt,
        authorName: authorProfile.displayName,
        authorInitials: authorProfile.abbreviatedName || null,
        taskTitle,
      });
    });
  });

  return collected
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, MAX_REVIEWS);
};

const fetchLandingReviews = async () => {
  const sdk = integrationSdk.createInstance({
    clientId: INTEGRATION_CLIENT_ID,
    clientSecret: INTEGRATION_CLIENT_SECRET,
    transitVerbose: TRANSIT_VERBOSE,
  });

  const { items, included } = await queryAllPages(({ page, perPage }) =>
    sdk.transactions.query({
      include: ['reviews', 'reviews.author', 'listing'],
      page,
      perPage,
    })
  );

  const reviews = collectReviews({ transactions: items, included });

  console.log(
    `⭐ [Landing Reviews] ${reviews.length} reviews from ${items.length} transactions (cache miss)`
  );

  return { reviews };
};

module.exports = (req, res) => {
  if (!INTEGRATION_CLIENT_ID || !INTEGRATION_CLIENT_SECRET) {
    console.error('❌ [Landing Reviews] Integration API credentials are missing');
    // An empty list hides the block instead of failing the landing page.
    return res.status(200).json({ reviews: [] });
  }

  reviewsCache
    .get('landing-reviews', fetchLandingReviews)
    .then(payload => {
      res.set('Cache-Control', `public, max-age=${CACHE_TTL_MS / 1000}`);
      res.status(200).json(payload);
    })
    .catch(e => {
      console.error('❌ [Landing Reviews] Error:', e?.status, e?.statusText || e?.message);
      handleError(res, e);
    });
};
