const mockDb = {
  getReceivedMessages: jest.fn(),
  getHiddenConversations: jest.fn(),
};
const mockUserShow = jest.fn();
let mockSdk;

jest.mock('../db', () => mockDb);
jest.mock('../reminders/context', () => ({ createIntegrationSdk: () => mockSdk }));

const { getUnreadConversations } = require('./unreadConversations');

const USER = 'user-1';
const T0 = Date.parse('2026-10-09T10:00:00Z');
const CHAT = 'transition/accept-offer';

const received = (transactionId, receivedAt, lastTransition = CHAT) => ({
  transactionId,
  receivedAt,
  lastTransition,
});

const privateData = viewedTransactions => ({
  data: { data: { attributes: { profile: { privateData: { viewedTransactions } } } } },
});

describe('getUnreadConversations', () => {
  beforeEach(() => {
    mockDb.getReceivedMessages.mockReset();
    mockDb.getHiddenConversations.mockReset().mockResolvedValue({});
    mockUserShow.mockReset();
    mockSdk = { users: { show: (...args) => mockUserShow(...args) } };
  });

  it('counts a conversation the other party wrote in after it was last opened', async () => {
    mockDb.getReceivedMessages.mockResolvedValue([
      received('tx-new', T0 + 1000),
      received('tx-read', T0 - 1000),
      received('tx-never-opened', T0 - 5000),
    ]);

    const unread = await getUnreadConversations(USER, {
      viewedTransactions: { 'tx-new': T0, 'tx-read': T0 },
    });

    expect(unread).toEqual(['tx-new', 'tx-never-opened']);
  });

  it('leaves out a conversation hidden after its last message', async () => {
    mockDb.getReceivedMessages.mockResolvedValue([
      received('tx-hidden', T0),
      received('tx-back', T0 + 1000),
    ]);
    mockDb.getHiddenConversations.mockResolvedValue({ 'tx-hidden': T0 + 500, 'tx-back': T0 });

    const unread = await getUnreadConversations(USER, { viewedTransactions: {} });

    expect(unread).toEqual(['tx-back']);
  });

  it('leaves out deals at a step where the app shows no chat', async () => {
    mockDb.getReceivedMessages.mockResolvedValue([
      received('tx-offer', T0, 'transition/inquire'),
      received('tx-declined', T0, 'transition/decline-offer'),
      received('tx-done', T0, 'transition/complete'),
      received('tx-reviewed', T0, 'transition/review-2-by-provider'),
    ]);

    const unread = await getUnreadConversations(USER, { viewedTransactions: {} });

    expect(unread).toEqual(['tx-done', 'tx-reviewed']);
  });

  it('reads the marks from the profile unless they were just saved', async () => {
    mockDb.getReceivedMessages.mockResolvedValue([received('tx-1', T0)]);
    mockUserShow.mockResolvedValue(privateData({ 'tx-1': T0 + 1 }));

    expect(await getUnreadConversations(USER)).toEqual([]);
    expect(mockUserShow).toHaveBeenCalledWith({ id: USER });

    mockUserShow.mockClear();
    expect(await getUnreadConversations(USER, { viewedTransactions: {} })).toEqual(['tx-1']);
    expect(mockUserShow).not.toHaveBeenCalled();
  });

  it('refuses to guess without the Integration API', async () => {
    mockSdk = null;
    mockDb.getReceivedMessages.mockResolvedValue([received('tx-1', T0)]);

    await expect(getUnreadConversations(USER)).rejects.toThrow('Integration API');
  });
});
