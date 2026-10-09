const mockDb = {
  hideConversation: jest.fn(),
  unhideConversation: jest.fn(),
  getHiddenConversations: jest.fn(),
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

const { getHidden, hide, unhide, getUnread } = require('./conversations');

const ME = '6913d262-48d2-44fb-a02a-7dbd8de0e4dc';
const OTHER = '6ab3061e-9d17-48fc-bba9-27a6052a1518';
const STRANGER = '68f0c9d1-2b4a-4c5e-9f3a-1d2e3f4a5b6c';
const TX = '6ac8db4b-1111-4222-8333-944455556666';
const HIDDEN = { [TX]: 1760000000000 };

const call = async (handler, body) => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  await handler({ body, authUserId: ME }, res);
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

  it("lists the signed-in user's hidden conversations", async () => {
    const result = await call(getHidden);

    expect(mockDb.getHiddenConversations).toHaveBeenCalledWith(ME);
    expect(result).toEqual({ status: 200, body: { hiddenConversations: HIDDEN } });
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

  it('answers with the count the icon badge shows, and which conversations make it', async () => {
    mockUnread.mockResolvedValue([TX]);

    const result = await call(getUnread);

    expect(mockUnread).toHaveBeenCalledWith(ME);
    expect(result).toEqual({ status: 200, body: { unreadCount: 1, unreadTransactionIds: [TX] } });
  });

  it('answers 500 when the count cannot be made', async () => {
    mockUnread.mockRejectedValue(new Error('Integration API down'));

    expect((await call(getUnread)).status).toBe(500);
  });
});
