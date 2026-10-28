const mockTransactionsQuery = jest.fn();
const mockListingsShow = jest.fn();

jest.mock('sharetribe-flex-integration-sdk', () => ({
  createInstance: () => ({ transactions: { query: (...args) => mockTransactionsQuery(...args) } }),
}));

jest.mock('sharetribe-flex-sdk', () => ({
  tokenStore: { memoryStore: () => ({ setToken: () => {} }) },
  createInstance: () => ({
    currentUser: { show: async () => ({ data: { data: { id: { uuid: 'author-1' } } } }) },
    listings: { show: (...args) => mockListingsShow(...args) },
  }),
}));

jest.mock('../api-util/reputation', () => ({
  ROLE: { SPECIALIST: 'specialist' },
  resolveIsVerified: () => false,
  fetchReviewStats: async () => ({ count: 0, averageRating: 0 }),
  fetchCompletedCount: async () => 0,
}));

jest.mock('../db', () => ({ getBlockedUserIds: async () => [] }));

const listingResponses = require('./listing-responses');

const ENV_KEYS = ['INTEGRATION_API_CLIENT_ID', 'INTEGRATION_API_CLIENT_SECRET'];
const savedEnv = {};

const offer = (id, specialistId, lastTransition) => ({
  id: { uuid: id },
  attributes: { lastTransition, createdAt: '2026-10-20T10:00:00.000Z', protectedData: {} },
  relationships: { customer: { data: { id: { uuid: specialistId } } } },
});

const specialist = id => ({
  type: 'user',
  id: { uuid: id },
  attributes: { profile: { displayName: id } },
});

const taskWith = publicData => ({
  data: {
    data: {
      attributes: { publicData },
      relationships: { author: { data: { id: { uuid: 'author-1' } } } },
    },
  },
});

const call = async () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.end = jest.fn(() => res);
  await listingResponses(
    {
      query: { listingId: 'task-1' },
      headers: { authorization: 'Bearer token' },
      authUserId: 'author-1',
    },
    res
  );
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

describe('GET /api/listing-responses', () => {
  beforeAll(() => {
    ENV_KEYS.forEach(key => {
      savedEnv[key] = process.env[key];
      process.env[key] = 'test';
    });
  });

  afterAll(() => {
    ENV_KEYS.forEach(key => {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    });
  });

  beforeEach(() => {
    mockTransactionsQuery.mockReset().mockResolvedValue({
      data: {
        data: [
          offer('tx-1', 'user-1', 'transition/accept-offer'),
          offer('tx-2', 'user-2', 'transition/inquire'),
          offer('tx-3', 'user-3', 'transition/inquire'),
        ],
        included: [specialist('user-1'), specialist('user-2'), specialist('user-3')],
      },
    });
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Hiding them only in the app would let any other client offer them again.
  it('leaves out the specialists taken off the task', async () => {
    mockListingsShow.mockResolvedValue(
      taskWith({ status: 'open', excludedOfferCustomerIds: ['user-1'] })
    );

    const { status, body } = await call();

    expect(status).toBe(200);
    expect(body.data.map(response => response.customerId).sort()).toEqual(['user-2', 'user-3']);
  });

  it('keeps the earlier offers that were never declined', async () => {
    mockListingsShow.mockResolvedValue(taskWith({ status: 'open' }));

    const { body } = await call();

    expect(body.data.filter(response => response.status === 'pending')).toHaveLength(2);
  });
});
