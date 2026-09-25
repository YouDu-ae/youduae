/**
 * Marks a task completed whenever its deal reaches transition/complete.
 *
 * The app's endpoint writes the mark at once; the site and Console complete
 * deals without it. Reading transaction/transitioned events catches every
 * completion within a minute, and markListingCompleted is idempotent, so the
 * app's completions passing through here again change nothing.
 */

const { markListingCompleted, listingIdFromTransaction } = require('../api-util/listingCompletion');

const CURSOR_NAME = 'listing-completions';

const isCompletion = event => {
  const { eventType, resource } = event.attributes || {};
  return (
    eventType === 'transaction/transitioned' &&
    resource?.attributes?.lastTransition === 'transition/complete'
  );
};

/**
 * @returns {Promise<{events: number, completions: number, failed: number, fullPage: boolean}>}
 */
const processCompletionEvents = async ({ integrationSdk, db, log = console.log }) => {
  const cursor = await db.getOrStartEventCursor(CURSOR_NAME);
  const position =
    cursor.sequenceId !== null
      ? { startAfterSequenceId: cursor.sequenceId }
      : { createdAtStart: new Date(cursor.updatedAt) };

  const response = await integrationSdk.events.query({
    ...position,
    eventTypes: 'transaction/transitioned',
  });

  const events = response?.data?.data || [];
  const result = { events: events.length, completions: 0, failed: 0, fullPage: false };

  for (const event of events) {
    if (!isCompletion(event)) continue;
    result.completions += 1;

    const listingId = listingIdFromTransaction(event.attributes.resource);
    try {
      const outcome = await markListingCompleted(integrationSdk, listingId);
      log(`[completions] ${listingId}: ${outcome}`);
    } catch (error) {
      // One task that cannot be marked must not hold up the rest.
      result.failed += 1;
      log(`[completions] ${listingId}: сбой — ${error.message}`);
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

module.exports = { processCompletionEvents, isCompletion, CURSOR_NAME };
