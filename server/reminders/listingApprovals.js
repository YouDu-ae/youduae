/**
 * Tells specialists about a task the moment an operator approves it, and the
 * moderator about a task published from the app.
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
 *
 * The same log carries a draft being published. The site asks for that alert
 * itself (POST /api/notify-new-listing), but the app publishes straight to
 * Sharetribe, so without this the moderator never heard of a task from the app.
 *
 * The polling itself lives in eventPoller.
 */

const CURSOR_NAME = 'listing-approvals';

const isApproval = event => {
  const { eventType, resource, previousValues } = event.attributes || {};
  return (
    eventType === 'listing/updated' &&
    resource?.attributes?.state === 'published' &&
    previousValues?.attributes?.state === 'pendingApproval'
  );
};

// Published by its author, from the site or the app. A task from the site is
// announced already; the flags notifyExecutorsAboutListing writes keep it at one.
const isPublication = event => {
  const { eventType, resource, previousValues } = event.attributes || {};
  const state = resource?.attributes?.state;
  return (
    eventType === 'listing/updated' &&
    previousValues?.attributes?.state === 'draft' &&
    (state === 'pendingApproval' || state === 'published')
  );
};

// Cancelled by its author while waiting for moderation, then approved anyway.
const isCancelledListing = event => {
  const publicData = event.attributes?.resource?.attributes?.publicData || {};
  return publicData.cancelled === true || publicData.status === 'cancelled';
};

const listingIdOf = event => {
  const id = event.attributes?.resourceId;
  return id?.uuid || id || null;
};

/**
 * Reads one page of events after the cursor and alerts specialists about each
 * approval in it, and the moderator or specialists about each publication.
 *
 * @returns {Promise<{events: number, approvals: number, publications: number, failed: number, fullPage: boolean}>}
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
  const result = {
    events: events.length,
    approvals: 0,
    publications: 0,
    failed: 0,
    fullPage: false,
  };

  for (const event of events) {
    if (isPublication(event)) {
      result.publications += 1;
      const listingId = listingIdOf(event);
      try {
        const outcome = await notify(listingId);
        log(`[approvals] ${listingId}: опубликовано автором — ${JSON.stringify(outcome)}`);
      } catch (error) {
        result.failed += 1;
        log(`[approvals] ${listingId}: сбой уведомления о новом задании — ${error.message}`);
      }
      continue;
    }

    if (!isApproval(event)) continue;
    result.approvals += 1;

    const listingId = listingIdOf(event);
    try {
      if (isCancelledListing(event)) {
        await integrationSdk.listings.close({ id: listingId });
        log(`[approvals] ${listingId}: отменено автором — закрыто без рассылки`);
        continue;
      }
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

module.exports = {
  processApprovalEvents,
  isApproval,
  isPublication,
  CURSOR_NAME,
};
