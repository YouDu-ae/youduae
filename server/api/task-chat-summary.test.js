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

jest.mock('sharetribe-flex-sdk', () => ({ createInstance: () => ({}) }));

const mockFetchReviewStats = jest.fn();
const mockFetchCompletedCount = jest.fn();

jest.mock('../api-util/reputation', () => ({
  ROLE: { SPECIALIST: 'specialist', CLIENT: 'client' },
  resolveIsVerified: profile => profile?.metadata?.isVerified === true,
  fetchReviewStats: (...args) => mockFetchReviewStats(...args),
  fetchCompletedCount: (...args) => mockFetchCompletedCount(...args),
}));

const taskChatSummary = require('./task-chat-summary');
const { otherOffersForAuthor } = taskChatSummary;

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

const OTHER_PROVIDER = 'ffffffff-0000-4000-8000-000000000006';
const OTHER_TX = '99999999-0000-4000-8000-000000000007';

const pendingPage = () => ({
  data: {
    meta: { totalItems: 2 },
    data: [
      {
        id: { uuid: TX_ID },
        attributes: { protectedData: { offer: { price: 3500, currency: 'AED', comment: 'secret' } } },
        relationships: { customer: ref('user', PROVIDER_ID) },
      },
      {
        id: { uuid: OTHER_TX },
        attributes: { protectedData: { offer: { price: 2800, currency: 'AED', comment: 'also secret' } } },
        relationships: { customer: ref('user', OTHER_PROVIDER) },
      },
    ],
    included: [
      {
        id: { uuid: OTHER_PROVIDER },
        type: 'user',
        attributes: { profile: { displayName: 'Stanislav', metadata: { isVerified: true } } },
      },
    ],
  },
});

describe('task-chat-summary', () => {
  beforeEach(() => {
    process.env.INTEGRATION_API_CLIENT_ID = 'id';
    process.env.INTEGRATION_API_CLIENT_SECRET = 'secret';
    process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID = 'id';
    process.env.SHARETRIBE_SDK_CLIENT_SECRET = 'secret';
    mockTxShow.mockReset().mockImplementation(params => Promise.resolve(txResponse(params)));
    mockTxQuery.mockReset().mockResolvedValue({ data: { meta: { totalItems: 4 } } });
    mockFetchReviewStats.mockReset().mockResolvedValue({ count: 4, averageRating: 4.5 });
    mockFetchCompletedCount.mockReset().mockResolvedValue(7);
  });

  it.each([
    ['provider', PROVIDER_ID],
    ['customer', CUSTOMER_ID],
  ])('counts the other pending offers for the %s', async (_, userId) => {
    const res = await call(userId);

    expect(res.status).toHaveBeenCalledWith(200);
    if (userId === PROVIDER_ID) {
      expect(res.json.mock.calls[0][0]).toEqual(expect.objectContaining({ otherOfferCount: 3 }));
    } else {
      expect(res.json).toHaveBeenCalledWith({ otherOfferCount: 3 });
    }
    expect(mockTxQuery).toHaveBeenCalledWith(expect.objectContaining({ listingId: LISTING_ID }));
  });

  it('gives the task author the other offers without their comments', async () => {
    mockTxQuery.mockResolvedValue(pendingPage());

    const res = await call(PROVIDER_ID);

    expect(res.json).toHaveBeenCalledWith({
      otherOfferCount: 1,
      currentSpecialist: { verified: false, rating: 4.5, reviewCount: 4, completedCount: 7 },
      otherOffers: [
        {
          transactionId: OTHER_TX,
          name: 'Stanislav',
          price: 2800,
          currency: 'AED',
          verified: true,
          rating: 4.5,
          reviewCount: 4,
          completedCount: 7,
        },
      ],
    });
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('secret');
  });

  it('gives the specialist only the number', async () => {
    mockTxQuery.mockResolvedValue(pendingPage());

    const res = await call(CUSTOMER_ID);

    expect(res.json).toHaveBeenCalledWith({ otherOfferCount: 1 });
    expect(mockTxQuery).toHaveBeenCalledWith(expect.not.objectContaining({ include: ['customer'] }));
  });

  it('refuses someone outside the chat', async () => {
    const res = await call('eeeeeeee-0000-4000-8000-000000000005');

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockTxQuery).not.toHaveBeenCalled();
  });
});

describe('otherOffersForAuthor', () => {
  it('skips the current chat and a missing name', () => {
    const offers = otherOffersForAuthor(
      [
        { id: { uuid: TX_ID }, relationships: { provider: ref('user', PROVIDER_ID) } },
        {
          id: { uuid: OTHER_TX },
          attributes: { protectedData: { offer: { price: '1200' } } },
          relationships: { customer: ref('user', OTHER_PROVIDER) },
        },
      ],
      [],
      TX_ID
    );

    expect(offers).toEqual([
      {
        transactionId: OTHER_TX,
        specialistId: OTHER_PROVIDER,
        name: null,
        price: 1200,
        currency: 'AED',
        verified: false,
      },
    ]);
  });
});
