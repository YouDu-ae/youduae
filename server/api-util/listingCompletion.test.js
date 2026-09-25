const { markListingCompleted, listingIdFromTransaction } = require('./listingCompletion');

const sdkWith = publicData => ({
  listings: {
    show: jest.fn(async () => ({ data: { data: { attributes: { publicData } } } })),
    update: jest.fn(async () => ({})),
  },
});

describe('markListingCompleted', () => {
  it('writes only the status, leaving the rest of publicData alone', async () => {
    const sdk = sdkWith({ status: 'in-progress', hired: true, categoryLevel1: 'repairs_main' });
    expect(await markListingCompleted(sdk, 'listing-1')).toBe('marked');
    expect(sdk.listings.update).toHaveBeenCalledWith({
      id: 'listing-1',
      publicData: { status: 'completed' },
    });
  });

  it('does nothing when the task is already marked', async () => {
    const sdk = sdkWith({ status: 'completed' });
    expect(await markListingCompleted(sdk, 'listing-1')).toBe('already');
    expect(sdk.listings.update).not.toHaveBeenCalled();
  });

  it('never turns a cancelled task into a completed one', async () => {
    const sdk = sdkWith({ status: 'cancelled', cancelled: true });
    expect(await markListingCompleted(sdk, 'listing-1')).toBe('cancelled');
    expect(sdk.listings.update).not.toHaveBeenCalled();
  });

  it('skips a deal whose listing is unknown', async () => {
    const sdk = sdkWith({});
    expect(await markListingCompleted(sdk, null)).toBe('missing');
    expect(sdk.listings.show).not.toHaveBeenCalled();
  });

  it('skips a task that has since been deleted', async () => {
    const sdk = sdkWith({});
    sdk.listings.show.mockRejectedValue({ status: 404 });
    expect(await markListingCompleted(sdk, 'gone')).toBe('missing');
    expect(sdk.listings.update).not.toHaveBeenCalled();
  });
});

describe('listingIdFromTransaction', () => {
  it('reads SDK UUIDs and plain ids alike', () => {
    expect(
      listingIdFromTransaction({ relationships: { listing: { data: { id: { uuid: 'l-1' } } } } })
    ).toBe('l-1');
    expect(listingIdFromTransaction({ relationships: { listing: { data: { id: 'l-2' } } } })).toBe(
      'l-2'
    );
    expect(listingIdFromTransaction({})).toBeNull();
  });
});
