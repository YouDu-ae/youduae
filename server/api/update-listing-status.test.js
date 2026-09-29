const mockUpdate = jest.fn();
const mockClose = jest.fn();

jest.mock('../api-util/sdk', () => ({
  getSdk: () => ({ ownListings: { update: mockUpdate, close: mockClose, show: jest.fn(), open: jest.fn() } }),
  handleError: (res, e) => res.status(e?.status || 500).end(),
  serialize: value => JSON.stringify(value),
  typeHandlers: [],
}));

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

describe('update-listing-status: cancelling', () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockClose.mockReset().mockResolvedValue({ status: 200, data: {} });
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
