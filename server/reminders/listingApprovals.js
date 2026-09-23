/**
 * Tells specialists about a task the moment an operator approves it.
 *
 * Moderation is on for the marketplace, so a new task goes to pendingApproval
 * and the publish-time alert only reaches the admin. Approving in Console runs
 * none of our code; without this, specialists heard about an approved task
 * only from the next daily digest.
 *
 * The approval is read from Sharetribe's event log: a listing/updated event
 * whose listing is now published and was pendingApproval before. A stored
 * sequence id makes the reading resumable, and notifyExecutorsAboutListing is
 * idempotent, so a re-read event cannot send the alert twice.
 */

const db = require('../db');
const { notifyExecutorsAboutListing } = require('../api-util/notifyListingPublished');
const { createIntegrationSdk } = require('./context');

const CURSOR_NAME = 'listing-approvals';

// The admin approves and then expects the task to reach people; an hour-long
// sweep would feel broken. One query a minute is far below the API limit.
const POLL_INTERVAL_MS = 60 * 1000;

// Long enough for the dyno to finish booting and serve traffic first.
const STARTUP_DELAY_MS = 2 * 60 * 1000;

// A backlog after downtime is drained in one tick, but never unboundedly.
const MAX_PAGES_PER_TICK = 10;

const isApproval = event => {
  const { eventType, resource, previousValues } = event.attributes || {};
  return (
    eventType === 'listing/updated' &&
    resource?.attributes?.state === 'published' &&
    previousValues?.attributes?.state === 'pendingApproval'
  );
};

const listingIdOf = event => {
  const id = event.attributes?.resourceId;
  return id?.uuid || id || null;
};

/**
 * Reads one page of events after the cursor and alerts specialists about each
 * approval in it.
 *
 * @returns {Promise<{events: number, approvals: number, failed: number, fullPage: boolean}>}
 */
const processApprovalEvents = async ({ integrationSdk, db, notify, log = console.log }) => {
  const cursor = await db.getOrStartEventCursor(CURSOR_NAME);
  const position =
    cursor.sequenceId !== null
      ? { startAfterSequenceId: cursor.sequenceId }
      : { createdAtStart: new Date(cursor.updatedAt) };

  const response = await integrationSdk.events.query({
    ...position,
    eventTypes: 'listing/updated',
  });

  const events = response?.data?.data || [];
  const result = { events: events.length, approvals: 0, failed: 0, fullPage: false };

  for (const event of events) {
    if (!isApproval(event)) continue;
    result.approvals += 1;

    const listingId = listingIdOf(event);
    try {
      const outcome = await notify(listingId);
      log(`[approvals] ${listingId}: ${JSON.stringify(outcome)}`);
    } catch (error) {
      // One listing that cannot be announced must not hold up every later one;
      // the daily digest still reaches its specialists.
      result.failed += 1;
      log(`[approvals] ${listingId}: сбой рассылки — ${error.message}`);
    }
  }

  const last = events[events.length - 1];
  if (last) {
    await db.saveEventCursor(CURSOR_NAME, last.attributes.sequenceId);
  }

  const perPage = response?.data?.meta?.perPage;
  result.fullPage = events.length > 0 && events.length === perPage;
  return result;
};

let timers = [];
let running = false;

const startApprovalPoller = () => {
  if (process.env.LISTING_APPROVAL_POLLER === 'false') {
    console.log('[approvals] опрос одобрений выключен');
    return;
  }

  const integrationSdk = createIntegrationSdk();
  if (!integrationSdk) {
    console.log('[approvals] нет ключей Integration API, опрос не запущен');
    return;
  }

  const tick = async () => {
    // A slow tick must not stack up behind itself.
    if (running) return;
    running = true;

    try {
      for (let page = 0; page < MAX_PAGES_PER_TICK; page++) {
        const result = await processApprovalEvents({
          integrationSdk,
          db,
          notify: notifyExecutorsAboutListing,
        });
        if (result.approvals > 0) {
          console.log('[approvals] итог:', JSON.stringify(result));
        }
        if (!result.fullPage) break;
      }
    } catch (error) {
      // A broken poll must never take the web server down with it.
      console.error('[approvals] сбой опроса:', error.message);
    } finally {
      running = false;
    }
  };

  const startup = setTimeout(() => {
    tick();
    timers.push(setInterval(tick, POLL_INTERVAL_MS));
  }, STARTUP_DELAY_MS);

  timers.push(startup);
  console.log('[approvals] опрос одобрений запущен, раз в минуту');
};

const stopApprovalPoller = () => {
  timers.forEach(timer => {
    clearTimeout(timer);
    clearInterval(timer);
  });
  timers = [];
};

module.exports = {
  processApprovalEvents,
  isApproval,
  startApprovalPoller,
  stopApprovalPoller,
  CURSOR_NAME,
};
