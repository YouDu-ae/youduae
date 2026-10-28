// jest.mock is hoisted above the file, so the factory may only reach names
// prefixed with "mock".
const mockNotifyOtherExecutorChosen = jest.fn();

jest.mock('../api/telegram-bot', () => ({
  notifyOtherExecutorChosen: (...args) => mockNotifyOtherExecutorChosen(...args),
}));

const { notifyCompetingOffers, declineRemainingOffers } = require('./competingOffers');

const uuid = value => ({ uuid: value });

const offer = (id, specialistId) => ({
  id: uuid(id),
  relationships: { customer: { data: { id: uuid(specialistId) } } },
});

// Only the pieces the sweeps touch, so a test reads as the data it cares about
// rather than as a transcript of the Sharetribe SDK.
const fakeSdk = ({ offers, listingId = 'listing-1', declineFails = [] }) => {
  const declined = [];

  return {
    declined,
    transactions: {
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

const hire = (sdk, overrides = {}) => ({
  trustedSdk: sdk,
  listingId: 'listing-1',
  executorId: 'user-1',
  transactionId: 'tx-hired',
  ...overrides,
});

beforeEach(() => {
  mockNotifyOtherExecutorChosen.mockReset().mockResolvedValue(true);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('notifyCompetingOffers', () => {
  // «Сменить исполнителя» returns the author to these offers, and a declined
  // offer can never come back.
  it('leaves the other offers pending', async () => {
    const sdk = fakeSdk({
      offers: [offer('tx-hired', 'user-1'), offer('tx-2', 'user-2'), offer('tx-3', 'user-3')],
    });

    await notifyCompetingOffers(hire(sdk));

    expect(sdk.transactions.transition).not.toHaveBeenCalled();
  });

  it('tells each other specialist that someone else was chosen', async () => {
    const sdk = fakeSdk({
      offers: [offer('tx-hired', 'user-1'), offer('tx-2', 'user-2'), offer('tx-3', 'user-3')],
    });

    const result = await notifyCompetingOffers(hire(sdk));

    expect(result).toEqual({ notified: 2, failed: 0 });
    expect(mockNotifyOtherExecutorChosen.mock.calls).toEqual([
      ['user-2', { listingTitle: 'Собрать шкаф' }],
      ['user-3', { listingTitle: 'Собрать шкаф' }],
    ]);
  });

  it('asks only for offers still waiting for an answer on the task', async () => {
    const sdk = fakeSdk({ offers: [] });

    await notifyCompetingOffers(hire(sdk));

    expect(sdk.transactions.query).toHaveBeenCalledWith(
      expect.objectContaining({ listingId: 'listing-1', lastTransitions: ['transition/inquire'] })
    );
  });

  it('leaves out another offer by the hired specialist', async () => {
    const sdk = fakeSdk({ offers: [offer('tx-repeat', 'user-1'), offer('tx-2', 'user-2')] });

    await notifyCompetingOffers(hire(sdk));

    expect(mockNotifyOtherExecutorChosen).toHaveBeenCalledTimes(1);
    expect(mockNotifyOtherExecutorChosen).toHaveBeenCalledWith('user-2', expect.anything());
  });

  it('counts only the specialists Telegram reached', async () => {
    mockNotifyOtherExecutorChosen.mockResolvedValueOnce(false);
    const sdk = fakeSdk({ offers: [offer('tx-2', 'user-2'), offer('tx-3', 'user-3')] });

    const result = await notifyCompetingOffers(hire(sdk));

    expect(result).toEqual({ notified: 1, failed: 0 });
  });

  it('keeps going when one notice fails', async () => {
    mockNotifyOtherExecutorChosen.mockRejectedValueOnce(new Error('telegram down'));
    const sdk = fakeSdk({ offers: [offer('tx-2', 'user-2'), offer('tx-3', 'user-3')] });

    const result = await notifyCompetingOffers(hire(sdk));

    expect(result).toEqual({ notified: 1, failed: 1 });
  });

  it('does nothing when the deal has no task', async () => {
    const sdk = fakeSdk({ offers: [] });

    const result = await notifyCompetingOffers(hire(sdk, { listingId: null }));

    expect(result).toEqual({ notified: 0, failed: 0 });
    expect(sdk.transactions.query).not.toHaveBeenCalled();
  });
});

describe('declineRemainingOffers', () => {
  it('declines the offers still waiting once the work is done', async () => {
    const sdk = fakeSdk({
      offers: [offer('tx-hired', 'user-1'), offer('tx-2', 'user-2'), offer('tx-3', 'user-3')],
    });

    const result = await declineRemainingOffers(hire(sdk));

    expect(result).toEqual({ declined: 2, failed: 0 });
    expect(sdk.declined).toEqual([
      { id: 'tx-2', transition: 'transition/decline-offer' },
      { id: 'tx-3', transition: 'transition/decline-offer' },
    ]);
  });

  // They heard about the hire already, and the decline brings its own letter.
  it('sends nothing to Telegram', async () => {
    const sdk = fakeSdk({ offers: [offer('tx-2', 'user-2')] });

    await declineRemainingOffers(hire(sdk));

    expect(mockNotifyOtherExecutorChosen).not.toHaveBeenCalled();
  });

  it('leaves another offer by the specialist who did the work alone', async () => {
    const sdk = fakeSdk({ offers: [offer('tx-repeat', 'user-1'), offer('tx-2', 'user-2')] });

    await declineRemainingOffers(hire(sdk));

    expect(sdk.declined).toEqual([{ id: 'tx-2', transition: 'transition/decline-offer' }]);
  });

  it('keeps going when one offer refuses to close', async () => {
    const sdk = fakeSdk({
      offers: [offer('tx-2', 'user-2'), offer('tx-3', 'user-3')],
      declineFails: ['tx-2'],
    });

    const result = await declineRemainingOffers(hire(sdk));

    expect(result).toEqual({ declined: 1, failed: 1 });
    expect(sdk.declined).toEqual([{ id: 'tx-3', transition: 'transition/decline-offer' }]);
  });

  it('does nothing when the deal has no task', async () => {
    const sdk = fakeSdk({ offers: [] });

    const result = await declineRemainingOffers(hire(sdk, { listingId: null }));

    expect(result).toEqual({ declined: 0, failed: 0 });
    expect(sdk.transactions.query).not.toHaveBeenCalled();
  });
});
