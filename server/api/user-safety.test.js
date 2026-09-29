const mockDb = {
  createUserReport: jest.fn(),
  setUserBlocked: jest.fn(),
  getBlockedUserIds: jest.fn(),
};
const mockAlert = jest.fn();

jest.mock('../db', () => mockDb);
jest.mock('./telegram-bot', () => ({ notifyAdminUserReport: (...args) => mockAlert(...args) }));

const { reportUser, setBlock } = require('./user-safety');

const ME = '6913d262-48d2-44fb-a02a-7dbd8de0e4dc';
const OTHER = '6ab3061e-9d17-48fc-bba9-27a6052a1518';

const call = async (handler, body) => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  await handler({ body, authUserId: ME }, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

describe('reporting a user', () => {
  beforeEach(() => {
    Object.values(mockDb).forEach(fn => fn.mockReset());
    mockAlert.mockReset().mockResolvedValue(true);
    mockDb.createUserReport.mockResolvedValue(7);
  });

  it('stores the report and alerts the admin', async () => {
    const result = await call(reportUser, { reportedUserId: OTHER, reason: 'abuse', comment: '  грубит  ' });

    expect(result.status).toBe(201);
    expect(mockDb.createUserReport).toHaveBeenCalledWith({
      reporterId: ME,
      reportedId: OTHER,
      reason: 'abuse',
      comment: 'грубит',
      transactionId: null,
    });
    expect(mockAlert).toHaveBeenCalledWith(expect.objectContaining({ reportId: 7, reportedId: OTHER }));
  });

  it('keeps the report when the Telegram alert fails', async () => {
    mockAlert.mockRejectedValue(new Error('Telegram down'));
    const result = await call(reportUser, { reportedUserId: OTHER, reason: 'spam' });
    expect(result.status).toBe(201);
    expect(mockDb.createUserReport).toHaveBeenCalled();
  });

  it('refuses unknown reasons, bad ids and reporting oneself', async () => {
    expect((await call(reportUser, { reportedUserId: OTHER, reason: 'dislike' })).status).toBe(400);
    expect((await call(reportUser, { reportedUserId: 'nope', reason: 'spam' })).status).toBe(400);
    expect((await call(reportUser, { reportedUserId: ME, reason: 'spam' })).status).toBe(400);
    expect(mockDb.createUserReport).not.toHaveBeenCalled();
  });
});

describe('blocking a user', () => {
  beforeEach(() => Object.values(mockDb).forEach(fn => fn.mockReset()));

  it('blocks and unblocks, answering with the current list', async () => {
    mockDb.getBlockedUserIds.mockResolvedValueOnce([OTHER]).mockResolvedValueOnce([]);

    expect((await call(setBlock, { userId: OTHER, blocked: true })).body).toEqual({
      blockedUserIds: [OTHER],
    });
    expect(mockDb.setUserBlocked).toHaveBeenLastCalledWith(ME, OTHER, true);

    expect((await call(setBlock, { userId: OTHER, blocked: false })).body).toEqual({
      blockedUserIds: [],
    });
    expect(mockDb.setUserBlocked).toHaveBeenLastCalledWith(ME, OTHER, false);
  });

  it('does not let anyone block themselves', async () => {
    expect((await call(setBlock, { userId: ME, blocked: true })).status).toBe(400);
  });
});
