const mockQuery = jest.fn();
const mockInitiate = jest.fn();

jest.mock('../api-util/sdk', () => ({
  getSdk: () => ({
    listings: {
      show: async () => ({
        data: { data: { attributes: { publicData: { unitType: 'inquiry' } } } },
      }),
    },
    transactions: { query: (...args) => mockQuery(...args) },
  }),
  fetchCommission: async () => ({ data: { data: [] } }),
  getTrustedSdk: async () => ({ transactions: { initiate: (...args) => mockInitiate(...args) } }),
  handleError: (res, error) =>
    res
      .status(error.status || 500)
      .json({ error: error.message })
      .end(),
  serialize: data => data,
}));

jest.mock('../api-util/lineItems', () => ({ transactionLineItems: () => [] }));

const initiatePrivileged = require('./initiate-privileged');

const request = ({ transition = 'transition/inquire', listingId = 'task-1' } = {}) => ({
  body: {
    isSpeculative: false,
    orderData: {},
    bodyParams: {
      processAlias: 'assignment-flow-v3/release-1',
      transition,
      params: { listingId, protectedData: { offer: { price: 100, comment: 'Сделаю завтра' } } },
    },
    queryParams: {},
  },
});

const call = async req => {
  const res = {};
  ['status', 'set', 'send', 'json', 'end'].forEach(method => {
    res[method] = jest.fn(() => res);
  });
  await initiatePrivileged(req, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0]?.[0] };
};

const created = transactionId => ({
  status: 200,
  statusText: 'OK',
  data: { data: { id: { uuid: transactionId } } },
});

describe('POST /api/initiate-privileged', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockInitiate.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('makes the offer when the specialist has none on the task', async () => {
    mockQuery.mockResolvedValue({ data: { data: [] } });
    mockInitiate.mockResolvedValue(created('tx-new'));

    const result = await call(request());

    expect(result.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith({ listingId: 'task-1', only: 'order', perPage: 1 });
    expect(mockInitiate).toHaveBeenCalledTimes(1);
  });

  it('refuses a second offer on the same task', async () => {
    mockQuery.mockResolvedValue({ data: { data: [{ id: { uuid: 'tx-earlier' } }] } });

    const result = await call(request());

    expect(result.status).toBe(409);
    expect(result.body).toEqual({ error: 'offer_already_sent', transactionId: 'tx-earlier' });
    expect(mockInitiate).not.toHaveBeenCalled();
  });

  // A double click, or a resend while the first request is still running.
  it('lets one of two simultaneous offers through', async () => {
    const offers = [];
    mockQuery.mockImplementation(async () => ({ data: { data: [...offers] } }));
    mockInitiate.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      offers.push({ id: { uuid: `tx-${offers.length + 1}` } });
      return created(`tx-${offers.length}`);
    });

    const results = await Promise.all([call(request()), call(request())]);

    expect(mockInitiate).toHaveBeenCalledTimes(1);
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
  });

  it('does not hold up the next offer after one fails', async () => {
    mockQuery.mockResolvedValue({ data: { data: [] } });
    mockInitiate
      .mockRejectedValueOnce(Object.assign(new Error('Sharetribe is down'), { status: 503 }))
      .mockResolvedValueOnce(created('tx-new'));

    const failed = await call(request());
    const retried = await call(request());

    expect(failed.status).toBe(503);
    expect(retried.status).toBe(200);
  });

  it('checks only offers', async () => {
    mockInitiate.mockResolvedValue(created('tx-order'));

    const result = await call(request({ transition: 'transition/request-payment' }));

    expect(result.status).toBe(200);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
