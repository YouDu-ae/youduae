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

module.exports = {
  processApprovalEvents,
  isApproval,
  CURSOR_NAME,
};
