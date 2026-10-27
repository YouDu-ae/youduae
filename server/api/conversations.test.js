const mockDb = {
  hideConversation: jest.fn(),
  unhideConversation: jest.fn(),
  getHiddenConversations: jest.fn(),
  deleteConversationHistory: jest.fn(),
  getDeletedConversations: jest.fn(),
};
const mockShow = jest.fn();
const mockUnread = jest.fn();
const mockBadgeUpdate = jest.fn();

jest.mock('../db', () => mockDb);
jest.mock('../reminders/context', () => ({
  createIntegrationSdk: () => ({ transactions: { show: (...args) => mockShow(...args) } }),
}));
jest.mock('../api-util/unreadConversations', () => ({
  getUnreadConversations: (...args) => mockUnread(...args),
}));
jest.mock('./send-notification', () => ({
  sendBadgeUpdate: (...args) => mockBadgeUpdate(...args),
}));
jest.mock('../api-util/mobileSdk', () => ({
  hasBearerToken: req => (req.headers.authorization || '').startsWith('Bearer '),
}));

const {
  getHidden,
  hide,
  unhide,
  getDeleted,
  deleteHistory,
  getUnread,
} = require('./conversations');

const ME = '6913d262-48d2-44fb-a02a-7dbd8de0e4dc';
const OTHER = '6ab3061e-9d17-48fc-bba9-27a6052a1518';
const STRANGER = '68f0c9d1-2b4a-4c5e-9f3a-1d2e3f4a5b6c';
const TX = '6ac8db4b-1111-4222-8333-944455556666';
const TX_2 = '6ac8db4b-2222-4222-8333-944455556666';
const HIDDEN = { [TX]: 1760000000000 };
const DELETED = { [OTHER]: 1760000000000 };
const FROM_APP = { authorization: 'Bearer app-token' };

const call = async (handler, body, headers = {}) => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  await handler({ body, authUserId: ME, headers }, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

const deal = (customerId, providerId) => ({
  data: {
    data: {
      relationships: {
        customer: { data: { id: { uuid: customerId } } },
        provider: { data: { id: { uuid: providerId } } },
      },
    },
  },
});

describe('hidden conversations', () => {
  beforeEach(() => {
    Object.values(mockDb).forEach(fn => fn.mockReset());
    mockShow.mockReset();
    mockUnread.mockReset();
    mockBadgeUpdate.mockReset();
    mockDb.getHiddenConversations.mockResolvedValue(HIDDEN);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("hides one's own conversation and answers with the current list", async () => {
    mockShow.mockResolvedValue(deal(OTHER, ME));

    const result = await call(hide, { transactionId: TX });

    expect(mockShow).toHaveBeenCalledWith({ id: TX, include: ['customer', 'provider'] });
    expect(mockDb.hideConversation).toHaveBeenCalledWith(ME, TX);
    expect(mockBadgeUpdate).toHaveBeenCalledWith(ME);
    expect(result).toEqual({ status: 200, body: { hiddenConversations: HIDDEN } });
  });

  it('refuses to hide a conversation between other people', async () => {
    mockShow.mockResolvedValue(deal(OTHER, STRANGER));

    const result = await call(hide, { transactionId: TX });

    expect(result.status).toBe(404);
    expect(mockDb.hideConversation).not.toHaveBeenCalled();
    expect(mockBadgeUpdate).not.toHaveBeenCalled();
  });

  it('answers 404 for a conversation Sharetribe does not know', async () => {
    mockShow.mockRejectedValue(Object.assign(new Error('Not found'), { status: 404 }));

    expect((await call(hide, { transactionId: TX })).status).toBe(404);
    expect(mockDb.hideConversation).not.toHaveBeenCalled();
  });

  it('answers 500 when Sharetribe cannot be reached', async () => {
    mockShow.mockRejectedValue(Object.assign(new Error('Bad gateway'), { status: 502 }));

    expect((await call(hide, { transactionId: TX })).status).toBe(500);
    expect(mockDb.hideConversation).not.toHaveBeenCalled();
  });

  it('refuses a missing or malformed transaction id', async () => {
    expect((await call(hide, {})).status).toBe(400);
    expect((await call(hide, { transactionId: 'tx-1' })).status).toBe(400);
    expect((await call(unhide, { transactionId: "'; DROP TABLE x" })).status).toBe(400);
    expect(mockShow).not.toHaveBeenCalled();
    expect(mockDb.hideConversation).not.toHaveBeenCalled();
    expect(mockDb.unhideConversation).not.toHaveBeenCalled();
  });

  it('shows a conversation again without asking Sharetribe', async () => {
    mockDb.getHiddenConversations.mockResolvedValue({});

    const result = await call(unhide, { transactionId: TX });

    expect(mockDb.unhideConversation).toHaveBeenCalledWith(ME, TX);
    expect(mockShow).not.toHaveBeenCalled();
    expect(mockBadgeUpdate).toHaveBeenCalledWith(ME);
    expect(result).toEqual({ status: 200, body: { hiddenConversations: {} } });
  });

  // The open app sets its own icon; a badge-only push would reach it as an
  // empty alert.
  it('leaves the phones alone when the app hides or shows a conversation', async () => {
    mockShow.mockResolvedValue(deal(OTHER, ME));

    expect((await call(hide, { transactionId: TX }, FROM_APP)).status).toBe(200);
    expect((await call(unhide, { transactionId: TX }, FROM_APP)).status).toBe(200);

    expect(mockDb.hideConversation).toHaveBeenCalledWith(ME, TX);
    expect(mockDb.unhideConversation).toHaveBeenCalledWith(ME, TX);
    expect(mockBadgeUpdate).not.toHaveBeenCalled();
  });

  it("lists the signed-in user's hidden conversations", async () => {
    const result = await call(getHidden);

    expect(mockDb.getHiddenConversations).toHaveBeenCalledWith(ME);
    expect(result).toEqual({ status: 200, body: { hiddenConversations: HIDDEN } });
  });
});

describe('deleted conversations', () => {
  const NOW = Date.parse('2026-10-26T18:00:00.000Z');

  beforeEach(() => {
    Object.values(mockDb).forEach(fn => fn.mockReset());
    mockShow.mockReset();
    mockBadgeUpdate.mockReset();
    mockDb.getDeletedConversations.mockResolvedValue(DELETED);
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    Date.now.mockRestore();
    console.error.mockRestore();
  });

  it('deletes the history with the other party of the deal up to the newest message seen', async () => {
    mockShow.mockResolvedValue(deal(OTHER, ME));

    const result = await call(deleteHistory, {
      counterpartyId: OTHER,
      transactionId: TX,
      until: '2026-10-26T17:59:00.000Z',
    });

    expect(mockShow).toHaveBeenCalledWith({ id: TX, include: ['customer', 'provider'] });
    expect(mockDb.deleteConversationHistory).toHaveBeenCalledWith(
      ME,
      OTHER,
      new Date('2026-10-26T17:59:00.000Z')
    );
    expect(mockBadgeUpdate).toHaveBeenCalledWith(ME);
    expect(result).toEqual({ status: 200, body: { deletedConversations: DELETED } });
  });

  it('deletes up to now without a time, and never past it', async () => {
    mockShow.mockResolvedValue(deal(ME, OTHER));

    await call(deleteHistory, { counterpartyId: OTHER, transactionId: TX });
    await call(deleteHistory, {
      counterpartyId: OTHER,
      transactionId: TX,
      until: '2027-01-01T00:00:00.000Z',
    });

    expect(mockDb.deleteConversationHistory.mock.calls).toEqual([
      [ME, OTHER, new Date(NOW)],
      [ME, OTHER, new Date(NOW)],
    ]);
  });

  it('leaves the phones alone when the app deletes the history', async () => {
    mockShow.mockResolvedValue(deal(OTHER, ME));

    const result = await call(
      deleteHistory,
      { counterpartyId: OTHER, transactionId: TX },
      FROM_APP
    );

    expect(result.status).toBe(200);
    expect(mockDb.deleteConversationHistory).toHaveBeenCalled();
    expect(mockBadgeUpdate).not.toHaveBeenCalled();
  });

  it('refuses someone who is not the other party of that deal', async () => {
    mockShow.mockResolvedValue(deal(STRANGER, ME));
    expect(
      (await call(deleteHistory, { counterpartyId: OTHER, transactionId: TX })).status
    ).toBe(404);

    mockShow.mockResolvedValue(deal(OTHER, STRANGER));
    expect(
      (await call(deleteHistory, { counterpartyId: OTHER, transactionId: TX })).status
    ).toBe(404);

    mockShow.mockResolvedValue(deal(OTHER, ME));
    expect((await call(deleteHistory, { counterpartyId: ME, transactionId: TX })).status).toBe(
      404
    );

    expect(mockDb.deleteConversationHistory).not.toHaveBeenCalled();
    expect(mockBadgeUpdate).not.toHaveBeenCalled();
  });

  it('refuses malformed ids and times without asking Sharetribe', async () => {
    expect((await call(deleteHistory, { transactionId: TX })).status).toBe(400);
    expect((await call(deleteHistory, { counterpartyId: OTHER })).status).toBe(400);
    expect(
      (await call(deleteHistory, { counterpartyId: 'user-1', transactionId: TX })).status
    ).toBe(400);
    expect(
      (await call(deleteHistory, { counterpartyId: OTHER, transactionId: TX, until: 'вчера' }))
        .status
    ).toBe(400);
    expect(mockShow).not.toHaveBeenCalled();
    expect(mockDb.deleteConversationHistory).not.toHaveBeenCalled();
  });

  it('answers 500 when Sharetribe cannot be reached', async () => {
    mockShow.mockRejectedValue(Object.assign(new Error('Bad gateway'), { status: 502 }));

    expect(
      (await call(deleteHistory, { counterpartyId: OTHER, transactionId: TX })).status
    ).toBe(500);
    expect(mockDb.deleteConversationHistory).not.toHaveBeenCalled();
  });

  it("lists the signed-in user's deleted conversations", async () => {
    const result = await call(getDeleted);

    expect(mockDb.getDeletedConversations).toHaveBeenCalledWith(ME);
    expect(result).toEqual({ status: 200, body: { deletedConversations: DELETED } });
  });
});

describe('unread conversations', () => {
  beforeEach(() => {
    mockUnread.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it('answers with the count the icon badge shows: people, not deals', async () => {
    const conversations = [
      { transactionId: TX, counterpartyId: OTHER, lastMessageAt: 1000 },
      { transactionId: TX_2, counterpartyId: OTHER, lastMessageAt: 2000 },
    ];
    mockUnread.mockResolvedValue({
      transactionIds: [TX, TX_2],
      counterpartyIds: [OTHER],
      conversations,
      viewedTransactions: { [TX]: 500 },
    });

    const result = await call(getUnread);

    expect(mockUnread).toHaveBeenCalledWith(ME);
    expect(result).toEqual({
      status: 200,
      body: {
        unreadCount: 1,
        unreadCounterpartyIds: [OTHER],
        unreadTransactionIds: [TX, TX_2],
        unreadConversations: conversations,
        viewedTransactions: { [TX]: 500 },
      },
    });
  });

  it('answers 500 when the count cannot be made', async () => {
    mockUnread.mockRejectedValue(new Error('Integration API down'));

    expect((await call(getUnread)).status).toBe(500);
  });
});
