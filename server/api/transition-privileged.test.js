const mockShow = jest.fn();
const mockTransition = jest.fn();
const mockTransitionSpeculative = jest.fn();
const mockNotifyCompetingOffers = jest.fn();
const mockDeclineRemainingOffers = jest.fn();

jest.mock('../api-util/sdk', () => ({
  getTrustedSdk: async () => ({
    transactions: {
      show: (...args) => mockShow(...args),
      transition: (...args) => mockTransition(...args),
      transitionSpeculative: (...args) => mockTransitionSpeculative(...args),
    },
  }),
  handleError: (res, e) => res.status(e?.status || 500).end(),
  serialize: value => JSON.stringify(value),
}));

// The executor's own notices are not what these tests are about.
jest.mock('sharetribe-flex-integration-sdk', () => ({
  createInstance: () => ({
    transactions: { show: async () => ({ data: { data: { relationships: {} }, included: [] } }) },
  }),
}));
jest.mock('./send-notification', () => ({ sendExecutorSelectedNotification: jest.fn() }));
jest.mock('./telegram-bot', () => ({
  notifyOfferAccepted: jest.fn(),
  notifyOfferDeclined: jest.fn(),
}));

jest.mock('../api-util/competingOffers', () => ({
  notifyCompetingOffers: (...args) => mockNotifyCompetingOffers(...args),
  declineRemainingOffers: (...args) => mockDeclineRemainingOffers(...args),
}));

const transitionPrivileged = require('./transition-privileged');

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

const call = (transition, { isSpeculative = false } = {}) =>
  new Promise(resolve => {
    const res = {};
    res.status = jest.fn(() => res);
    res.set = jest.fn(() => res);
    res.send = jest.fn(() => res);
    res.json = jest.fn(() => res);
    res.end = jest.fn(() =>
      resolve({ status: res.status.mock.calls[0][0], body: res.json.mock.calls[0]?.[0] })
    );
    transitionPrivileged(
      {
        body: {
          isSpeculative,
          bodyParams: { id: { uuid: 'tx-2' }, transition, params: {} },
          queryParams: {},
        },
      },
      res
    );
  });

describe('POST /api/transition-privileged', () => {
  beforeEach(() => {
    [
      mockShow,
      mockTransition,
      mockTransitionSpeculative,
      mockNotifyCompetingOffers,
      mockDeclineRemainingOffers,
    ].forEach(mock => mock.mockReset());
    const landed = { status: 200, statusText: 'OK', data: { data: { id: { uuid: 'tx-2' } } } };
    mockTransition.mockResolvedValue(landed);
    mockTransitionSpeculative.mockResolvedValue(landed);
    mockNotifyCompetingOffers.mockResolvedValue({ notified: 0, failed: 0 });
    mockDeclineRemainingOffers.mockResolvedValue({ declined: 0, failed: 0 });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('hiring', () => {
    it('hires the specialist and only tells the others, leaving their offers pending', async () => {
      mockShow.mockResolvedValue(deal({ status: 'open' }));

      const result = await call('transition/accept-offer');

      expect(result.status).toBe(200);
      expect(mockNotifyCompetingOffers).toHaveBeenCalledWith(
        expect.objectContaining({
          listingId: 'task-1',
          executorId: 'user-2',
          transactionId: 'tx-2',
        })
      );
      expect(mockDeclineRemainingOffers).not.toHaveBeenCalled();
    });

    it('refuses a second executor while one works on the task', async () => {
      mockShow.mockResolvedValue(
        deal({ status: 'in-progress', hired: true, assignedTo: 'user-1' })
      );

      const result = await call('transition/accept-offer');

      expect(result.status).toBe(409);
      expect(result.body.error).toBe('executor_already_chosen');
      expect(mockTransition).not.toHaveBeenCalled();
    });

    it('never hires a specialist taken off the task again', async () => {
      mockShow.mockResolvedValue(deal({ status: 'open', excludedOfferCustomerIds: ['user-2'] }));

      const result = await call('transition/accept-offer');

      expect(result.status).toBe(409);
      expect(result.body.error).toBe('specialist_removed');
      expect(mockTransition).not.toHaveBeenCalled();
    });

    it('leaves a speculative hire alone', async () => {
      const result = await call('transition/accept-offer', { isSpeculative: true });

      expect(result.status).toBe(200);
      expect(mockShow).not.toHaveBeenCalled();
      expect(mockNotifyCompetingOffers).not.toHaveBeenCalled();
    });
  });

  describe('completing', () => {
    it('declines the offers still waiting once the work is done', async () => {
      mockShow.mockResolvedValue(deal({ status: 'in-progress', assignedTo: 'user-2' }));

      const result = await call('transition/complete');

      expect(result.status).toBe(200);
      expect(mockDeclineRemainingOffers).toHaveBeenCalledWith(
        expect.objectContaining({
          listingId: 'task-1',
          executorId: 'user-2',
          transactionId: 'tx-2',
        })
      );
    });

    // From the removed specialist's chat, where the deal is still accepted.
    it('refuses to complete the work of a specialist taken off the task', async () => {
      mockShow.mockResolvedValue(
        deal({ status: 'in-progress', assignedTo: 'user-3', excludedOfferCustomerIds: ['user-2'] })
      );

      const result = await call('transition/complete');

      expect(result.status).toBe(409);
      expect(result.body.error).toBe('removed_executor_deal');
      expect(mockTransition).not.toHaveBeenCalled();
    });

    it('still reports the completion when the other offers cannot be declined', async () => {
      mockShow.mockResolvedValue(deal({ status: 'in-progress', assignedTo: 'user-2' }));
      mockDeclineRemainingOffers.mockRejectedValue(new Error('sharetribe down'));

      const result = await call('transition/complete');

      expect(result.status).toBe(200);
    });
  });
});
