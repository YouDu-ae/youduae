/**
 * Entry point for the reminder sweep, run by Heroku Scheduler.
 *
 * Schedule it hourly: every job decides for itself whether it is due, and
 * reminder_log makes a repeat run a no-op, so the frequency only affects how
 * soon a reminder goes out, never how many are sent.
 *
 * Usage:
 *   heroku run node scripts/send-reminders.js --app youdu
 *   heroku run node scripts/send-reminders.js --dry-run --app youdu
 *
 * Flags:
 *   --dry-run  print what would be sent, touch nothing
 *   --force    ignore quiet hours and REMINDERS_ENABLED
 */

require('dotenv').config();

const db = require('../server/db');
const { runReminders } = require('../server/reminders');

const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');

const run = async () => {
  console.log(`Напоминания: старт${dryRun ? ' (DRY RUN)' : ''}${force ? ' (FORCE)' : ''}`);

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL не задан — журнал отправок недоступен');
  }

  // Scheduler dynos start with an empty database on a fresh app, and the web
  // dyno is the only thing that normally creates tables.
  await db.initDatabase();

  const results = await runReminders({ dryRun, force });
  console.log('\nИтог:', JSON.stringify(results, null, 2));

  if (!dryRun) {
    const stats = await db.getReminderStats();
    stats.forEach(row => {
      console.log(
        `  ${row.reminder_type}: всего ${row.total}, за неделю ${row.last_week}, последнее ${row.last_sent}`
      );
    });
  }
};

run()
  .then(() => db.pool.end())
  .then(() => process.exit(0))
  .catch(async error => {
    console.error('Напоминания упали:', error.message);
    console.error(error.stack);
    await db.pool.end().catch(() => {});
    process.exit(1);
  });
