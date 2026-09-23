// The poller's own collaborators are passed in; these mocks only stop the
// module from loading the database pool and the Telegram bot.
jest.mock('../db', () => ({}));
jest.mock('../api-util/notifyListingPublished', () => ({ notifyExecutorsAboutListing: jest.fn() }));
jest.mock('./context', () => ({ createIntegrationSdk: () => null }));

const { processApprovalEvents, isApproval, CURSOR_NAME } = require('./listingApprovals');

let nextSequence = 100;

const listingEvent = ({ listingId, state, previousState, eventType = 'listing/updated' }) => ({
  attributes: {
    eventType,
    sequenceId: nextSequence++,
    resourceId: { uuid: listingId },
    resource: { attributes: { state } },
    previousValues: previousState ? { attributes: { state: previousState } } : {},
  },
});

const approval = listingId =>
  listingEvent({ listingId, state: 'published', previousState: 'pendingApproval' });

const fakeDb = cursor => ({
  getOrStartEventCursor: jest.fn(async () => cursor),
  saveEventCursor: jest.fn(async () => {}),
});

const fakeSdk = (events, perPage = 100) => ({
  events: { query: jest.fn(async () => ({ data: { data: events, meta: { perPage } } })) },
});

const run = ({ events = [], cursor = { sequenceId: 50, updatedAt: new Date() }, notify, perPage }) => {
  const integrationSdk = fakeSdk(events, perPage);
  const db = fakeDb(cursor);
  const notifyFn = notify || jest.fn(async () => ({ sent: 1 }));
  const promise = processApprovalEvents({ integrationSdk, db, notify: notifyFn, log: () => {} });
  return { promise, integrationSdk, db, notify: notifyFn };
};

describe('isApproval', () => {
  it('recognises an operator approving a task', () => {
    expect(isApproval(approval('listing-1'))).toBe(true);
  });

  // Edits to a live task and first publication without moderation are not
  // approvals; the publish path already announced the latter.
  it('ignores every other listing update', () => {
    expect(isApproval(listingEvent({ listingId: 'l', state: 'published', previousState: 'draft' })))
      .toBe(false);
    expect(isApproval(listingEvent({ listingId: 'l', state: 'published' }))).toBe(false);
    expect(
      isApproval(listingEvent({ listingId: 'l', state: 'closed', previousState: 'pendingApproval' }))
    ).toBe(false);
    expect(
      isApproval(
        listingEvent({
          listingId: 'l',
          state: 'published',
          previousState: 'pendingApproval',
          eventType: 'listing/created',
        })
      )
    ).toBe(false);
  });
});

describe('processApprovalEvents', () => {
  it('announces each approved task and nothing else', async () => {
    const { promise, notify } = run({
      events: [
        approval('listing-1'),
        listingEvent({ listingId: 'listing-2', state: 'published' }),
        approval('listing-3'),
      ],
    });

    const result = await promise;

    expect(result).toMatchObject({ events: 3, approvals: 2, failed: 0 });
    expect(notify.mock.calls).toEqual([['listing-1'], ['listing-3']]);
  });

  it('resumes after the last event it stored', async () => {
    const { promise, integrationSdk } = run({ cursor: { sequenceId: 50, updatedAt: new Date() } });
    await promise;

    expect(integrationSdk.events.query).toHaveBeenCalledWith({
      startAfterSequenceId: 50,
      eventTypes: 'listing/updated',
    });
  });

  // Switching the poller on must not announce every task approved in the past.
  it('starts from the moment it was switched on, not from history', async () => {
    const startedAt = new Date('2026-09-23T11:00:00Z');
    const { promise, integrationSdk } = run({ cursor: { sequenceId: null, updatedAt: startedAt } });
    await promise;

    expect(integrationSdk.events.query).toHaveBeenCalledWith({
      createdAtStart: startedAt,
      eventTypes: 'listing/updated',
    });
  });

  it('moves the cursor to the last event read', async () => {
    const events = [approval('listing-1'), listingEvent({ listingId: 'listing-2', state: 'published' })];
    const { promise, db } = run({ events });
    await promise;

    expect(db.saveEventCursor).toHaveBeenCalledWith(
      CURSOR_NAME,
      events[1].attributes.sequenceId
    );
  });

  it('leaves the cursor alone when nothing happened', async () => {
    const { promise, db } = run({ events: [] });
    await promise;
    expect(db.saveEventCursor).not.toHaveBeenCalled();
  });

  it('keeps going when one announcement fails', async () => {
    const notify = jest.fn(async listingId => {
      if (listingId === 'listing-1') throw new Error('Telegram down');
      return { sent: 1 };
    });
    const events = [approval('listing-1'), approval('listing-2')];

    const { promise, db } = run({ events, notify });
    const result = await promise;

    expect(result).toMatchObject({ approvals: 2, failed: 1 });
    expect(notify).toHaveBeenCalledWith('listing-2');
    expect(db.saveEventCursor).toHaveBeenCalledWith(CURSOR_NAME, events[1].attributes.sequenceId);
  });

  it('says when a full page means more events are waiting', async () => {
    const events = [approval('listing-1'), approval('listing-2')];
    expect((await run({ events, perPage: 2 }).promise).fullPage).toBe(true);
    expect((await run({ events, perPage: 100 }).promise).fullPage).toBe(false);
  });
});
