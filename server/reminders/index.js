/**
 * Scheduled reminders, run from Heroku Scheduler via scripts/send-reminders.js.
 *
 * Deliberately not a queue: the work is a periodic sweep measured in seconds,
 * so Redis plus a worker dyno would cost more than it solves. Every job is
 * idempotent through reminder_log, which means running this more often than
 * needed is harmless.
 */
const { config, isQuietHour, marketplaceHour } = require('./context');
const { runUnansweredOffers } = require('./unansweredOffers');
const { runSpecialistDigest } = require('./specialistDigest');

const JOBS = [
  { name: 'unanswered_offers', run: runUnansweredOffers },
  { name: 'specialist_digest', run: runSpecialistDigest },
];

const runReminders = async ({ dryRun = false, force = false, log = console.log } = {}) => {
  if (!config.enabled && !force) {
    log('Напоминания выключены (REMINDERS_ENABLED=false)');
    return { skipped: 'disabled' };
  }

  // A useful reminder at 4am is still an unwelcome one. Nothing is lost by
  // waiting: the sweep runs hourly and the same tasks will still be there.
  if (isQuietHour() && !force && !dryRun) {
    log(`Тихие часы (${marketplaceHour()}:00 по Дубаю), пропускаем`);
    return { skipped: 'quiet-hours' };
  }

  const results = {};

  for (const job of JOBS) {
    const startedAt = Date.now();
    try {
      results[job.name] = await job.run({ dryRun, log });
    } catch (error) {
      // One broken job must not stop the others.
      log(`[${job.name}] упал: ${error.message}`);
      results[job.name] = { error: error.message };
    }
    log(`[${job.name}] завершено за ${Date.now() - startedAt} мс`);
  }

  return results;
};

module.exports = { runReminders };
