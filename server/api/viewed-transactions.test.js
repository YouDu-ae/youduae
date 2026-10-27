const mockShow = jest.fn();
const mockUpdateProfile = jest.fn();

jest.mock('sharetribe-flex-integration-sdk', () => ({
  createInstance: () => ({
    users: {
      show: (...args) => mockShow(...args),
      updateProfile: (...args) => mockUpdateProfile(...args),
    },
  }),
}));

jest.mock('../db', () => ({ getLastIncomingMessageTimes: jest.fn() }));
jest.mock('./send-notification', () => ({ sendBadgeUpdate: jest.fn(async () => ({})) }));
jest.mock('../api-util/mobileSdk', () => ({
  hasBearerToken: req => (req.headers.authorization || '').startsWith('Bearer '),
}));

const { sendBadgeUpdate } = require('./send-notification');
const { markTransactionViewed, markTransactionsBatchViewed } = require('./viewed-transactions');

const USER_ID = '6a7c8e37-0000-4000-8000-000000000001';

const showResponse = viewedTransactions => ({
  data: { data: { attributes: { profile: { privateData: { viewedTransactions } } } } },
});

const conflict = () => Object.assign(new Error('Conflict'), { status: 409 });

const FROM_APP = { authorization: 'Bearer app-token' };

const call = (handler, body, headers = {}) => {
  const res = { status: jest.fn(() => res), json: jest.fn(() => res) };
  return handler({ authUserId: USER_ID, body, headers }, res).then(() => res);
};

const savedMap = callIndex => mockUpdateProfile.mock.calls[callIndex][0].privateData.viewedTransactions;

describe('viewed-transactions', () => {
  beforeEach(() => {
    process.env.INTEGRATION_API_CLIENT_ID = 'id';
    process.env.INTEGRATION_API_CLIENT_SECRET = 'secret';
    mockShow.mockReset();
    mockUpdateProfile.mockReset();
    sendBadgeUpdate.mockClear();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it('keeps the other marks and adds this one', async () => {
    mockShow.mockResolvedValue(showResponse({ 'tx-old': Date.now() }));
    mockUpdateProfile.mockResolvedValue({});

    const res = await call(markTransactionViewed, { transactionId: 'tx-new' });

    expect(res.status).not.toHaveBeenCalled();
    expect(Object.keys(savedMap(0)).sort()).toEqual(['tx-new', 'tx-old']);
  });

  it('updates the icon badge from the marks it just saved', async () => {
    mockShow.mockResolvedValue(showResponse({}));
    mockUpdateProfile.mockResolvedValue({});

    await call(markTransactionViewed, { transactionId: 'tx-new' });

    expect(sendBadgeUpdate).toHaveBeenCalledWith(USER_ID, { viewedTransactions: savedMap(0) });
  });

  // The open app sets its own icon; a badge-only push would reach it as an
  // empty alert.
  it('leaves the phones alone when the mark comes from the app', async () => {
    mockShow.mockResolvedValue(showResponse({}));
    mockUpdateProfile.mockResolvedValue({});

    await call(markTransactionViewed, { transactionId: 'tx-new' }, FROM_APP);
    await call(markTransactionsBatchViewed, { transactionIds: ['tx-a'] }, FROM_APP);

    expect(mockUpdateProfile).toHaveBeenCalledTimes(2);
    expect(sendBadgeUpdate).not.toHaveBeenCalled();
  });

  it('leaves the badge alone when the mark was not saved', async () => {
    mockShow.mockResolvedValue(showResponse({}));
    mockUpdateProfile.mockRejectedValue(Object.assign(new Error('Bad'), { status: 400 }));

    await call(markTransactionViewed, { transactionId: 'tx-new' });

    expect(sendBadgeUpdate).not.toHaveBeenCalled();
  });

  it('starts over from a fresh read when an overlapping mark wins', async () => {
    mockShow
      .mockResolvedValueOnce(showResponse({}))
      .mockResolvedValueOnce(showResponse({ 'tx-other': Date.now() }));
    mockUpdateProfile.mockRejectedValueOnce(conflict()).mockResolvedValueOnce({});

    const res = await call(markTransactionViewed, { transactionId: 'tx-new' });

    expect(res.status).not.toHaveBeenCalled();
    expect(mockShow).toHaveBeenCalledTimes(2);
    expect(Object.keys(savedMap(1)).sort()).toEqual(['tx-new', 'tx-other']);
  });

  it('gives up with 500 after repeated conflicts', async () => {
    mockShow.mockResolvedValue(showResponse({}));
    mockUpdateProfile.mockRejectedValue(conflict());

    const res = await call(markTransactionViewed, { transactionId: 'tx-new' });

    expect(mockUpdateProfile).toHaveBeenCalledTimes(3);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('does not retry other errors', async () => {
    mockShow.mockResolvedValue(showResponse({}));
    mockUpdateProfile.mockRejectedValue(Object.assign(new Error('Bad'), { status: 400 }));

    const res = await call(markTransactionViewed, { transactionId: 'tx-new' });

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('marks a batch and drops marks older than 90 days', async () => {
    const longAgo = Date.now() - 91 * 24 * 60 * 60 * 1000;
    mockShow.mockResolvedValue(showResponse({ 'tx-stale': longAgo }));
    mockUpdateProfile.mockResolvedValue({});

    const res = await call(markTransactionsBatchViewed, { transactionIds: ['tx-a', 'tx-b'] });

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ count: 2 }));
    expect(Object.keys(savedMap(0)).sort()).toEqual(['tx-a', 'tx-b']);
    expect(sendBadgeUpdate).toHaveBeenCalledWith(USER_ID, { viewedTransactions: savedMap(0) });
  });

  describe('up to what the person saw', () => {
    const DAY = 24 * 60 * 60 * 1000;

    beforeEach(() => {
      mockUpdateProfile.mockResolvedValue({});
    });

    it('leaves a message that came in after the shown ones unread', async () => {
      mockShow.mockResolvedValue(showResponse({}));
      const seen = Date.now() - 30 * 1000;

      const res = await call(markTransactionViewed, {
        transactionId: 'tx-open',
        seenUntil: new Date(seen).toISOString(),
      });

      expect(savedMap(0)['tx-open']).toBe(seen);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ viewedAt: seen }));
    });

    it('never moves a mark back', async () => {
      const later = Date.now() - 1000;
      mockShow.mockResolvedValue(showResponse({ 'tx-open': later }));

      await call(markTransactionViewed, { transactionId: 'tx-open', seenUntil: later - 60 * 1000 });

      expect(savedMap(0)['tx-open']).toBe(later);
    });

    it('takes no mark from the future', async () => {
      mockShow.mockResolvedValue(showResponse({}));
      const before = Date.now();

      await call(markTransactionViewed, { transactionId: 'tx-open', seenUntil: before + DAY });

      expect(savedMap(0)['tx-open']).toBeGreaterThanOrEqual(before);
      expect(savedMap(0)['tx-open']).toBeLessThanOrEqual(Date.now());
    });

    it('keeps the mark of a long quiet chat clear of the cleanup', async () => {
      mockShow.mockResolvedValue(showResponse({}));
      const before = Date.now();

      await call(markTransactionViewed, {
        transactionId: 'tx-quiet',
        seenUntil: before - 200 * DAY,
      });

      expect(savedMap(0)['tx-quiet']).toBeGreaterThanOrEqual(before - 89 * DAY);
      expect(savedMap(0)['tx-quiet']).toBeLessThan(before - 88 * DAY);
    });

    it('refuses a seenUntil that is not a time', async () => {
      const res = await call(markTransactionViewed, {
        transactionId: 'tx-open',
        seenUntil: 'soon',
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockUpdateProfile).not.toHaveBeenCalled();
    });

    it('marks each deal of a batch up to its own time, and the rest now', async () => {
      mockShow.mockResolvedValue(showResponse({}));
      const before = Date.now();
      const seenA = before - 5 * 60 * 1000;

      await call(markTransactionsBatchViewed, {
        transactionIds: ['tx-a', 'tx-b'],
        seenUntil: { 'tx-a': new Date(seenA).toISOString() },
      });

      expect(savedMap(0)['tx-a']).toBe(seenA);
      expect(savedMap(0)['tx-b']).toBeGreaterThanOrEqual(before);
    });

    it('refuses a batch whose times are not times', async () => {
      for (const seenUntil of [['tx-a'], { 'tx-a': 'soon' }]) {
        const res = await call(markTransactionsBatchViewed, {
          transactionIds: ['tx-a'],
          seenUntil,
        });
        expect(res.status).toHaveBeenCalledWith(400);
      }
      expect(mockUpdateProfile).not.toHaveBeenCalled();
    });
  });
});
