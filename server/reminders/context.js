/**
 * Shared plumbing for the scheduled reminders.
 */
const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const { CATEGORY_LABELS, formatPrice, rootUrl } = require('../api-util/notifyListingPublished');

const MARKETPLACE_TIMEZONE = 'Asia/Dubai';

const numberFromEnv = (name, fallback) => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Thresholds live in the environment so the timing can be tuned on Heroku
 * without a deploy — the right value is a guess until real reply times exist.
 */
const config = {
  enabled: process.env.REMINDERS_ENABLED !== 'false',
  unansweredAfterHours: numberFromEnv('REMINDER_UNANSWERED_HOURS', 24),
  unansweredMaxAgeDays: numberFromEnv('REMINDER_UNANSWERED_MAX_DAYS', 7),
  digestMinAgeHours: numberFromEnv('REMINDER_DIGEST_MIN_HOURS', 24),
  digestMaxAgeDays: numberFromEnv('REMINDER_DIGEST_MAX_DAYS', 14),
  digestMaxTasks: numberFromEnv('REMINDER_DIGEST_MAX_TASKS', 5),
  // Inclusive start, exclusive end, in marketplace local time.
  sendFromHour: numberFromEnv('REMINDER_SEND_FROM_HOUR', 9),
  sendUntilHour: numberFromEnv('REMINDER_SEND_UNTIL_HOUR', 21),
};

const createIntegrationSdk = () => {
  const clientId = process.env.INTEGRATION_API_CLIENT_ID;
  const clientSecret = process.env.INTEGRATION_API_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return sharetribeIntegrationSdk.createInstance({ clientId, clientSecret });
};

/**
 * Local hour in the marketplace's timezone. Heroku runs in UTC, and a reminder
 * that arrives at 3am reads as spam no matter how useful it is.
 */
const marketplaceHour = (now = new Date()) => {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: MARKETPLACE_TIMEZONE,
    hour: 'numeric',
    hour12: false,
  }).format(now);
  return Number(hour) % 24;
};

const isQuietHour = (now = new Date()) => {
  const hour = marketplaceHour(now);
  return hour < config.sendFromHour || hour >= config.sendUntilHour;
};

/** Date key in marketplace time, used to make daily digests idempotent. */
const marketplaceDateKey = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: MARKETPLACE_TIMEZONE }).format(now);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Telegram tolerates roughly 30 messages/second; this stays well under. */
const TELEGRAM_SEND_DELAY_MS = 50;

const listingUrl = listingId => `${rootUrl()}/l/${listingId}`;

module.exports = {
  CATEGORY_LABELS,
  TELEGRAM_SEND_DELAY_MS,
  config,
  createIntegrationSdk,
  formatPrice,
  isQuietHour,
  listingUrl,
  marketplaceDateKey,
  marketplaceHour,
  rootUrl,
  sleep,
};
