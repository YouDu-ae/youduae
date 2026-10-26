const mockDb = {
  getReceivedMessages: jest.fn(),
  getHiddenConversations: jest.fn(),
  getDeletedConversations: jest.fn(),
};
const mockUserShow = jest.fn();
let mockSdk;

jest.mock('../db', () => mockDb);
jest.mock('../reminders/context', () => ({ createIntegrationSdk: () => mockSdk }));

const { getUnreadConversations } = require('./unreadConversations');

const USER = 'user-1';
const T0 = Date.parse('2026-10-09T10:00:00Z');
const CHAT = 'transition/accept-offer';

const received = (
  transactionId,
  receivedAt,
  lastTransition = CHAT,
  senderId = `from-${transactionId}`
) => ({
  transactionId,
  senderId,
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
    mockDb.getDeletedConversations.mockReset().mockResolvedValue({});
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

    expect(unread.transactionIds).toEqual(['tx-new', 'tx-never-opened']);
  });

  it('counts a person once however many of their deals are unread', async () => {
    mockDb.getReceivedMessages.mockResolvedValue([
      received('tx-1', T0, CHAT, 'master-1'),
      received('tx-2', T0, CHAT, 'master-1'),
      received('tx-3', T0, CHAT, 'master-1'),
      received('tx-4', T0, CHAT, 'master-2'),
    ]);

    const unread = await getUnreadConversations(USER, { viewedTransactions: {} });

    expect(unread).toMatchObject({
      transactionIds: ['tx-1', 'tx-2', 'tx-3', 'tx-4'],
      counterpartyIds: ['master-1', 'master-2'],
    });
  });

  it('pairs each unread deal with its writer and the time of their newest message', async () => {
    mockDb.getReceivedMessages.mockResolvedValue([
      received('tx-1', T0 + 1000, CHAT, 'master-1'),
      received('tx-read', T0 - 1000, CHAT, 'master-2'),
    ]);

    const unread = await getUnreadConversations(USER, { viewedTransactions: { 'tx-read': T0 } });

    expect(unread.conversations).toEqual([
      { transactionId: 'tx-1', counterpartyId: 'master-1', lastMessageAt: T0 + 1000 },
    ]);
    expect(unread.viewedTransactions).toEqual({ 'tx-read': T0 });
  });

  it('leaves out messages up to when the history with their sender was deleted', async () => {
    mockDb.getReceivedMessages.mockResolvedValue([
      received('tx-deleted', T0, CHAT, 'master-1'),
      received('tx-after', T0 + 1000, CHAT, 'master-1'),
      received('tx-other', T0 - 1000, CHAT, 'master-2'),
    ]);
    mockDb.getDeletedConversations.mockResolvedValue({ 'master-1': T0 });

    const unread = await getUnreadConversations(USER, { viewedTransactions: {} });

    expect(mockDb.getDeletedConversations).toHaveBeenCalledWith(USER);
    expect(unread).toMatchObject({
      transactionIds: ['tx-after', 'tx-other'],
      counterpartyIds: ['master-1', 'master-2'],
    });
  });

  it('leaves out a conversation hidden after its last message', async () => {
    mockDb.getReceivedMessages.mockResolvedValue([
      received('tx-hidden', T0),
      received('tx-back', T0 + 1000),
    ]);
    mockDb.getHiddenConversations.mockResolvedValue({ 'tx-hidden': T0 + 500, 'tx-back': T0 });

    const unread = await getUnreadConversations(USER, { viewedTransactions: {} });

    expect(unread.transactionIds).toEqual(['tx-back']);
  });

  it('leaves out deals at a step where the app shows no chat', async () => {
    mockDb.getReceivedMessages.mockResolvedValue([
      received('tx-offer', T0, 'transition/inquire'),
      received('tx-declined', T0, 'transition/decline-offer'),
      received('tx-done', T0, 'transition/complete'),
      received('tx-reviewed', T0, 'transition/review-2-by-provider'),
    ]);

    const unread = await getUnreadConversations(USER, { viewedTransactions: {} });

    expect(unread.transactionIds).toEqual(['tx-done', 'tx-reviewed']);
  });

  it('reads the marks from the profile unless they were just saved', async () => {
    mockDb.getReceivedMessages.mockResolvedValue([received('tx-1', T0)]);
    mockUserShow.mockResolvedValue(privateData({ 'tx-1': T0 + 1 }));

    const fromProfile = await getUnreadConversations(USER);
    expect(fromProfile.transactionIds).toEqual([]);
    expect(fromProfile.viewedTransactions).toEqual({ 'tx-1': T0 + 1 });
    expect(mockUserShow).toHaveBeenCalledWith({ id: USER });

    mockUserShow.mockClear();
    const unread = await getUnreadConversations(USER, { viewedTransactions: {} });
    expect(unread.transactionIds).toEqual(['tx-1']);
    expect(mockUserShow).not.toHaveBeenCalled();
  });

  it('refuses to guess without the Integration API', async () => {
    mockSdk = null;
    mockDb.getReceivedMessages.mockResolvedValue([received('tx-1', T0)]);

    await expect(getUnreadConversations(USER)).rejects.toThrow('Integration API');
  });
});
