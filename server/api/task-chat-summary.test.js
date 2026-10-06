const mockTxShow = jest.fn();
const mockTxQuery = jest.fn();

jest.mock('sharetribe-flex-integration-sdk', () => ({
  createInstance: () => ({
    transactions: {
      show: (...args) => mockTxShow(...args),
      query: (...args) => mockTxQuery(...args),
    },
  }),
}));

const taskChatSummary = require('./task-chat-summary');

const PROVIDER_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const CUSTOMER_ID = 'bbbbbbbb-0000-4000-8000-000000000002';
const LISTING_ID = 'cccccccc-0000-4000-8000-000000000003';
const TX_ID = 'dddddddd-0000-4000-8000-000000000004';

const ref = (type, uuid) => ({ data: { id: { uuid }, type } });

// The Integration API leaves relationships out unless they are included.
const txResponse = params => ({
  data: {
    data: {
      id: { uuid: TX_ID },
      attributes: { lastTransition: 'transition/inquire' },
      relationships: (params.include || []).length
        ? {
            provider: ref('user', PROVIDER_ID),
            customer: ref('user', CUSTOMER_ID),
            listing: ref('listing', LISTING_ID),
          }
        : {},
    },
  },
});

const call = authUserId => {
  const res = { status: jest.fn(() => res), json: jest.fn(() => res) };
  return taskChatSummary({ authUserId, query: { transactionId: TX_ID } }, res).then(() => res);
};

describe('task-chat-summary', () => {
  beforeEach(() => {
    process.env.INTEGRATION_API_CLIENT_ID = 'id';
    process.env.INTEGRATION_API_CLIENT_SECRET = 'secret';
    mockTxShow.mockReset().mockImplementation(params => Promise.resolve(txResponse(params)));
    mockTxQuery.mockReset().mockResolvedValue({ data: { meta: { totalItems: 4 } } });
  });

  it.each([
    ['provider', PROVIDER_ID],
    ['customer', CUSTOMER_ID],
  ])('counts the other pending offers for the %s', async (_, userId) => {
    const res = await call(userId);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ otherOfferCount: 3 });
    expect(mockTxQuery).toHaveBeenCalledWith(expect.objectContaining({ listingId: LISTING_ID }));
  });

  it('refuses someone outside the chat', async () => {
    const res = await call('eeeeeeee-0000-4000-8000-000000000005');

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockTxQuery).not.toHaveBeenCalled();
  });
});
