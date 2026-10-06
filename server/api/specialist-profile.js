const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const sharetribeSdk = require('sharetribe-flex-sdk');
const { createCache } = require('../api-util/cache');
const {
  ROLE,
  resolveIsVerified,
  fetchReviewStats,
  fetchCompletedCount,
} = require('../api-util/reputation');

const CACHE_TTL_MS = 5 * 60 * 1000;

// The website's uploader stops at five photos, but some older profiles hold more.
const MAX_PORTFOLIO_PHOTOS = 5;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The response depends only on the specialist, never on who is asking, so one
// cached entry serves every caller. Freshly approved photos show up once the
// entry expires.
const profileCache = createCache({ ttlMs: CACHE_TTL_MS, maxEntries: 500 });

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
 * Photos a specialist uploads on the website wait in `publicData.portfolio` as
 * `pending` until the operator approves them in Console. Only approved ones
 * are public — the same rule the website's profile page follows.
 */
const approvedPortfolio = portfolio => {
  if (!Array.isArray(portfolio)) {
    return [];
  }

  const seen = new Set();
  const photos = [];

  for (const item of portfolio) {
    const url = item?.imageUrl;
    if (item?.status !== 'approved' || typeof url !== 'string' || !url.startsWith('https://')) {
      continue;
    }

    // The entries are edited by hand in Console, so the id may be missing.
    const id = typeof item.imageId === 'string' && item.imageId ? item.imageId : url;
    if (seen.has(id)) {
      continue;
    }

    seen.add(id);
    photos.push({ id, url });
    if (photos.length === MAX_PORTFOLIO_PHOTOS) {
      break;
    }
  }

  return photos;
};

const avatarUrlOf = (user, included) => {
  const imageId = user.relationships?.profileImage?.data?.id?.uuid;
  const image = imageId
    ? included.find(item => item.type === 'image' && item.id?.uuid === imageId)
    : null;
  const variants = image?.attributes?.variants || {};
  const variant = variants['square-small2x'] || variants['square-small'] || variants.default;
  return variant?.url || null;
};

const notFound = () => Object.assign(new Error('Specialist not found'), { status: 404 });

const buildProfile = async userId => {
  const response = await getIntegrationSdk().users.show({
    id: userId,
    include: ['profileImage'],
    'fields.image': ['variants.square-small', 'variants.square-small2x'],
  });

  const user = response.data.data;
  if (user.attributes.banned || user.attributes.deleted) {
    throw notFound();
  }

  const profile = user.attributes.profile || {};
  const publicData = profile.publicData || {};

  const [reviews, completedTasks] = await Promise.all([
    fetchReviewStats(getMarketplaceSdk(), { subjectId: userId, role: ROLE.SPECIALIST }),
    fetchCompletedCount(getIntegrationSdk(), { userId, role: ROLE.SPECIALIST }),
  ]);

  return {
    id: userId,
    displayName: profile.displayName || '',
    bio: profile.bio || '',
    avatarUrl: avatarUrlOf(user, response.data.included || []),
    isVerified: resolveIsVerified(profile),
    rating: reviews.averageRating,
    reviewCount: reviews.count,
    completedTasks,
    categories: Array.isArray(publicData.serviceCategories) ? publicData.serviceCategories : [],
    memberSince: user.attributes.createdAt,
    portfolio: approvedPortfolio(publicData.portfolio),
  };
};

/**
 * Public profile of a specialist for the mobile app: what the website's
 * profile page shows, including the approved portfolio photos.
 *
 * Screens in the app open a profile knowing little more than a name and an
 * avatar, so this is where the rest comes from. Only public profile fields
 * are returned, read with application credentials rather than the caller's
 * session.
 */
const specialistProfile = (req, res) => {
  const { userId } = req.query;

  if (typeof userId !== 'string' || !UUID_PATTERN.test(userId)) {
    return res.status(400).json({ error: 'userId must be a user UUID' });
  }

  return profileCache
    .get(userId, () => buildProfile(userId))
    .then(data => res.status(200).json({ data }))
    .catch(e => {
      if (e?.status === 404) {
        return res.status(404).json({ error: 'Specialist not found' });
      }
      console.error('❌ specialist-profile error:', e?.status, e?.statusText || e?.message);
      return res.status(500).json({ error: 'Failed to load specialist profile' });
    });
};

module.exports = specialistProfile;
module.exports.approvedPortfolio = approvedPortfolio;
module.exports.profileCache = profileCache;
