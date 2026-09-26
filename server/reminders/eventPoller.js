/**
 * Reads Sharetribe's event log once a minute. Consumers react to what happens
 * outside our code — task approvals and account deletions in Console, deals
 * completed on the site, chat messages from anywhere — and the archive keeps
 * every event past Sharetribe's 90-day retention. Each consumer keeps its own place in event_cursors, so one of
 * them failing or lagging does not hold up the others.
 */

const db = require('../db');
const { notifyExecutorsAboutListing } = require('../api-util/notifyListingPublished');
const { sendAccountEmail } = require('../api-util/accountEmails');
const { createIntegrationSdk } = require('./context');
const { processApprovalEvents } = require('./listingApprovals');
const { processDeletionEvents } = require('./accountDeletions');
const { processArchiveEvents } = require('./eventArchive');
const { processCompletionEvents } = require('./listingCompletions');
const { processMessageEvents } = require('./messageNotifications');

// An operator acts in Console and expects the effect to follow; an hour-long
// sweep would feel broken. Two queries a minute are far below the API limit.
const POLL_INTERVAL_MS = 60 * 1000;

// Long enough for the dyno to finish booting and serve traffic first.
const STARTUP_DELAY_MS = 2 * 60 * 1000;

// A backlog after downtime is drained in one tick, but never unboundedly.
const MAX_PAGES_PER_TICK = 10;

const buildConsumers = integrationSdk =>
  [
    {
      name: 'approvals',
      enabled: process.env.LISTING_APPROVAL_POLLER !== 'false',
      run: () =>
        processApprovalEvents({ integrationSdk, db, notify: notifyExecutorsAboutListing }),
      isWorthLogging: result => result.approvals > 0,
    },
    {
      name: 'deletions',
      enabled: process.env.ACCOUNT_DELETION_POLLER !== 'false',
      run: () => processDeletionEvents({ integrationSdk, db, sendEmail: sendAccountEmail }),
      isWorthLogging: result => result.events > 0,
    },
    {
      name: 'completions',
      enabled: process.env.LISTING_COMPLETION_POLLER !== 'false',
      run: () => processCompletionEvents({ integrationSdk, db }),
      isWorthLogging: result => result.completions > 0,
    },
    {
      name: 'messages',
      enabled: process.env.MESSAGE_NOTIFICATION_POLLER !== 'false',
      run: () => processMessageEvents({ integrationSdk, db }),
      isWorthLogging: result => result.notified > 0 || result.failed > 0,
    },
    {
      name: 'archive',
      enabled: process.env.EVENT_ARCHIVE_POLLER !== 'false',
      run: () => processArchiveEvents({ integrationSdk, db }),
      isWorthLogging: result => result.archived > 0,
    },
  ].filter(consumer => consumer.enabled);

let timers = [];
let running = false;

const startEventPoller = () => {
  const integrationSdk = createIntegrationSdk();
  if (!integrationSdk) {
    console.log('[events] нет ключей Integration API, опрос событий не запущен');
    return;
  }

  const consumers = buildConsumers(integrationSdk);
  if (consumers.length === 0) {
    console.log('[events] все потребители событий выключены');
    return;
  }

  const drain = async consumer => {
    try {
      for (let page = 0; page < MAX_PAGES_PER_TICK; page++) {
        const result = await consumer.run();
        if (consumer.isWorthLogging(result)) {
          console.log(`[${consumer.name}] итог:`, JSON.stringify(result));
        }
        if (!result.fullPage) break;
      }
    } catch (error) {
      // A broken consumer must never take the web server down with it.
      console.error(`[${consumer.name}] сбой опроса:`, error.message);
    }
  };

  const tick = async () => {
    // A slow tick must not stack up behind itself.
    if (running) return;
    running = true;
    try {
      for (const consumer of consumers) {
        await drain(consumer);
      }
    } finally {
      running = false;
    }
  };

  const startup = setTimeout(() => {
    tick();
    timers.push(setInterval(tick, POLL_INTERVAL_MS));
  }, STARTUP_DELAY_MS);

  timers.push(startup);
  console.log(
    `[events] опрос событий запущен, раз в минуту: ${consumers.map(c => c.name).join(', ')}`
  );
};

const stopEventPoller = () => {
  timers.forEach(timer => {
    clearTimeout(timer);
    clearInterval(timer);
  });
  timers = [];
};

module.exports = { startEventPoller, stopEventPoller };
