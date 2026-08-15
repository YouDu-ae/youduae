import { listingCoverFallback, DEFAULT_LISTING_COVER } from './listingCover';

describe('listingCoverFallback', () => {
  it('всегда отдаёт логотип YouDu', () => {
    expect(listingCoverFallback()).toEqual(DEFAULT_LISTING_COVER);
    expect(listingCoverFallback({ attributes: { publicData: { category: 'Help_home' } } })).toEqual(
      DEFAULT_LISTING_COVER
    );
  });
});
