/**
 * One-off backfill of the telegram_subscribers table.
 *
 * Accounts linked before the table existed only have telegramChatId in their
 * Sharetribe profile. This walks every page of users (the old broadcast code
 * read just the first 100) and mirrors the linked ones into the database.
 *
 * Usage:
 *   heroku run node scripts/backfill-telegram-subscribers.js --app youdu
 */

require('dotenv').config();

const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const db = require('../server/db');

const PER_PAGE = 100;

const integrationSdk = sharetribeIntegrationSdk.createInstance({
  clientId: process.env.INTEGRATION_API_CLIENT_ID,
  clientSecret: process.env.INTEGRATION_API_CLIENT_SECRET,
});

const run = async () => {
  console.log('Backfilling Telegram subscribers...\n');

  let page = 1;
  let totalPages = 1;
  let scanned = 0;
  let linked = 0;
  const failures = [];

  while (page <= totalPages) {
    const response = await integrationSdk.users.query({ page, perPage: PER_PAGE });
    const users = response.data.data;
    totalPages = response.data.meta.totalPages || 1;
    scanned += users.length;

    for (const user of users) {
      const profile = user.attributes.profile;
      const privateData = profile.privateData || {};
      const publicData = profile.publicData || {};

      if (!privateData.telegramChatId) {
        continue;
      }

      try {
        await db.upsertTelegramSubscriber({
          userId: user.id.uuid,
          chatId: privateData.telegramChatId,
          telegramUsername: privateData.telegramUsername || null,
          displayName: profile.displayName || null,
          userType: publicData.userType || null,
          categories: Array.isArray(publicData.serviceCategories)
            ? publicData.serviceCategories
            : [],
        });
        linked++;
        const categoryCount = (publicData.serviceCategories || []).length;
        console.log(
          `  saved ${profile.displayName || user.id.uuid} (${publicData.userType || 'unknown'}, ${categoryCount} categories)`
        );
      } catch (error) {
        failures.push({ userId: user.id.uuid, message: error.message });
        console.error(`  failed ${user.id.uuid}: ${error.message}`);
      }
    }

    page++;
  }

  const stats = await db.getTelegramSubscriberStats();

  console.log(`\nScanned ${scanned} users, saved ${linked} subscribers.`);
  if (failures.length > 0) {
    console.log(`Failures: ${failures.length}`);
  }
  console.log('Table now holds:', stats);

  await db.pool.end();
};

run().catch(error => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
