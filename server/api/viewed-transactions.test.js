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

const { markTransactionViewed, markTransactionsBatchViewed } = require('./viewed-transactions');

const USER_ID = '6a7c8e37-0000-4000-8000-000000000001';

const showResponse = viewedTransactions => ({
  data: { data: { attributes: { profile: { privateData: { viewedTransactions } } } } },
});

const conflict = () => Object.assign(new Error('Conflict'), { status: 409 });

const call = (handler, body) => {
  const res = { status: jest.fn(() => res), json: jest.fn(() => res) };
  return handler({ authUserId: USER_ID, body }, res).then(() => res);
};

const savedMap = callIndex => mockUpdateProfile.mock.calls[callIndex][0].privateData.viewedTransactions;

describe('viewed-transactions', () => {
  beforeEach(() => {
    process.env.INTEGRATION_API_CLIENT_ID = 'id';
    process.env.INTEGRATION_API_CLIENT_SECRET = 'secret';
    mockShow.mockReset();
    mockUpdateProfile.mockReset();
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
  });
});
