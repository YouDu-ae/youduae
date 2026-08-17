/**
 * Writes publicData.communityId onto listings that predate the field.
 *
 * District statistics do NOT depend on this: /api/area-stats derives the
 * community from each listing's geolocation every time it aggregates. The
 * stored id exists so listings can be filtered by district in search later
 * (`pub_communityId`), which needs the value to actually be on the resource.
 *
 * Runs read-only by default. Pass --apply to write.
 *
 * Usage:
 *   node scripts/backfill-community-ids.js
 *   node scripts/backfill-community-ids.js --apply
 *   heroku run node scripts/backfill-community-ids.js --apply --app youdu
 */

require('dotenv').config();

const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const { resolveCommunityForListing } = require('../server/api-util/communities');

const PER_PAGE = 100;
const APPLY = process.argv.includes('--apply');

const integrationSdk = sharetribeIntegrationSdk.createInstance({
  clientId: process.env.INTEGRATION_API_CLIENT_ID,
  clientSecret: process.env.INTEGRATION_API_CLIENT_SECRET,
});

const run = async () => {
  console.log(APPLY ? 'Backfilling communityId...\n' : 'Dry run — nothing will be written.\n');

  let page = 1;
  let totalPages = 1;
  let scanned = 0;
  let written = 0;
  let alreadySet = 0;
  let noGeolocation = 0;
  let outsideDubai = 0;
  const failures = [];
  const perCommunity = {};

  while (page <= totalPages) {
    const response = await integrationSdk.listings.query({ page, perPage: PER_PAGE });
    const listings = response.data.data;
    totalPages = response.data.meta.totalPages || 1;
    scanned += listings.length;

    for (const listing of listings) {
      const publicData = listing.attributes.publicData || {};

      if (!listing.attributes.geolocation) {
        noGeolocation += 1;
        continue;
      }

      const community = resolveCommunityForListing(listing);

      if (!community) {
        outsideDubai += 1;
        continue;
      }

      perCommunity[community.id] = (perCommunity[community.id] || 0) + 1;

      if (publicData.communityId === community.id) {
        alreadySet += 1;
        continue;
      }

      if (!APPLY) {
        written += 1;
        continue;
      }

      try {
        // Only communityId is sent: the Integration API merges publicData keys,
        // so unrelated fields on the listing are left untouched.
        await integrationSdk.listings.update({
          id: listing.id,
          publicData: { communityId: community.id },
        });
        written += 1;
      } catch (err) {
        failures.push({ id: listing.id.uuid, message: err.message });
      }
    }

    page += 1;
  }

  console.log(`Scanned:          ${scanned}`);
  console.log(`${APPLY ? 'Updated' : 'Would update'}:  ${written}`);
  console.log(`Already correct:  ${alreadySet}`);
  console.log(`No geolocation:   ${noGeolocation}`);
  console.log(`Outside Dubai:    ${outsideDubai}`);

  const ranked = Object.entries(perCommunity).sort((a, b) => b[1] - a[1]);
  if (ranked.length > 0) {
    console.log('\nListings per community:');
    ranked.forEach(([id, count]) => console.log(`  ${count.toString().padStart(4)}  ${id}`));
  }

  if (failures.length > 0) {
    console.log(`\nFailed (${failures.length}):`);
    failures.forEach(f => console.log(`  ${f.id}: ${f.message}`));
  }
};

run().catch(err => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
