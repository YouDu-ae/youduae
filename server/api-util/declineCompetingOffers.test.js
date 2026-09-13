// jest.mock is hoisted above the file, so the factory may only reach names
// prefixed with "mock".
const mockNotifyOfferDeclined = jest.fn();

jest.mock('../api/telegram-bot', () => ({
  notifyOfferDeclined: (...args) => mockNotifyOfferDeclined(...args),
}));

const { declineCompetingOffers } = require('./declineCompetingOffers');

const uuid = value => ({ uuid: value });

const offer = (id, executorId) => ({
  id: uuid(id),
  relationships: { customer: { data: { id: uuid(executorId) } } },
});

// Only the pieces declineCompetingOffers touches, so a test reads as the data
// it cares about rather than as a transcript of the Sharetribe SDK.
const fakeSdk = ({ offers, listingId = 'listing-1', declineFails = [] }) => {
  const declined = [];

  return {
    declined,
    transactions: {
      show: jest.fn(async () => ({
        data: { data: { relationships: { listing: { data: { id: uuid(listingId) } } } } },
      })),
      query: jest.fn(async () => ({
        data: {
          data: offers,
          included: [
            { type: 'listing', id: uuid(listingId), attributes: { title: 'Собрать шкаф' } },
          ],
        },
      })),
      transition: jest.fn(async ({ id, transition }) => {
        if (declineFails.includes(id)) {
          throw new Error(`cannot decline ${id}`);
        }
        declined.push({ id, transition });
        return { data: {} };
      }),
    },
  };
};

describe('declineCompetingOffers', () => {
  beforeEach(() => {
    mockNotifyOfferDeclined.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('declines the losing offers and leaves the hired one alone', async () => {
    const sdk = fakeSdk({
      offers: [offer('tx-winner', 'user-1'), offer('tx-2', 'user-2'), offer('tx-3', 'user-3')],
    });

    const result = await declineCompetingOffers({
      trustedSdk: sdk,
      acceptedTransactionId: 'tx-winner',
      listingId: 'listing-1',
    });

    expect(result).toEqual({ declined: 2, failed: 0 });
    expect(sdk.declined).toEqual([
      { id: 'tx-2', transition: 'transition/decline-offer' },
      { id: 'tx-3', transition: 'transition/decline-offer' },
    ]);
  });

  it('asks only for offers still waiting for an answer', async () => {
    const sdk = fakeSdk({ offers: [offer('tx-winner', 'user-1')] });

    await declineCompetingOffers({
      trustedSdk: sdk,
      acceptedTransactionId: 'tx-winner',
      listingId: 'listing-1',
    });

    expect(sdk.transactions.query).toHaveBeenCalledWith(
      expect.objectContaining({
        listingId: 'listing-1',
        lastTransitions: ['transition/inquire'],
      })
    );
  });

  it('tells each specialist that someone else was chosen', async () => {
    const sdk = fakeSdk({ offers: [offer('tx-winner', 'user-1'), offer('tx-2', 'user-2')] });

    await declineCompetingOffers({
      trustedSdk: sdk,
      acceptedTransactionId: 'tx-winner',
      listingId: 'listing-1',
    });

    expect(mockNotifyOfferDeclined).toHaveBeenCalledTimes(1);
    expect(mockNotifyOfferDeclined).toHaveBeenCalledWith('user-2', {
      listingTitle: 'Собрать шкаф',
      executorChosen: true,
    });
  });

  it('keeps going when one offer refuses to close', async () => {
    const sdk = fakeSdk({
      offers: [offer('tx-winner', 'user-1'), offer('tx-2', 'user-2'), offer('tx-3', 'user-3')],
      declineFails: ['tx-2'],
    });

    const result = await declineCompetingOffers({
      trustedSdk: sdk,
      acceptedTransactionId: 'tx-winner',
      listingId: 'listing-1',
    });

    expect(result).toEqual({ declined: 1, failed: 1 });
    expect(sdk.declined).toEqual([{ id: 'tx-3', transition: 'transition/decline-offer' }]);
  });

  it('still declines when a failed notification throws', async () => {
    mockNotifyOfferDeclined.mockRejectedValue(new Error('telegram down'));
    const sdk = fakeSdk({ offers: [offer('tx-winner', 'user-1'), offer('tx-2', 'user-2')] });

    const result = await declineCompetingOffers({
      trustedSdk: sdk,
      acceptedTransactionId: 'tx-winner',
      listingId: 'listing-1',
    });

    expect(result).toEqual({ declined: 1, failed: 0 });
  });

  it('looks up the task when the caller does not know it', async () => {
    const sdk = fakeSdk({ offers: [offer('tx-winner', 'user-1'), offer('tx-2', 'user-2')] });

    await declineCompetingOffers({ trustedSdk: sdk, acceptedTransactionId: 'tx-winner' });

    expect(sdk.transactions.show).toHaveBeenCalledWith({ id: 'tx-winner' });
    expect(sdk.transactions.query).toHaveBeenCalledWith(
      expect.objectContaining({ listingId: 'listing-1' })
    );
  });

  it('does nothing when the transaction has no task', async () => {
    const sdk = fakeSdk({ offers: [] });
    sdk.transactions.show = jest.fn(async () => ({ data: { data: { relationships: {} } } }));

    const result = await declineCompetingOffers({
      trustedSdk: sdk,
      acceptedTransactionId: 'tx-winner',
    });

    expect(result).toEqual({ declined: 0, failed: 0 });
    expect(sdk.transactions.query).not.toHaveBeenCalled();
  });
});
