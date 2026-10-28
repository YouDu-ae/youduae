const mockShow = jest.fn();
const mockTransition = jest.fn();
const mockNotifyCompetingOffers = jest.fn();

jest.mock('../api-util/mobileSdk', () => ({
  trustedSdkFromBearer: async () => ({
    transactions: {
      show: (...args) => mockShow(...args),
      transition: (...args) => mockTransition(...args),
    },
  }),
  BearerAuthError: class BearerAuthError extends Error {},
}));

// The executor's own notices are not what these tests are about.
jest.mock('sharetribe-flex-integration-sdk', () => ({
  createInstance: () => ({
    transactions: { show: async () => ({ data: { data: { relationships: {} }, included: [] } }) },
  }),
}));
jest.mock('./send-notification', () => ({ sendExecutorSelectedNotification: jest.fn() }));
jest.mock('./telegram-bot', () => ({ notifyOfferAccepted: jest.fn() }));

jest.mock('../api-util/competingOffers', () => ({
  notifyCompetingOffers: (...args) => mockNotifyCompetingOffers(...args),
}));

const acceptOffer = require('./accept-offer');

const deal = publicData => ({
  data: {
    data: {
      relationships: {
        listing: { data: { id: { uuid: 'task-1' } } },
        customer: { data: { id: { uuid: 'user-2' } } },
      },
    },
    included: [{ type: 'listing', id: { uuid: 'task-1' }, attributes: { publicData } }],
  },
});

const call = async () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.end = jest.fn(() => res);
  await acceptOffer({ body: { transactionId: 'tx-2' }, headers: {} }, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

describe('POST /api/accept-offer', () => {
  beforeEach(() => {
    [mockShow, mockTransition, mockNotifyCompetingOffers].forEach(mock => mock.mockReset());
    mockTransition.mockResolvedValue({ data: { data: {} } });
    mockNotifyCompetingOffers.mockResolvedValue({ notified: 1, failed: 0 });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('hires the specialist and only tells the others, leaving their offers pending', async () => {
    mockShow.mockResolvedValue(deal({ status: 'open' }));

    const result = await call();

    expect(result.status).toBe(200);
    expect(mockTransition).toHaveBeenCalledTimes(1);
    expect(mockTransition).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tx-2', transition: 'transition/accept-offer' })
    );
    expect(mockNotifyCompetingOffers).toHaveBeenCalledWith(
      expect.objectContaining({ listingId: 'task-1', executorId: 'user-2', transactionId: 'tx-2' })
    );
  });

  it('refuses a second executor while one works on the task', async () => {
    mockShow.mockResolvedValue(deal({ status: 'in-progress', hired: true, assignedTo: 'user-1' }));

    const result = await call();

    expect(result.status).toBe(409);
    expect(result.body.error).toBe('executor_already_chosen');
    expect(mockTransition).not.toHaveBeenCalled();
  });

  it('never hires a specialist taken off the task again', async () => {
    mockShow.mockResolvedValue(deal({ status: 'open', excludedOfferCustomerIds: ['user-2'] }));

    const result = await call();

    expect(result.status).toBe(409);
    expect(result.body.error).toBe('specialist_removed');
    expect(mockTransition).not.toHaveBeenCalled();
  });

  it('still reports the hire when the other specialists cannot be told', async () => {
    mockShow.mockResolvedValue(deal({ status: 'open' }));
    mockNotifyCompetingOffers.mockRejectedValue(new Error('sharetribe down'));

    const result = await call();

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
  });
});
