const { processDeletionEvents, CURSOR_NAME } = require('./accountDeletions');

let nextSequence = 500;

const deletion = userId => ({
  attributes: {
    eventType: 'user/deleted',
    sequenceId: nextSequence++,
    resourceId: { uuid: userId },
    resource: null,
  },
});

const fakeDb = ({ cursor = { sequenceId: 10, updatedAt: new Date() }, requests = {} } = {}) => ({
  getOrStartEventCursor: jest.fn(async () => cursor),
  saveEventCursor: jest.fn(async () => {}),
  deleteUserLocalData: jest.fn(async () => {}),
  completeDeletionRequest: jest.fn(async userId => requests[userId] || null),
});

const run = ({ events = [], db = fakeDb(), sendEmail = jest.fn(async () => true) } = {}) => {
  const integrationSdk = {
    events: { query: jest.fn(async () => ({ data: { data: events, meta: { perPage: 100 } } })) },
  };
  return {
    integrationSdk,
    db,
    sendEmail,
    promise: processDeletionEvents({ integrationSdk, db, sendEmail, log: () => {} }),
  };
};

describe('processDeletionEvents', () => {
  it('clears our tables for every deleted user', async () => {
    const { promise, db } = run({ events: [deletion('user-1'), deletion('user-2')] });
    await promise;

    expect(db.deleteUserLocalData.mock.calls).toEqual([['user-1'], ['user-2']]);
  });

  // The person asked in the app and was promised a letter when it is done.
  it('confirms by e-mail when the deletion answers an open request', async () => {
    const db = fakeDb({ requests: { 'user-1': { email: 'client@example.com' } } });
    const { promise, sendEmail } = run({ events: [deletion('user-1')], db });

    const result = await promise;

    expect(sendEmail).toHaveBeenCalledWith('deleted', 'client@example.com');
    expect(result.confirmed).toBe(1);
  });

  it('writes to nobody when there was no request, such as a spam account removed by the operator', async () => {
    const { promise, sendEmail } = run({ events: [deletion('spammer')] });
    await promise;
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('keeps going when one user cannot be cleared', async () => {
    const db = fakeDb();
    db.deleteUserLocalData.mockImplementation(async userId => {
      if (userId === 'user-1') throw new Error('db down');
    });
    const events = [deletion('user-1'), deletion('user-2')];

    const { promise } = run({ events, db });
    const result = await promise;

    expect(result.failed).toBe(1);
    expect(db.deleteUserLocalData).toHaveBeenCalledWith('user-2');
    expect(db.saveEventCursor).toHaveBeenCalledWith(CURSOR_NAME, events[1].attributes.sequenceId);
  });

  it('reads only user deletions, after the stored place', async () => {
    const { promise, integrationSdk } = run();
    await promise;
    expect(integrationSdk.events.query).toHaveBeenCalledWith({
      startAfterSequenceId: 10,
      eventTypes: 'user/deleted',
    });
  });

  it('starts from the moment it was switched on, not from history', async () => {
    const startedAt = new Date('2026-09-24T09:00:00Z');
    const db = fakeDb({ cursor: { sequenceId: null, updatedAt: startedAt } });
    const { promise, integrationSdk } = run({ db });
    await promise;
    expect(integrationSdk.events.query).toHaveBeenCalledWith({
      createdAtStart: startedAt,
      eventTypes: 'user/deleted',
    });
  });
});
