const mockQuery = jest.fn();

jest.mock('../api-util/sdk', () => ({
  getSdk: () => ({ transactions: { query: (...args) => mockQuery(...args) } }),
  handleError: (res, e) => res.status(e?.status || 500).end(),
  serialize: value => JSON.stringify(value),
}));

const checkMyOffer = require('./check-my-offer');

const myOffer = (lastTransition, publicData) => ({
  status: 200,
  statusText: 'OK',
  data: {
    data: [
      {
        id: { uuid: 'tx-1' },
        attributes: { lastTransition },
        relationships: { customer: { data: { id: { uuid: 'user-1' } } } },
      },
    ],
    included: [{ type: 'listing', id: { uuid: 'task-1' }, attributes: { publicData } }],
  },
});

const call = () =>
  new Promise(resolve => {
    const res = {};
    res.status = jest.fn(() => res);
    res.set = jest.fn(() => res);
    res.json = jest.fn(() => res);
    res.send = jest.fn(body => {
      res.body = JSON.parse(body);
      return res;
    });
    res.end = jest.fn(() => resolve(res.body.data));
    checkMyOffer({ query: { listingId: 'task-1' } }, res);
  });

describe('GET /api/check-my-offer', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // The deal of a removed executor stays accepted, and the form would
  // congratulate him on being chosen.
  it('tells a specialist taken off the task that he was removed', async () => {
    mockQuery.mockResolvedValue(
      myOffer('transition/accept-offer', { status: 'open', excludedOfferCustomerIds: ['user-1'] })
    );

    const result = await call();

    expect(result.offerStatus).toBe('removed');
    expect(result.hasOffer).toBe(true);
  });

  it('still reports the hired executor as accepted', async () => {
    mockQuery.mockResolvedValue(
      myOffer('transition/accept-offer', { status: 'in-progress', assignedTo: 'user-1' })
    );

    const result = await call();

    expect(result.offerStatus).toBe('accepted');
  });

  it('asks for the task and the specialist along with the offers', async () => {
    mockQuery.mockResolvedValue(myOffer('transition/inquire', {}));

    const result = await call();

    expect(result.offerStatus).toBe('pending');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({ only: 'order', include: ['customer', 'listing'] })
    );
  });
});
