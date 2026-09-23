const mockOwnListingsShow = jest.fn();
const mockNotifyExecutorsAboutListing = jest.fn();

jest.mock('../api-util/sdk', () => ({
  getSdk: () => ({ ownListings: { show: (...args) => mockOwnListingsShow(...args) } }),
}));

jest.mock('../api-util/notifyListingPublished', () => ({
  notifyExecutorsAboutListing: (...args) => mockNotifyExecutorsAboutListing(...args),
}));

const notifyNewListing = require('./notify-new-listing');

const call = async body => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.end = jest.fn(() => res);
  await notifyNewListing({ body }, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

const sdkError = status => Object.assign(new Error(`status ${status}`), { status });

describe('POST /api/notify-new-listing', () => {
  beforeEach(() => {
    mockOwnListingsShow.mockReset();
    mockNotifyExecutorsAboutListing.mockReset();
    mockNotifyExecutorsAboutListing.mockResolvedValue({});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Moderation is on for the marketplace, so this is the common case: the public
  // listings endpoint answered 404 here and the admin never heard of the task.
  it('queues the notifier for a task still in moderation', async () => {
    mockOwnListingsShow.mockResolvedValue({
      data: { data: { attributes: { state: 'pendingApproval' } } },
    });

    const { status } = await call({ listingId: 'listing-1' });

    expect(status).toBe(202);
    expect(mockNotifyExecutorsAboutListing).toHaveBeenCalledWith('listing-1');
  });

  it('refuses a listing that belongs to someone else', async () => {
    mockOwnListingsShow.mockRejectedValue(sdkError(404));

    const { status } = await call({ listingId: 'listing-2' });

    expect(status).toBe(403);
    expect(mockNotifyExecutorsAboutListing).not.toHaveBeenCalled();
  });

  it('refuses a visitor without a session', async () => {
    mockOwnListingsShow.mockRejectedValue(sdkError(401));
    const { status } = await call({ listingId: 'listing-1' });
    expect(status).toBe(401);
  });

  it('asks for the listing id', async () => {
    const { status } = await call({});
    expect(status).toBe(400);
  });
});
