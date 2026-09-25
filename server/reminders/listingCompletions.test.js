const mockMark = jest.fn();

jest.mock('../api-util/listingCompletion', () => ({
  ...jest.requireActual('../api-util/listingCompletion'),
  markListingCompleted: (...args) => mockMark(...args),
}));

const { processCompletionEvents, CURSOR_NAME } = require('./listingCompletions');

const transitioned = (sequenceId, lastTransition, listingId = `listing-${sequenceId}`) => ({
  attributes: {
    eventType: 'transaction/transitioned',
    sequenceId,
    resource: {
      attributes: { lastTransition },
      relationships: { listing: { data: { id: { uuid: listingId } } } },
    },
  },
});

const fakeDb = () => ({
  getOrStartEventCursor: jest.fn(async () => ({ sequenceId: 10, updatedAt: new Date() })),
  saveEventCursor: jest.fn(async () => {}),
});

const run = (events, db = fakeDb()) => {
  const integrationSdk = {
    events: { query: jest.fn(async () => ({ data: { data: events, meta: { perPage: 100 } } })) },
  };
  return { db, integrationSdk, promise: processCompletionEvents({ integrationSdk, db, log: () => {} }) };
};

describe('processCompletionEvents', () => {
  beforeEach(() => mockMark.mockReset().mockResolvedValue('marked'));

  it('marks the task of every completed deal and nothing else', async () => {
    const { promise, db } = run([
      transitioned(11, 'transition/accept-offer'),
      transitioned(12, 'transition/complete', 'task-a'),
      transitioned(13, 'transition/review-1-by-provider'),
    ]);
    const result = await promise;

    expect(mockMark.mock.calls.map(call => call[1])).toEqual(['task-a']);
    expect(result.completions).toBe(1);
    expect(db.saveEventCursor).toHaveBeenCalledWith(CURSOR_NAME, 13);
  });

  it('keeps going when one task cannot be marked', async () => {
    mockMark.mockRejectedValueOnce(new Error('boom'));
    const { promise } = run([
      transitioned(12, 'transition/complete', 'task-a'),
      transitioned(13, 'transition/complete', 'task-b'),
    ]);
    const result = await promise;

    expect(mockMark).toHaveBeenCalledTimes(2);
    expect(result.failed).toBe(1);
  });
});
