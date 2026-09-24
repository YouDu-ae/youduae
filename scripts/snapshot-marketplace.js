/**
 * Copies every listing and transaction into marketplace_snapshots.
 *
 * The event archive only reaches back 90 days, as far as Sharetribe keeps
 * events. Listings and transactions older than that are still in Sharetribe,
 * and a transaction carries its dated transitions, so one copy of the current
 * state preserves their lifecycle in YouDu's own database. Safe to re-run:
 * each run adds a new dated copy.
 *
 * Usage:
 *   heroku run node scripts/snapshot-marketplace.js --app youdu
 *   heroku run node scripts/snapshot-marketplace.js --dry-run --app youdu
 */

require('dotenv').config();

const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const db = require('../server/db');
const { toPlain, collectUserIds } = require('../server/reminders/eventArchive');

const PER_PAGE = 100;
const DRY_RUN = process.argv.includes('--dry-run');

const integrationSdk = sharetribeIntegrationSdk.createInstance({
  clientId: process.env.INTEGRATION_API_CLIENT_ID,
  clientSecret: process.env.INTEGRATION_API_CLIENT_SECRET,
});

// Integration API returns whole users, e-mail and phone included; a copy of a
// deal needs only who took part in it.
const minimalUser = user => ({
  id: user.id,
  type: 'user',
  displayName: user.attributes?.profile?.displayName || null,
});

/** A resource with the entities it includes, all as plain JSON. */
const withIncluded = (resource, included) => {
  const byKey = new Map(
    included.map(item => [`${item.type}/${item.id}`, item.type === 'user' ? minimalUser(item) : item])
  );
  const relations = {};
  Object.entries(resource.relationships || {}).forEach(([name, rel]) => {
    const data = rel?.data;
    const refs = Array.isArray(data) ? data : data ? [data] : [];
    relations[name] = refs.map(ref => byKey.get(`${ref.type}/${ref.id}`) || ref);
  });
  return { ...resource, included: relations };
};

const snapshotAll = async ({ resourceType, query, params }) => {
  const takenAt = new Date().toISOString();
  let page = 1;
  let totalPages = 1;
  let count = 0;

  while (page <= totalPages) {
    const response = await query({ ...params, page, perPage: PER_PAGE });
    const data = toPlain(response.data.data);
    const included = toPlain(response.data.included || []);
    totalPages = response.data.meta.totalPages || 1;

    const rows = data.map(resource => {
      const payload = withIncluded(resource, included);
      return {
        resourceType,
        resourceId: resource.id,
        takenAt,
        userIds: [...collectUserIds(payload)],
        payload,
      };
    });

    if (!DRY_RUN) {
      await db.saveMarketplaceSnapshots(rows);
    }
    count += rows.length;
    page += 1;
  }
  return count;
};

const run = async () => {
  await db.initDatabase();

  const listings = await snapshotAll({
    resourceType: 'listing',
    query: params => integrationSdk.listings.query(params),
    params: { include: ['author'] },
  });
  console.log(`listings: ${listings}`);

  const transactions = await snapshotAll({
    resourceType: 'transaction',
    query: params => integrationSdk.transactions.query(params),
    params: { include: ['customer', 'provider', 'listing', 'reviews'] },
  });
  console.log(`transactions: ${transactions}`);

  console.log(DRY_RUN ? 'dry run: nothing written' : 'snapshot saved');
};

run()
  .catch(error => {
    console.error('snapshot failed:', error.status || '', error.data || error.message);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
