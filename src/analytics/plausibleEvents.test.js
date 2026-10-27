import {
  trackKycStarted,
  trackListingView,
  trackOfferSubmitted,
  trackProviderSelected,
} from './plausibleEvents';

describe('Plausible events', () => {
  beforeEach(() => {
    window.plausible = jest.fn();
  });

  afterEach(() => {
    delete window.plausible;
  });

  it('describes a task without its title or address', () => {
    const listing = {
      id: { uuid: 'listing-1' },
      attributes: {
        title: 'Повесить полки у Ивана',
        state: 'published',
        price: { amount: 15000, currency: 'AED' },
        publicData: {
          category: 'repair',
          location: { address: 'Marina Gate 1, кв. 12', city: 'Dubai' },
        },
      },
    };

    trackListingView(listing, { viewerRole: 'customer', viewerId: 'user-1' });

    expect(window.plausible).toHaveBeenCalledWith('listing_view', {
      props: {
        listingId: 'listing-1',
        category: 'repair',
        status: 'published',
        city: 'Dubai',
        priceAmount: 15000,
        priceCurrency: 'AED',
        viewerRole: 'customer',
      },
    });
  });

  it('leaves out the ids of the people involved', () => {
    trackOfferSubmitted({ listingId: 'listing-1', userId: 'user-1', priceAmount: 5000 });
    trackProviderSelected({ listingId: 'listing-1', transactionId: 'tx-1', providerId: 'user-2' });
    trackKycStarted({ userId: 'user-1', documentType: 'passport' });

    const sent = window.plausible.mock.calls.map(([, options]) => options.props);
    expect(sent[0]).toEqual({ listingId: 'listing-1', priceAmount: 5000 });
    expect(sent[1]).toEqual({ listingId: 'listing-1', transactionId: 'tx-1' });
    expect(sent[2]).toEqual({ documentType: 'passport' });
  });
});
