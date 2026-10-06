import reducer, {
  updateProfileSuccess,
  uploadPortfolioImageSuccess,
} from './ProfileSettingsPage.duck';

const upload = (state, imageId) =>
  reducer(
    state,
    uploadPortfolioImageSuccess({
      tempId: `portfolio_${imageId}`,
      imageId,
      imageUrl: `https://sharetribe.imgix.net/${imageId}.jpg`,
    })
  );

const savedProfile = portfolio => ({
  data: {
    data: {
      id: { uuid: 'user-1' },
      type: 'currentUser',
      attributes: { profile: { publicData: { portfolio } } },
    },
  },
});

describe('ProfileSettingsPage reducer', () => {
  it('forgets new portfolio photos once the profile holds them', () => {
    const withUploads = upload(upload(reducer(undefined, {}), 'img-1'), 'img-2');

    const state = reducer(
      withUploads,
      updateProfileSuccess(
        savedProfile([
          { imageId: 'img-0', status: 'approved' },
          { imageId: 'img-1', status: 'pending' },
        ])
      )
    );

    expect(state.portfolioImages.map(img => img.imageId)).toEqual(['img-2']);
  });

  it('keeps new photos when the saved profile has no portfolio', () => {
    const withUpload = upload(reducer(undefined, {}), 'img-1');

    const state = reducer(withUpload, updateProfileSuccess(savedProfile(undefined)));

    expect(state.portfolioImages.map(img => img.imageId)).toEqual(['img-1']);
  });
});
