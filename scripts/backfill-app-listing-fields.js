/**
 * Brings tasks created by older iOS app builds in line with the website.
 *
 * Those builds wrote publicData.category instead of categoryLevel1, a calendar
 * date as the deadline, and unitType 'item'. The site's category filters read
 * categoryLevel1, its deadline field is one of four choices, and its edit form
 * refuses a task whose unitType differs from the configuration ('inquiry').
 *
 * The deadline choice is computed from the day the task was created, the
 * exact date is kept in deadlineDate, and the old category key is left in place
 * so nothing that still reads it breaks.
 *
 * Usage:
 *   heroku run node scripts/backfill-app-listing-fields.js --dry-run --app youdu
 *   heroku run node scripts/backfill-app-listing-fields.js --app youdu
 */

require('dotenv').config();

const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');

const DRY_RUN = process.argv.includes('--dry-run');
const PER_PAGE = 100;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
const DEADLINE_CHOICES = ['today', 'tomorrow', 'week', 'long-term'];
const APP_PROCESS = 'assignment-flow-v3';

const integrationSdk = sharetribeIntegrationSdk.createInstance({
  clientId: process.env.INTEGRATION_API_CLIENT_ID,
  clientSecret: process.env.INTEGRATION_API_CLIENT_SECRET,
});

const startOfDay = date => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const deadlineChoice = (isoDate, createdAt) => {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const days = Math.round((Date.UTC(y, m - 1, d) - startOfDay(createdAt)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 7) return 'week';
  return 'long-term';
};

/** The publicData changes a listing needs, or null when it is already aligned. */
const fixesFor = listing => {
  const pd = listing.attributes.publicData || {};
  const alias = pd.transactionProcessAlias || '';
  if (!alias.startsWith(APP_PROCESS)) return null;

  const changes = {};
  if (!pd.categoryLevel1 && pd.category) {
    changes.categoryLevel1 = pd.category;
  }
  if (pd.unitType && pd.unitType !== 'inquiry') {
    changes.unitType = 'inquiry';
  }
  if (typeof pd.deadline === 'string' && ISO_DATE.test(pd.deadline)) {
    changes.deadline = deadlineChoice(pd.deadline, listing.attributes.createdAt);
    changes.deadlineDate = pd.deadline.slice(0, 10);
  } else if (pd.deadline && !DEADLINE_CHOICES.includes(pd.deadline)) {
    changes.deadline = 'week';
  }
  return Object.keys(changes).length > 0 ? changes : null;
};

const run = async () => {
  let page = 1;
  let totalPages = 1;
  let scanned = 0;
  let fixed = 0;
  const failures = [];

  while (page <= totalPages) {
    const response = await integrationSdk.listings.query({ page, perPage: PER_PAGE });
    totalPages = response.data.meta.totalPages || 1;

    for (const listing of response.data.data) {
      scanned += 1;
      const changes = fixesFor(listing);
      if (!changes) continue;

      const pd = listing.attributes.publicData || {};
      console.log(
        `${DRY_RUN ? 'would fix' : 'fixing'} ${pd.publicId || listing.id.uuid} ` +
          `«${listing.attributes.title}»: ${JSON.stringify(changes)}`
      );
      if (DRY_RUN) {
        fixed += 1;
        continue;
      }
      try {
        await integrationSdk.listings.update({ id: listing.id, publicData: changes });
        fixed += 1;
      } catch (error) {
        failures.push({ id: listing.id.uuid, error: error.status || error.message });
      }
    }
    page += 1;
  }

  console.log(`\nscanned ${scanned}, ${DRY_RUN ? 'to fix' : 'fixed'} ${fixed}`);
  if (failures.length > 0) {
    console.log('failures:', JSON.stringify(failures));
    process.exitCode = 1;
  }
};

run().catch(error => {
  console.error('backfill failed:', error.status || '', error.data || error.message);
  process.exitCode = 1;
});
