const mockNotify = jest.fn();
const mockDb = {
  getBlockedUserIds: jest.fn(),
  claimReminder: jest.fn(),
  releaseReminder: jest.fn(),
};
let mockSdk;

jest.mock('../db', () => mockDb);
jest.mock('../api/telegram-bot', () => ({
  notifyUnansweredOffers: (...args) => mockNotify(...args),
}));
jest.mock('./context', () => ({
  ...jest.requireActual('./context'),
  createIntegrationSdk: () => mockSdk,
  sleep: async () => {},
}));

const { runUnansweredOffers } = require('./unansweredOffers');

const AUTHOR = 'author-1';
const MASTER = 'master-1';
const BLOCKED = 'master-2';

const offer = (id, listingId, specialistId) => ({
  id: { uuid: id },
  type: 'transaction',
  relationships: {
    listing: { data: { id: { uuid: listingId } } },
    provider: { data: { id: { uuid: AUTHOR } } },
    customer: { data: { id: { uuid: specialistId } } },
  },
});

const listing = (id, title) => ({
  id: { uuid: id },
  type: 'listing',
  attributes: { title, state: 'published', publicData: {} },
});

const sdkWith = transactions => ({
  transactions: {
    query: jest.fn(async () => ({
      data: {
        data: transactions,
        included: [
          listing('task-a', 'Покрасить стены'),
          listing('task-b', 'Собрать шкаф'),
          { id: { uuid: AUTHOR }, type: 'user', attributes: {} },
        ],
        meta: { totalPages: 1 },
      },
    })),
  },
});

const run = () => runUnansweredOffers({ log: () => {} });

describe('runUnansweredOffers', () => {
  beforeEach(() => {
    mockNotify.mockReset().mockResolvedValue(true);
    mockDb.getBlockedUserIds.mockReset().mockResolvedValue([BLOCKED]);
    mockDb.claimReminder.mockReset().mockResolvedValue(true);
    mockDb.releaseReminder.mockReset().mockResolvedValue();
  });

  it('leaves out offers from specialists the author blocked', async () => {
    mockSdk = sdkWith([
      offer('tx-1', 'task-a', MASTER),
      offer('tx-2', 'task-a', BLOCKED),
      offer('tx-3', 'task-b', BLOCKED),
    ]);
    const result = await run();

    expect(mockSdk.transactions.query).toHaveBeenCalledWith(
      expect.objectContaining({ include: expect.arrayContaining(['customer']) })
    );
    expect(mockDb.getBlockedUserIds).toHaveBeenCalledTimes(1);
    expect(mockDb.getBlockedUserIds).toHaveBeenCalledWith(AUTHOR);
    expect(mockNotify).toHaveBeenCalledWith(AUTHOR, {
      tasks: [
        { title: 'Покрасить стены', offerCount: 1, url: expect.stringContaining('/l/task-a') },
      ],
    });
    expect(result).toMatchObject({ tasks: 1, sent: 1 });
  });

  it('sends nothing when every waiting offer comes from a blocked specialist', async () => {
    mockSdk = sdkWith([offer('tx-2', 'task-a', BLOCKED)]);
    const result = await run();

    expect(mockDb.claimReminder).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
    expect(result).toMatchObject({ candidates: 0, sent: 0 });
  });

  it('counts every offer when the author blocked nobody', async () => {
    mockDb.getBlockedUserIds.mockResolvedValue([]);
    mockSdk = sdkWith([offer('tx-1', 'task-a', MASTER), offer('tx-2', 'task-a', BLOCKED)]);
    await run();

    expect(mockNotify).toHaveBeenCalledWith(AUTHOR, {
      tasks: [expect.objectContaining({ title: 'Покрасить стены', offerCount: 2 })],
    });
  });
});
