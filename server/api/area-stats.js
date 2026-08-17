/**
 * "Here is what has actually been done in your area" — proof for the task wizard.
 *
 * Built only from YouDu's own completed transactions. Nothing is scraped,
 * blended in from Google, or inferred from chat groups: every number here is
 * something the marketplace itself carried out, which is what makes it hard to
 * copy and safe to publish.
 *
 * THRESHOLD. A cell is returned only once it holds at least three completed
 * orders from three *different* specialists. One person with three finished
 * jobs would turn a statistic into an advert for that person, and "1 order in
 * Dubai Marina" reads as an empty marketplace. Below the threshold the endpoint
 * returns null and the UI stays silent rather than showing a weak number.
 *
 * The community is derived from the listing's geolocation at aggregation time
 * rather than read from `publicData.communityId`. Coordinates are the fact;
 * the stored id is a cached opinion. Deriving it means the district map can be
 * corrected later and every past order re-files itself, and it works for the
 * listings that predate the field entirely.
 */

const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const { createCache } = require('../api-util/cache');
const { queryAllPages } = require('../api-util/paginate');
const { COMPLETED_TRANSITIONS } = require('../api-util/reputation');
const { resolveCommunity, resolveCommunityForListing } = require('../api-util/communities');

// Completed orders accumulate slowly, so a long TTL costs nothing in freshness
// and keeps the wizard from re-running a full transaction scan.
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_KEY = 'all';

const MIN_ORDERS = 3;
const MIN_SPECIALISTS = 3;

const statsCache = createCache({ ttlMs: CACHE_TTL_MS });

const cellKey = (communityId, category) => `${communityId}|${category}`;

const bump = (map, key, specialistId) => {
  const cell = map.get(key) || { orders: 0, specialists: new Set() };
  cell.orders += 1;
  if (specialistId) {
    cell.specialists.add(specialistId);
  }
  map.set(key, cell);
};

/**
 * Returns the cell only when it clears the threshold, so callers cannot
 * accidentally render a number that was never meant to be shown.
 */
const publish = cell => {
  if (!cell) return null;

  const specialistCount = cell.specialists.size;
  if (cell.orders < MIN_ORDERS || specialistCount < MIN_SPECIALISTS) {
    return null;
  }

  return { orders: cell.orders, specialists: specialistCount };
};

const buildStats = async () => {
  const integrationSdk = sharetribeIntegrationSdk.createInstance({
    clientId: process.env.INTEGRATION_API_CLIENT_ID,
    clientSecret: process.env.INTEGRATION_API_CLIENT_SECRET,
  });

  const { items: transactions, included } = await queryAllPages(({ page, perPage }) =>
    integrationSdk.transactions.query({
      lastTransitions: COMPLETED_TRANSITIONS,
      // `customer` has to be included, not just referenced: Sharetribe only
      // returns the relationships that were asked for, and without it every
      // cell reports zero distinct specialists and silently fails the
      // threshold. Sparse fieldsets keep the sideloaded resources small —
      // nothing here needs user profiles or listing titles.
      include: ['listing', 'customer'],
      'fields.listing': ['geolocation', 'publicData'],
      'fields.user': [],
      page,
      perPage,
    })
  );

  const listingsById = new Map(
    included.filter(item => item.type === 'listing').map(item => [item.id.uuid, item])
  );

  const byCity = new Map(); // category -> cell
  const byArea = new Map(); // "communityId|category" -> cell

  transactions.forEach(transaction => {
    const listingId = transaction.relationships?.listing?.data?.id?.uuid;
    const listing = listingId ? listingsById.get(listingId) : null;
    if (!listing) return;

    const publicData = listing.attributes?.publicData || {};
    const category = publicData.categoryLevel1 || publicData.category;
    if (!category) return;

    // Sharetribe's customer is YouDu's specialist — see ROLE in api-util/reputation.js.
    const specialistId = transaction.relationships?.customer?.data?.id?.uuid;

    bump(byCity, category, specialistId);

    const community = resolveCommunityForListing(listing);
    if (community) {
      bump(byArea, cellKey(community.id, category), specialistId);
    }
  });

  console.log(
    `📍 Area stats rebuilt: ${transactions.length} completed orders, ` +
      `${byCity.size} categories, ${byArea.size} district cells (cache miss)`
  );

  return { byCity, byArea };
};

module.exports = (req, res) => {
  if (!process.env.INTEGRATION_API_CLIENT_ID || !process.env.INTEGRATION_API_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Integration API credentials not configured' });
  }

  const { category, lat, lng } = req.query;

  if (!category) {
    return res.status(400).json({ error: 'category is required' });
  }

  statsCache
    .get(CACHE_KEY, buildStats)
    .then(({ byCity, byArea }) => {
      const community = lat && lng ? resolveCommunity(lat, lng) : null;
      const area = community ? publish(byArea.get(cellKey(community.id, category))) : null;

      res.set('Cache-Control', `public, max-age=${CACHE_TTL_MS / 1000}`);
      res.status(200).json({
        city: publish(byCity.get(category)),
        area: area ? { ...area, communityId: community.id, communityLabel: community.label } : null,
      });
    })
    .catch(err => {
      console.error('❌ Area stats failed:', err?.message);
      res.status(500).json({ error: 'Query failed' });
    });
};
