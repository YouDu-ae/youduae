const mockShow = jest.fn();
const mockTransition = jest.fn();
const mockMark = jest.fn();

jest.mock('../api-util/mobileSdk', () => ({
  trustedSdkFromBearer: async () => ({
    transactions: {
      show: (...args) => mockShow(...args),
      transition: (...args) => mockTransition(...args),
    },
  }),
  BearerAuthError: class BearerAuthError extends Error {},
}));

jest.mock('../reminders/context', () => ({ createIntegrationSdk: () => ({}) }));

jest.mock('../api-util/listingCompletion', () => ({
  ...jest.requireActual('../api-util/listingCompletion'),
  markListingCompleted: (...args) => mockMark(...args),
}));

const completeTransaction = require('./complete-transaction');

const transaction = lastTransition => ({
  data: {
    data: {
      attributes: { lastTransition },
      relationships: { listing: { data: { id: { uuid: 'task-1' } } } },
    },
  },
});

const call = async () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.end = jest.fn(() => res);
  await completeTransaction({ body: { transactionId: 'tx-1' }, headers: {} }, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

describe('POST /api/complete-transaction', () => {
  beforeEach(() => {
    [mockShow, mockTransition, mockMark].forEach(mock => mock.mockReset());
    mockMark.mockResolvedValue('marked');
  });

  it('marks the task completed after the deal completes', async () => {
    mockShow.mockResolvedValue(transaction('transition/accept-offer'));
    mockTransition.mockResolvedValue({ data: {} });

    const result = await call();

    expect(result.status).toBe(200);
    expect(mockShow).toHaveBeenCalledWith({ id: 'tx-1', include: ['listing'] });
    expect(mockMark).toHaveBeenCalledWith(expect.anything(), 'task-1');
  });

  it('also marks a deal that was completed earlier', async () => {
    mockShow.mockResolvedValue(transaction('transition/complete'));

    const result = await call();

    expect(result.body.alreadyCompleted).toBe(true);
    expect(mockTransition).not.toHaveBeenCalled();
    expect(mockMark).toHaveBeenCalledWith(expect.anything(), 'task-1');
  });

  // The deal is done; a failed mark is caught up by the event poller.
  it('still reports success when the task cannot be marked', async () => {
    mockShow.mockResolvedValue(transaction('transition/accept-offer'));
    mockTransition.mockResolvedValue({ data: {} });
    mockMark.mockRejectedValue(new Error('integration api down'));

    const result = await call();

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
  });

  it('does not mark anything when the transition fails', async () => {
    mockShow.mockResolvedValue(transaction('transition/inquire'));
    mockTransition.mockRejectedValue({ status: 409, data: { errors: [{ code: 'x' }] } });

    const result = await call();

    expect(result.status).toBe(409);
    expect(mockMark).not.toHaveBeenCalled();
  });
});
