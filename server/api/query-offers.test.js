const mockQuery = jest.fn();

jest.mock('../api-util/sdk', () => ({
  getSdk: () => ({ transactions: { query: (...args) => mockQuery(...args) } }),
  handleError: (res, e) => res.status(e?.status || 500).end(),
  serialize: value => JSON.stringify(value),
}));

const queryOffers = require('./query-offers');

const offer = (id, specialistId, lastTransition) => ({
  id: { uuid: id },
  attributes: { lastTransition },
  relationships: { customer: { data: { id: { uuid: specialistId } } } },
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
    res.end = jest.fn(() => resolve(res));
    queryOffers({ query: { listingId: 'task-1' } }, res);
  });

describe('GET /api/query-offers', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Their deal stays accepted, so without this the author's list would show
  // them as the executor next to the new one.
  it('leaves out the specialists taken off the task', async () => {
    mockQuery.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: {
        data: [
          offer('tx-1', 'user-1', 'transition/accept-offer'),
          offer('tx-2', 'user-2', 'transition/accept-offer'),
          offer('tx-3', 'user-3', 'transition/inquire'),
        ],
        included: [
          {
            type: 'listing',
            id: { uuid: 'task-1' },
            attributes: { publicData: { excludedOfferCustomerIds: ['user-1'] } },
          },
        ],
      },
    });

    const res = await call();

    expect(res.body.data.data.map(tx => tx.id.uuid)).toEqual(['tx-2', 'tx-3']);
  });

  it('keeps every offer on a task nobody was taken off', async () => {
    mockQuery.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: {
        data: [offer('tx-2', 'user-2', 'transition/inquire')],
        included: [{ type: 'listing', id: { uuid: 'task-1' }, attributes: { publicData: {} } }],
      },
    });

    const res = await call();

    expect(res.body.data.data).toHaveLength(1);
  });
});
