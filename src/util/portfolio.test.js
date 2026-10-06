import { approvedPortfolioPhotos, isApprovedPortfolioPhoto } from './portfolio';

const photo = (n, status = 'pending') => ({
  imageId: `img-${n}`,
  imageUrl: `https://sharetribe.imgix.net/p${n}.jpg`,
  status,
});

const approval = item => ({ imageId: item.imageId, imageUrl: item.imageUrl });

const profileWith = (portfolio, approved = []) => ({
  publicData: { portfolio },
  metadata: { approvedPortfolio: approved },
});

describe('approvedPortfolioPhotos', () => {
  it('shows the approved photos in the order the specialist chose, each once', () => {
    const profile = profileWith(
      [photo(3), photo(1), photo(2), photo(3)],
      [approval(photo(1)), approval(photo(3))]
    );

    expect(approvedPortfolioPhotos(profile)).toEqual([approval(photo(3)), approval(photo(1))]);
  });

  it('ignores a status the specialist set in their own data', () => {
    expect(approvedPortfolioPhotos(profileWith([photo(1, 'approved')]))).toEqual([]);
  });

  it('shows the approved address and hides photos the specialist removed', () => {
    const swapped = { ...photo(1), imageUrl: 'https://sharetribe.imgix.net/other.jpg' };

    expect(
      approvedPortfolioPhotos(profileWith([swapped], [approval(photo(1)), approval(photo(2))]))
    ).toEqual([approval(photo(1))]);
  });

  it('skips photos kept outside Sharetribe and copes with missing data', () => {
    const outside = { imageId: 'img-4', imageUrl: 'https://example.com/4.jpg' };

    expect(approvedPortfolioPhotos(profileWith([outside], [outside]))).toEqual([]);
    expect(approvedPortfolioPhotos(undefined)).toEqual([]);
    expect(approvedPortfolioPhotos({ publicData: { portfolio: [photo(1)] } })).toEqual([]);
  });
});

describe('isApprovedPortfolioPhoto', () => {
  it('tells approved photos from the rest', () => {
    const profile = profileWith([photo(1), photo(2)], [approval(photo(1))]);

    expect(isApprovedPortfolioPhoto(profile, photo(1))).toBe(true);
    expect(isApprovedPortfolioPhoto(profile, photo(2, 'approved'))).toBe(false);
    expect(isApprovedPortfolioPhoto(profile, null)).toBe(false);
  });
});
