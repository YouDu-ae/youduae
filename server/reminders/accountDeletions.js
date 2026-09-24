/**
 * Finishes the job whenever a user disappears from Sharetribe.
 *
 * An operator deleting an account in Console runs none of our code. Reading
 * user/deleted from the event log lets YouDu clear its own tables for that
 * user and, if the person had asked for the deletion, send the confirmation
 * Apple expects. Self-service deletions come through here too; clearing the
 * tables twice is harmless and no letter goes out without an open request.
 */

const CURSOR_NAME = 'account-deletions';

const userIdOf = event => {
  const id = event.attributes?.resourceId;
  return id?.uuid || id || null;
};

/**
 * @returns {Promise<{events: number, confirmed: number, failed: number, fullPage: boolean}>}
 */
const processDeletionEvents = async ({ integrationSdk, db, sendEmail, log = console.log }) => {
  const cursor = await db.getOrStartEventCursor(CURSOR_NAME);
  const position =
    cursor.sequenceId !== null
      ? { startAfterSequenceId: cursor.sequenceId }
      : { createdAtStart: new Date(cursor.updatedAt) };

  const response = await integrationSdk.events.query({ ...position, eventTypes: 'user/deleted' });

  const events = response?.data?.data || [];
  const result = { events: events.length, confirmed: 0, failed: 0, fullPage: false };

  for (const event of events) {
    const userId = userIdOf(event);
    if (!userId) continue;

    try {
      await db.deleteUserLocalData(userId);
      const request = await db.completeDeletionRequest(userId);
      if (request?.email) {
        await sendEmail('deleted', request.email);
        result.confirmed += 1;
      }
      log(`[deletions] ${userId}: локальные данные удалены${request ? ', заявка закрыта' : ''}`);
    } catch (error) {
      // One user that cannot be cleared must not hold up the rest.
      result.failed += 1;
      log(`[deletions] ${userId}: сбой — ${error.message}`);
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

module.exports = { processDeletionEvents, CURSOR_NAME };
