/**
 * Keeps every Sharetribe event in YouDu's own database.
 *
 * Sharetribe holds the event log for 90 days only, and an entity's current
 * state loses its earlier values on every update. The archive is the one place
 * where the full history of tasks, offers, deals, messages and reviews
 * survives — the raw material for analytics and for agents later on.
 *
 * Rows are append-only and keyed by sequence id, so re-reading a page after a
 * crash inserts nothing twice. A first run starts just inside the retention
 * window to collect everything Sharetribe still has.
 */

const CURSOR_NAME = 'event-archive';

// One day short of Sharetribe's 90, so the first query never asks for an
// already expired range.
const BACKFILL_DAYS = 89;
const DAY_MS = 24 * 60 * 60 * 1000;

/** SDK values (UUID, Money, LatLng, Date) as plain JSON. */
const toPlain = value => {
  if (value == null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toPlain);
  if (value._sdkType === 'UUID') return value.uuid;
  if (value._sdkType === 'Money') return { amount: value.amount, currency: value.currency };
  if (value._sdkType === 'LatLng') return { lat: value.lat, lng: value.lng };
  const plain = {};
  Object.keys(value).forEach(key => {
    if (key !== '_sdkType') plain[key] = toPlain(value[key]);
  });
  return plain;
};

/** Ids of every user referenced anywhere inside plain (toPlain) API data. */
const collectUserIds = (node, ids = new Set()) => {
  if (node == null || typeof node !== 'object') return ids;
  if (Array.isArray(node)) {
    node.forEach(item => collectUserIds(item, ids));
    return ids;
  }
  if (node.type === 'user' && typeof node.id === 'string') ids.add(node.id);
  Object.values(node).forEach(value => collectUserIds(value, ids));
  return ids;
};

/** Every user an event mentions, so deleting a user can find their rows. */
const userIdsOf = attributes => {
  const ids = new Set();
  if (attributes.resourceType === 'user' && attributes.resourceId) ids.add(attributes.resourceId);
  if (attributes.auditData?.userId) ids.add(attributes.auditData.userId);
  collectUserIds(attributes.resource, ids);
  collectUserIds(attributes.previousValues, ids);
  return [...ids];
};

const toArchiveRow = event => {
  const attributes = toPlain(event.attributes);
  const isUserDeletion = attributes.eventType === 'user/deleted';
  return {
    sequenceId: attributes.sequenceId,
    eventType: attributes.eventType,
    resourceType: attributes.resourceType,
    resourceId: attributes.resourceId,
    source: attributes.source,
    createdAt: attributes.createdAt,
    userIds: userIdsOf(attributes),
    // A deletion's previousValues still hold the profile being erased.
    payload: isUserDeletion
      ? { eventType: attributes.eventType, resourceId: attributes.resourceId }
      : attributes,
    deletedUserId: isUserDeletion ? attributes.resourceId : null,
  };
};

/**
 * @returns {Promise<{events: number, archived: number, fullPage: boolean}>}
 */
const processArchiveEvents = async ({ integrationSdk, db, now = () => new Date() }) => {
  const cursor = await db.getOrStartEventCursor(CURSOR_NAME);
  const position =
    cursor.sequenceId !== null
      ? { startAfterSequenceId: cursor.sequenceId }
      : { createdAtStart: new Date(now().getTime() - BACKFILL_DAYS * DAY_MS) };

  const response = await integrationSdk.events.query(position);
  const events = response?.data?.data || [];
  const rows = events.map(toArchiveRow);

  const archived = rows.length > 0 ? await db.archiveMarketplaceEvents(rows) : 0;

  const last = rows[rows.length - 1];
  if (last) {
    await db.saveEventCursor(CURSOR_NAME, last.sequenceId);
  }

  const perPage = response?.data?.meta?.perPage;
  return {
    events: events.length,
    archived,
    fullPage: events.length > 0 && events.length === perPage,
  };
};

module.exports = {
  processArchiveEvents,
  toArchiveRow,
  toPlain,
  collectUserIds,
  CURSOR_NAME,
  BACKFILL_DAYS,
};
