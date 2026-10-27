// The poller's own collaborators are passed in; these mocks only stop the
// module from loading the database pool and the Telegram bot.
jest.mock('../db', () => ({}));
jest.mock('../api-util/notifyListingPublished', () => ({ notifyExecutorsAboutListing: jest.fn() }));
jest.mock('./context', () => ({ createIntegrationSdk: () => null }));

const {
  processApprovalEvents,
  isApproval,
  isPublication,
  CURSOR_NAME,
} = require('./listingApprovals');

let nextSequence = 100;

const listingEvent = ({
  listingId,
  state,
  previousState,
  eventType = 'listing/updated',
  publicData = {},
}) => ({
  attributes: {
    eventType,
    sequenceId: nextSequence++,
    resourceId: { uuid: listingId },
    resource: { attributes: { state, publicData } },
    previousValues: previousState ? { attributes: { state: previousState } } : {},
  },
});

const approval = listingId =>
  listingEvent({ listingId, state: 'published', previousState: 'pendingApproval' });

const publication = (listingId, state = 'pendingApproval') =>
  listingEvent({ listingId, state, previousState: 'draft' });

const fakeDb = cursor => ({
  getOrStartEventCursor: jest.fn(async () => cursor),
  saveEventCursor: jest.fn(async () => {}),
});

const fakeSdk = (events, perPage = 100) => ({
  events: { query: jest.fn(async () => ({ data: { data: events, meta: { perPage } } })) },
  listings: { close: jest.fn(async () => ({})) },
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
  // approvals; isPublication covers the latter.
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

describe('isPublication', () => {
  it('recognises an author publishing a draft, with or without moderation', () => {
    expect(isPublication(publication('l'))).toBe(true);
    expect(isPublication(publication('l', 'published'))).toBe(true);
  });

  // Images are added while the task is still a draft; approval and edits come
  // after publication.
  it('ignores every other listing update', () => {
    expect(isPublication(listingEvent({ listingId: 'l', state: 'draft' }))).toBe(false);
    expect(isPublication(approval('l'))).toBe(false);
    expect(isPublication(listingEvent({ listingId: 'l', state: 'published' }))).toBe(false);
    expect(
      isPublication(
        listingEvent({
          listingId: 'l',
          state: 'pendingApproval',
          previousState: 'draft',
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

  // The app publishes straight to Sharetribe and never asks the server for the
  // alert, so the moderator hears about its task from here.
  it('announces a task its author published, alongside approvals', async () => {
    const { promise, notify } = run({
      events: [
        listingEvent({ listingId: 'listing-1', state: 'draft' }),
        publication('listing-1'),
        approval('listing-2'),
      ],
    });

    const result = await promise;

    expect(result).toMatchObject({ events: 3, approvals: 1, publications: 1, failed: 0 });
    expect(notify.mock.calls).toEqual([['listing-1'], ['listing-2']]);
  });

  it('keeps going when one publication cannot be announced', async () => {
    const notify = jest.fn(async listingId => {
      if (listingId === 'listing-1') throw new Error('Telegram down');
      return { adminNotified: true };
    });

    const { promise } = run({
      events: [publication('listing-1'), publication('listing-2')],
      notify,
    });

    expect(await promise).toMatchObject({ publications: 2, failed: 1 });
    expect(notify).toHaveBeenCalledWith('listing-2');
  });

  // The author cancelled it while it waited; approving it must not revive it.
  it('closes a task approved after its author cancelled it, without announcing', async () => {
    const cancelled = listingEvent({
      listingId: 'listing-9',
      state: 'published',
      previousState: 'pendingApproval',
      publicData: { status: 'cancelled', cancelled: true },
    });
    const { promise, notify, integrationSdk } = run({ events: [cancelled, approval('listing-1')] });
    await promise;

    expect(integrationSdk.listings.close).toHaveBeenCalledWith({ id: 'listing-9' });
    expect(notify.mock.calls).toEqual([['listing-1']]);
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
