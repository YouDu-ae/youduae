const mockUpdate = jest.fn();
const mockClose = jest.fn();
const mockShow = jest.fn();
const mockOpen = jest.fn();
const mockRecordExecutorChange = jest.fn();
const mockAnnounce = jest.fn();

jest.mock('../api-util/sdk', () => ({
  getSdk: () => ({
    ownListings: { update: mockUpdate, close: mockClose, show: mockShow, open: mockOpen },
  }),
  handleError: (res, e) => res.status(e?.status || 500).end(),
  serialize: value => JSON.stringify(value),
  typeHandlers: [],
}));

jest.mock('../db', () => ({
  recordExecutorChange: (...args) => mockRecordExecutorChange(...args),
}));

jest.mock('../api-util/notifyListingPublished', () => ({
  notifyExecutorsAboutReopenedListing: (...args) => mockAnnounce(...args),
}));

// The record and the announcement run after the answer has gone out.
const afterAnswer = () => new Promise(resolve => setImmediate(resolve));

const { UUID } = require('sharetribe-flex-sdk').types;
const updateListingStatus = require('./update-listing-status');

const call = body =>
  new Promise(resolve => {
    const res = {};
    res.status = jest.fn(() => res);
    res.set = jest.fn(() => res);
    res.send = jest.fn(() => res);
    res.json = jest.fn(() => res);
    res.end = jest.fn(() => resolve(res));
    updateListingStatus({ body, headers: {} }, res);
  });

const listingIn = state => ({ status: 200, data: { data: { attributes: { state } } } });

beforeEach(() => {
  mockRecordExecutorChange.mockReset().mockResolvedValue(true);
  mockAnnounce.mockReset().mockResolvedValue({ sent: 3, total: 3 });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('update-listing-status: cancelling', () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockClose.mockReset().mockResolvedValue({ status: 200, data: {} });
  });

  it('neither records a change of executor nor announces the task', async () => {
    mockUpdate.mockResolvedValue(listingIn('published'));
    await call({ listingId: 'l-1', status: 'cancelled' });
    await afterAnswer();

    expect(mockRecordExecutorChange).not.toHaveBeenCalled();
    expect(mockAnnounce).not.toHaveBeenCalled();
  });

  it('marks a published task cancelled and closes it', async () => {
    mockUpdate.mockResolvedValue(listingIn('published'));
    await call({ listingId: 'l-1', status: 'cancelled' });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ publicData: expect.objectContaining({ status: 'cancelled', cancelled: true }) }),
      { expand: true }
    );
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  // Sharetribe closes only published listings; a task waiting for moderation
  // is already hidden from specialists.
  it('only marks a task that is still waiting for moderation', async () => {
    mockUpdate.mockResolvedValue(listingIn('pendingApproval'));
    const res = await call({ listingId: 'l-2', status: 'cancelled' });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockClose).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('update-listing-status: reopening for another executor', () => {
  beforeEach(() => {
    mockShow.mockReset().mockResolvedValue({
      data: {
        data: {
          attributes: {
            publicData: {
              assignedTo: 'user-2',
              transactionId: 'tx-2',
              excludedOfferCustomerIds: ['user-1'],
            },
          },
          relationships: { author: { data: { id: { uuid: 'author-1' } } } },
        },
      },
    });
    mockUpdate.mockReset().mockResolvedValue(listingIn('closed'));
    mockOpen.mockReset().mockResolvedValue({ status: 200, data: {} });
  });

  it('keeps a record of who was taken off the task', async () => {
    await call({ listingId: 'l-3', status: 'open', removedCustomerId: 'user-2' });
    await afterAnswer();

    expect(mockRecordExecutorChange).toHaveBeenCalledWith({
      listingId: 'l-3',
      removedUserId: 'user-2',
      authorId: 'author-1',
      transactionId: 'tx-2',
    });
  });

  it('tells executors the task is looking for someone again, except those removed and the author', async () => {
    await call({ listingId: 'l-3', status: 'open', removedCustomerId: 'user-2' });
    await afterAnswer();

    expect(mockAnnounce).toHaveBeenCalledWith('l-3', {
      excludeUserIds: ['user-1', 'user-2', 'author-1'],
    });
  });

  it('does not announce the task again for a retried request', async () => {
    mockRecordExecutorChange.mockResolvedValue(false);

    await call({ listingId: 'l-3', status: 'open', removedCustomerId: 'user-2' });
    await afterAnswer();

    expect(mockAnnounce).not.toHaveBeenCalled();
  });

  it('still reopens and announces the task when the record cannot be written', async () => {
    mockRecordExecutorChange.mockRejectedValue(new Error('database down'));

    const res = await call({ listingId: 'l-3', status: 'open', removedCustomerId: 'user-2' });
    await afterAnswer();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockAnnounce).toHaveBeenCalledTimes(1);
  });

  it('answers before the announcement has gone out', async () => {
    mockAnnounce.mockReturnValue(new Promise(() => {}));

    const res = await call({ listingId: 'l-3', status: 'open', removedCustomerId: 'user-2' });

    expect(res.status).toHaveBeenCalledWith(200);
  });

  // The SDK can put only its own UUID type or a plain string into a GET query.
  it('reads the task with an id the SDK can send', async () => {
    await call({ listingId: 'l-3', status: 'open', removedCustomerId: 'user-2' });

    const { id } = mockShow.mock.calls[0][0];
    expect(id).toBeInstanceOf(UUID);
    expect(id.uuid).toBe('l-3');
  });

  it('keeps specialists removed earlier out of the offers', async () => {
    await call({ listingId: 'l-3', status: 'open', removedCustomerId: 'user-2' });

    expect(mockUpdate.mock.calls[0][0].publicData.excludedOfferCustomerIds).toEqual([
      'user-1',
      'user-2',
    ]);
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it('reports a failed update instead of repeating it without the earlier exclusions', async () => {
    mockUpdate.mockReset().mockRejectedValue({ status: 500 });
    const res = await call({ listingId: 'l-3', status: 'open', removedCustomerId: 'user-2' });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockOpen).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('neither records nor announces a reopening that failed', async () => {
    mockOpen.mockReset().mockRejectedValue({ status: 409 });

    await call({ listingId: 'l-3', status: 'open', removedCustomerId: 'user-2' });
    await afterAnswer();

    expect(mockRecordExecutorChange).not.toHaveBeenCalled();
    expect(mockAnnounce).not.toHaveBeenCalled();
  });
});
