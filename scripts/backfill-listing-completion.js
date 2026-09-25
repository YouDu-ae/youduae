/**
 * Marks tasks whose deal was completed before the server started writing
 * publicData.status = 'completed' (September 2026).
 *
 * Usage:
 *   heroku run node scripts/backfill-listing-completion.js --dry-run --app youdu
 *   heroku run node scripts/backfill-listing-completion.js --app youdu
 */

require('dotenv').config();

const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const { isCompletedOrBeyond } = require('../server/api-util/assignmentState');
const { markListingCompleted, listingIdFromTransaction } = require('../server/api-util/listingCompletion');

const DRY_RUN = process.argv.includes('--dry-run');
const PER_PAGE = 100;

const integrationSdk = sharetribeIntegrationSdk.createInstance({
  clientId: process.env.INTEGRATION_API_CLIENT_ID,
  clientSecret: process.env.INTEGRATION_API_CLIENT_SECRET,
});

const run = async () => {
  const listingIds = new Set();

  for (let page = 1; ; page += 1) {
    const response = await integrationSdk.transactions.query({
      page,
      perPage: PER_PAGE,
      include: ['listing'],
    });
    const { data, meta } = response.data;
    data
      .filter(tx => isCompletedOrBeyond(tx.attributes.lastTransition))
      .forEach(tx => listingIds.add(listingIdFromTransaction(tx)));
    if (page >= meta.totalPages) break;
  }
  listingIds.delete(null);

  console.log(`Tasks with a completed deal: ${listingIds.size}${DRY_RUN ? ' (dry run)' : ''}`);

  const tally = {};
  for (const id of listingIds) {
    let outcome;
    if (DRY_RUN) {
      const res = await integrationSdk.listings.show({ id }).catch(e => e);
      const pd = res?.data?.data?.attributes?.publicData;
      if (!pd) outcome = 'missing';
      else if (pd.status === 'completed') outcome = 'already';
      else outcome = `would mark (status: ${pd.status || '—'})`;
    } else {
      outcome = await markListingCompleted(integrationSdk, id).catch(e => `failed: ${e.message}`);
    }
    tally[outcome] = (tally[outcome] || 0) + 1;
    console.log(`${id}: ${outcome}`);
  }
  console.log(tally);
};

run().catch(error => {
  console.error(error?.data?.errors || error);
  process.exit(1);
});
