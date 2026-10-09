import React, { act } from 'react';
import '@testing-library/jest-dom';

import { types as sdkTypes } from '../../util/sdkLoader';
import {
  createCurrentUser,
  createListing,
  createReview,
  createUser,
  fakeIntl,
  fakeViewport,
} from '../../util/testData';
import {
  getHostedConfiguration,
  renderWithProviders as render,
  testingLibrary,
  createFakeDispatch,
  dispatchedActions,
} from '../../util/testHelpers';

import ProfilePage from './ProfilePage';

import {
  loadData,
  queryCompletedWorksRequest,
  queryCompletedWorksSuccess,
  queryListingsError,
  queryListingsRequest,
  queryListingsSuccess,
  queryReviewsError,
  queryReviewsSuccess,
  setInitialState,
  showUserError,
  showUserRequest,
  showUserSuccess,
} from './ProfilePage.duck';
import { currentUserShowRequest, currentUserShowSuccess } from '../../ducks/user.duck';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { authInfoRequest, authInfoSuccess } from '../../ducks/auth.duck';
import { storableError } from '../../util/errors';

const { UUID } = sdkTypes;

const { screen } = testingLibrary;

const attributes = {
  profile: {
    bio: 'I am a great cook!',
    publicData: {
      canCook: false,
      cuisine: 'italian',
      dietaryPreferences: ['vegan', 'gluten-free'],
      kitchenDescription: 'This is a kitchen description!',
      numberOfCookbooks: 10,
      userType: 'a',
      notShownInProfileAttribute: 'Do not show this in profile',
    },
  },
};

// Passing 'attributes' directly to createCurrentUser and createUser
// overrides the default attributes.profile values with the custom ones.
// This function first creates the default version and then appends extra attributes
// without overriding the defaults.
const createEnhancedUser = (userFn, id) => {
  const user = userFn(id);
  return {
    ...user,
    attributes: {
      ...user.attributes,
      profile: {
        ...user.attributes.profile,
        bio: attributes.profile.bio,
        publicData: attributes.profile.publicData,
      },
    },
  };
};

const userId = 'userId';

const getInitialState = () => {
  const currentUser = createEnhancedUser(createCurrentUser, userId);
  const user = createEnhancedUser(createUser, userId);
  const listing = createListing('l1');
  const review = createReview(
    'review-id',
    {
      createdAt: new Date(Date.UTC(2024, 2, 19, 11, 34)),
      content: 'Awesome!',
    },
    { author: createUser('reviewerA') }
  );
  return {
    ProfilePage: {
      userId: user.id,
      userListingRefs: [{ id: listing.id, type: 'listing' }],
      userShowError: null,
      queryListingsError: null,
      reviews: [review],
      queryReviewsError: null,
    },
    user: {
      currentUser,
      currentUserHasListings: false,
      sendVerificationEmailInProgress: false,
    },
    marketplaceData: {
      entities: {
        user: {
          userId: user,
        },
        listing: {
          l1: { ...listing, relationships: { author: user } },
        },
      },
    },
  };
};

describe('ProfilePage', () => {
  const config = getHostedConfiguration();

  const props = {
    scrollingDisabled: false,
    intl: fakeIntl,
    viewport: fakeViewport,
    params: {},
  };

  it('Check that user name and bio is shown correctly', async () => {
    await act(async () => {
      render(<ProfilePage {...props} />, {
        initialState: getInitialState(),
        config,
      });
    });
    expect(screen.getByText('ProfilePage.desktopHeading')).toBeInTheDocument();
    expect(screen.getByText('I am a great cook!')).toBeInTheDocument();
  });

  // YouDu takes user fields from configUser.js and ignores the ones in Console
  it('Check that custom user information is shown correctly', async () => {
    const initialState = getInitialState();
    const { userId: user } = initialState.marketplaceData.entities.user;
    user.attributes.profile.publicData = {
      ...user.attributes.profile.publicData,
      userType: 'customer',
      website: 'example.com',
    };

    let rendered = {};
    await act(async () => {
      rendered = render(<ProfilePage {...props} />, {
        initialState,
        config,
      });
    });
    const { getByRole, queryByRole } = rendered;

    // A specialist's website links out
    expect(getByRole('heading', { name: 'ProfileSettingsForm.socialWebsite' })).toBeInTheDocument();
    expect(getByRole('link', { name: 'example.com' })).toHaveAttribute(
      'href',
      'https://example.com'
    );

    // Fields defined only in Console are not shown
    expect(queryByRole('heading', { name: 'ProfilePage.detailsTitle' })).toBeNull();
    expect(screen.queryByText('Favorite cuisine')).toBeNull();
    expect(screen.queryByText('This is a kitchen description!')).toBeNull();
  });

  it('Check that listing information is shown correctly', async () => {
    await act(async () => {
      render(<ProfilePage {...props} />, {
        initialState: getInitialState(),
        config,
      });
    });

    expect(
      screen.getByRole('heading', { name: 'ProfilePage.openListingsTitle' })
    ).toBeInTheDocument();
    expect(screen.getByText('l1 title')).toBeInTheDocument();
    expect(screen.getByText('ListingCard.price')).toBeInTheDocument();
  });

  it('Check that review information is shown correctly', async () => {
    let rendered = {};
    await act(async () => {
      rendered = render(<ProfilePage {...props} />, {
        initialState: getInitialState(),
        config,
      });
    });
    const { getByRole } = rendered;

    expect(
      getByRole('heading', { name: 'ProfilePage.reviewsFromMyCustomersTitle' })
    ).toBeInTheDocument();

    expect(screen.getByText('Awesome!')).toBeInTheDocument();
    expect(screen.getByText('reviewerA display name')).toBeInTheDocument();
    expect(screen.getByText('March 2024')).toBeInTheDocument();
    expect(screen.getAllByTitle('3/5')).toHaveLength(2);
  });
});

describe('Duck', () => {
  const config = {
    ...getHostedConfiguration(),
    accessControl: { marketplace: { private: true } },
  };

  // Shared parameters for viewing rights loadData tests
  const fakeResponse = resource => ({ data: { data: resource, include: [] } });
  const sdkFn = response => jest.fn(() => Promise.resolve(response));
  const forbiddenError = new Error({ status: 403, message: 'forbidden' });
  const errorSdkFn = error => jest.fn(() => Promise.reject(error));

  const completedWorks = [{ transactionId: 'tx1', listingTitle: 'Fix the tap' }];
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ completedWorks }) })
    );
  });
  afterEach(() => {
    delete global.fetch;
  });

  it("loadData() for full viewing rights user loads someone else's profile", () => {
    const initialState = getInitialState();

    const { currentUser } = initialState.user;
    const { reviews, userListingRefs } = initialState.ProfilePage;
    const { l1: listing } = initialState.marketplaceData.entities.listing;
    const { userId: user } = initialState.marketplaceData.entities.user;

    const getState = () => ({
      ...initialState,
      auth: { isAuthenticated: true },
    });

    const sdk = {
      currentUser: { show: sdkFn(fakeResponse(currentUser)) },
      users: { show: sdkFn(fakeResponse(user)) },
      reviews: { query: sdkFn(fakeResponse(reviews)) },
      listings: { query: sdkFn(fakeResponse([listing])) },
      authInfo: sdkFn({}),
    };

    const dispatch = createFakeDispatch(getState, sdk);

    // This is now sanitizeConfig is parsed in the showUser thunk
    const userFields = config?.user?.userFields;
    const sanitizeConfig = { userFields };

    // Tests the actions that get dispatched to the Redux store when ProfilePage.duck.js
    // loadData() function is called. If you make customizations to the loadData() logic,
    // update the dispatched actions list in this test accordingly!
    return loadData({ id: userId }, null, config)(dispatch, getState, sdk).then(data => {
      expect(dispatchedActions(dispatch)).toEqual([
        setInitialState(),
        currentUserShowRequest(),
        showUserRequest(user.id, config),
        queryListingsRequest(user.id),
        queryCompletedWorksRequest(user.id.uuid),
        currentUserShowSuccess(currentUser),
        addMarketplaceEntities(fakeResponse(user), sanitizeConfig),
        showUserSuccess(),
        addMarketplaceEntities(fakeResponse([listing])),
        queryListingsSuccess(userListingRefs),
        queryReviewsSuccess(reviews),
        authInfoRequest(),
        authInfoSuccess({}),
        queryCompletedWorksSuccess(user.id.uuid, completedWorks, false),
      ]);
      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost/api/user-completed-transactions?userId=${user.id.uuid}`,
        {}
      );
    });
  });

  it("loadData() for restricted viewing rights user does not load someone else's profile", () => {
    const initialState = getInitialState();

    const { currentUser } = initialState.user;
    currentUser.effectivePermissionSet.attributes.read = 'permission/deny';

    const getState = () => ({
      ...initialState,
      user: {
        ...initialState.user,
        currentUser,
      },
      auth: { isAuthenticated: true },
    });

    const sdk = {
      currentUser: { show: sdkFn(fakeResponse(currentUser)) },
      users: { show: errorSdkFn(forbiddenError) },
      listings: { query: errorSdkFn(forbiddenError) },
      reviews: { query: errorSdkFn(forbiddenError) },
      authInfo: sdkFn({}),
    };

    const dispatch = createFakeDispatch(getState, sdk);
    const otherUserId = new UUID('otherUserId');

    // Tests the actions that get dispatched to the Redux store when ProfilePage.duck.js
    // loadData() function is called. If you make customizations to the loadData() logic,
    // update the dispatched actions list in this test accordingly!
    return loadData({ id: 'otherUserId' }, null, config)(dispatch, getState, sdk).then(data => {
      expect(dispatchedActions(dispatch)).toEqual([
        setInitialState(),
        currentUserShowRequest(),
        showUserRequest(otherUserId, config),
        queryListingsRequest(otherUserId),
        currentUserShowSuccess(currentUser),
        authInfoRequest(),
        showUserError(storableError(forbiddenError)),
        queryListingsError(storableError(forbiddenError)),
        queryReviewsError(forbiddenError),
        authInfoSuccess({}),
      ]);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  it('loadData() for restricted viewing rights user loads their own profile', () => {
    const initialState = getInitialState();

    const { currentUser } = initialState.user;
    const { userListingRefs } = initialState.ProfilePage;
    const { l1: listing } = initialState.marketplaceData.entities.listing;

    currentUser.effectivePermissionSet.attributes.read = 'permission/deny';

    const getState = () => ({
      ...initialState,
      user: {
        ...initialState.user,
        currentUser,
      },
      auth: { isAuthenticated: true },
    });

    const sdk = {
      currentUser: { show: sdkFn(fakeResponse(currentUser)) },
      ownListings: { query: sdkFn(fakeResponse([listing])) },
      authInfo: sdkFn({}),
    };

    const dispatch = createFakeDispatch(getState, sdk);

    // Tests the actions that get dispatched to the Redux store when ProfilePage.duck.js
    // loadData() function is called. If you make customizations to the loadData() logic,
    // update the dispatched actions list in this test accordingly!
    return loadData({ id: userId }, null, config)(dispatch, getState, sdk).then(data => {
      expect(dispatchedActions(dispatch)).toEqual([
        setInitialState(),
        currentUserShowRequest(),
        queryListingsRequest(currentUser.id),
        showUserRequest(currentUser.id),
        queryCompletedWorksRequest(currentUser.id.uuid),
        currentUserShowSuccess(currentUser),
        addMarketplaceEntities(fakeResponse([listing])),
        queryListingsSuccess(userListingRefs),
        authInfoRequest(),
        authInfoSuccess({}),
        queryCompletedWorksSuccess(currentUser.id.uuid, completedWorks, false),
      ]);
      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost/api/user-completed-transactions?userId=${currentUser.id.uuid}`,
        {}
      );
    });
  });
});
