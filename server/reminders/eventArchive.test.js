const {
  processArchiveEvents,
  toArchiveRow,
  toPlain,
  CURSOR_NAME,
  BACKFILL_DAYS,
} = require('./eventArchive');

const uuid = value => ({ _sdkType: 'UUID', uuid: value });
const userRef = id => ({ data: { id: uuid(id), type: 'user' } });

const transactionEvent = (sequenceId, { customer = 'specialist-1', provider = 'client-1' } = {}) => ({
  attributes: {
    eventType: 'transaction/initiated',
    sequenceId,
    createdAt: new Date('2026-09-01T10:00:00Z'),
    resourceType: 'transaction',
    resourceId: uuid(`tx-${sequenceId}`),
    source: 'source/marketplace-api',
    auditData: { userId: uuid(customer) },
    resource: {
      id: uuid(`tx-${sequenceId}`),
      type: 'transaction',
      attributes: {
        lastTransition: 'transition/inquire',
        protectedData: { offer: { price: 500, currency: 'AED' } },
      },
      relationships: { customer: userRef(customer), provider: userRef(provider) },
    },
    previousValues: {},
  },
});

const userDeletion = (sequenceId, userId) => ({
  attributes: {
    eventType: 'user/deleted',
    sequenceId,
    createdAt: new Date('2026-09-02T10:00:00Z'),
    resourceType: 'user',
    resourceId: uuid(userId),
    source: 'source/console',
    resource: null,
    previousValues: { attributes: { email: 'gone@example.com' } },
  },
});

const fakeDb = ({ cursor = { sequenceId: 10, updatedAt: new Date() } } = {}) => ({
  getOrStartEventCursor: jest.fn(async () => cursor),
  saveEventCursor: jest.fn(async () => {}),
  archiveMarketplaceEvents: jest.fn(async rows => rows.length),
});

const sdkReturning = (events, perPage = 100) => ({
  events: { query: jest.fn(async () => ({ data: { data: events, meta: { perPage } } })) },
});

describe('processArchiveEvents', () => {
  it('stores the page and moves the cursor to its last event', async () => {
    const db = fakeDb();
    const integrationSdk = sdkReturning([transactionEvent(11), transactionEvent(12)]);

    const result = await processArchiveEvents({ integrationSdk, db });

    expect(integrationSdk.events.query).toHaveBeenCalledWith({ startAfterSequenceId: 10 });
    expect(db.archiveMarketplaceEvents.mock.calls[0][0].map(r => r.sequenceId)).toEqual([11, 12]);
    expect(db.saveEventCursor).toHaveBeenCalledWith(CURSOR_NAME, 12);
    expect(result).toEqual({ events: 2, archived: 2, fullPage: false });
  });

  // A new archive has to collect what Sharetribe still keeps, not start today.
  it('starts inside the retention window on its first run', async () => {
    const db = fakeDb({ cursor: { sequenceId: null, updatedAt: new Date() } });
    const integrationSdk = sdkReturning([]);
    const now = new Date('2026-09-24T12:00:00Z');

    await processArchiveEvents({ integrationSdk, db, now: () => now });

    const { createdAtStart } = integrationSdk.events.query.mock.calls[0][0];
    const days = (now - createdAtStart) / (24 * 60 * 60 * 1000);
    expect(days).toBe(BACKFILL_DAYS);
  });

  it('leaves the cursor alone when the write fails, so the page is read again', async () => {
    const db = fakeDb();
    db.archiveMarketplaceEvents.mockRejectedValue(new Error('db down'));

    await expect(
      processArchiveEvents({ integrationSdk: sdkReturning([transactionEvent(11)]), db })
    ).rejects.toThrow('db down');
    expect(db.saveEventCursor).not.toHaveBeenCalled();
  });

  it('asks for another page when this one was full', async () => {
    const db = fakeDb();
    const result = await processArchiveEvents({
      integrationSdk: sdkReturning([transactionEvent(11), transactionEvent(12)], 2),
      db,
    });
    expect(result.fullPage).toBe(true);
  });

  it('does not touch the database when there is nothing new', async () => {
    const db = fakeDb();
    await processArchiveEvents({ integrationSdk: sdkReturning([]), db });
    expect(db.archiveMarketplaceEvents).not.toHaveBeenCalled();
    expect(db.saveEventCursor).not.toHaveBeenCalled();
  });
});

describe('toArchiveRow', () => {
  it('lists every user the event mentions', () => {
    const row = toArchiveRow(transactionEvent(11, { customer: 'spec', provider: 'client' }));
    expect(row.userIds.sort()).toEqual(['client', 'spec']);
    expect(row.resourceId).toBe('tx-11');
    expect(row.payload.resource.attributes.protectedData.offer.price).toBe(500);
  });

  // The deletion event's previous values are the very profile being erased.
  it('keeps only ids for a user deletion and marks the user for removal', () => {
    const row = toArchiveRow(userDeletion(20, 'gone-user'));
    expect(row.payload).toEqual({ eventType: 'user/deleted', resourceId: 'gone-user' });
    expect(row.deletedUserId).toBe('gone-user');
    expect(row.userIds).toEqual(['gone-user']);
  });
});

describe('toPlain', () => {
  it('turns SDK values into plain JSON', () => {
    expect(
      toPlain({
        id: uuid('abc'),
        price: { _sdkType: 'Money', amount: 50000, currency: 'AED' },
        geolocation: { _sdkType: 'LatLng', lat: 25.2, lng: 55.3 },
        at: new Date('2026-09-01T00:00:00Z'),
        list: [uuid('x')],
      })
    ).toEqual({
      id: 'abc',
      price: { amount: 50000, currency: 'AED' },
      geolocation: { lat: 25.2, lng: 55.3 },
      at: '2026-09-01T00:00:00.000Z',
      list: ['x'],
    });
  });
});
