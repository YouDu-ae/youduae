import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { fetchCurrentUser } from '../../ducks/user.duck';
import { apiBaseUrl } from '../../util/api';
import { types as sdkTypes, createImageVariantConfig } from '../../util/sdkLoader';
import { PROFILE_PAGE_PENDING_APPROVAL_VARIANT } from '../../util/urlHelpers';
import { denormalisedResponseEntities } from '../../util/data';
import { storableError } from '../../util/errors';
import { hasPermissionToViewData, isUserAuthorized } from '../../util/userHelpers';

const { UUID } = sdkTypes;

// ================ Action types ================ //

export const SET_INITIAL_STATE = 'app/ProfilePage/SET_INITIAL_STATE';

export const SHOW_USER_REQUEST = 'app/ProfilePage/SHOW_USER_REQUEST';
export const SHOW_USER_SUCCESS = 'app/ProfilePage/SHOW_USER_SUCCESS';
export const SHOW_USER_ERROR = 'app/ProfilePage/SHOW_USER_ERROR';

export const QUERY_LISTINGS_REQUEST = 'app/ProfilePage/QUERY_LISTINGS_REQUEST';
export const QUERY_LISTINGS_SUCCESS = 'app/ProfilePage/QUERY_LISTINGS_SUCCESS';
export const QUERY_LISTINGS_ERROR = 'app/ProfilePage/QUERY_LISTINGS_ERROR';

export const QUERY_REVIEWS_REQUEST = 'app/ProfilePage/QUERY_REVIEWS_REQUEST';
export const QUERY_REVIEWS_SUCCESS = 'app/ProfilePage/QUERY_REVIEWS_SUCCESS';
export const QUERY_REVIEWS_ERROR = 'app/ProfilePage/QUERY_REVIEWS_ERROR';

export const QUERY_COMPLETED_WORKS_REQUEST = 'app/ProfilePage/QUERY_COMPLETED_WORKS_REQUEST';
export const QUERY_COMPLETED_WORKS_SUCCESS = 'app/ProfilePage/QUERY_COMPLETED_WORKS_SUCCESS';
export const QUERY_COMPLETED_WORKS_ERROR = 'app/ProfilePage/QUERY_COMPLETED_WORKS_ERROR';
export const COMPLETED_WORKS_SERVER_DATA_REUSED = 'app/ProfilePage/COMPLETED_WORKS_SERVER_DATA_REUSED';

// Медленный ответ на сервере задержал бы весь HTML профиля: дольше этого не
// ждём, и список подтянет браузер.
const SERVER_FETCH_TIMEOUT_MS = 5000;

// ================ Reducer ================ //

const initialState = {
  userId: null,
  userListingRefs: [],
  userShowError: null,
  queryListingsError: null,
  reviews: [],
  queryReviewsError: null,
  completedWorksUserId: null,
  completedWorks: [],
  completedWorksLoaded: false,
  completedWorksLoadedOnServer: false,
  queryCompletedWorksError: null,
};

export default function profilePageReducer(state = initialState, action = {}) {
  const { type, payload } = action;
  switch (type) {
    case SET_INITIAL_STATE:
      // Выполненные задания не сбрасываем: после серверного рендера loadData
      // запускается ещё раз и берёт их из уже полученных, не запрашивая заново.
      // Чужие задания не покажутся — страница сверяет completedWorksUserId
      // с открытым профилем.
      return {
        ...initialState,
        completedWorksUserId: state.completedWorksUserId,
        completedWorks: state.completedWorks,
        completedWorksLoaded: state.completedWorksLoaded,
        completedWorksLoadedOnServer: state.completedWorksLoadedOnServer,
      };
    case SHOW_USER_REQUEST:
      return { ...state, userShowError: null, userId: payload.userId };
    case SHOW_USER_SUCCESS:
      return state;
    case SHOW_USER_ERROR:
      return { ...state, userShowError: payload };

    case QUERY_LISTINGS_REQUEST:
      return {
        ...state,

        // Empty listings only when user id changes
        userListingRefs: payload.userId === state.userId ? state.userListingRefs : [],

        queryListingsError: null,
      };
    case QUERY_LISTINGS_SUCCESS:
      return { ...state, userListingRefs: payload.listingRefs };
    case QUERY_LISTINGS_ERROR:
      return { ...state, userListingRefs: [], queryListingsError: payload };
    case QUERY_REVIEWS_REQUEST:
      return { ...state, queryReviewsError: null };
    case QUERY_REVIEWS_SUCCESS:
      return { ...state, reviews: payload };
    case QUERY_REVIEWS_ERROR:
      return { ...state, reviews: [], queryReviewsError: payload };

    case QUERY_COMPLETED_WORKS_REQUEST: {
      const isSameUser = payload.userId === state.completedWorksUserId;
      return {
        ...state,
        completedWorksUserId: payload.userId,
        completedWorks: isSameUser ? state.completedWorks : [],
        completedWorksLoaded: isSameUser && state.completedWorksLoaded,
        completedWorksLoadedOnServer: false,
        queryCompletedWorksError: null,
      };
    }
    case QUERY_COMPLETED_WORKS_SUCCESS:
      if (payload.userId !== state.completedWorksUserId) {
        return state;
      }
      return {
        ...state,
        completedWorks: payload.completedWorks,
        completedWorksLoaded: true,
        completedWorksLoadedOnServer: payload.onServer,
      };
    case QUERY_COMPLETED_WORKS_ERROR:
      if (payload.userId !== state.completedWorksUserId) {
        return state;
      }
      return {
        ...state,
        completedWorks: [],
        completedWorksLoaded: false,
        queryCompletedWorksError: payload.error,
      };
    case COMPLETED_WORKS_SERVER_DATA_REUSED:
      return { ...state, completedWorksLoadedOnServer: false };

    default:
      return state;
  }
}

// ================ Action creators ================ //

export const setInitialState = () => ({
  type: SET_INITIAL_STATE,
});

export const showUserRequest = userId => ({
  type: SHOW_USER_REQUEST,
  payload: { userId },
});

export const showUserSuccess = () => ({
  type: SHOW_USER_SUCCESS,
});

export const showUserError = e => ({
  type: SHOW_USER_ERROR,
  error: true,
  payload: e,
});

export const queryListingsRequest = userId => ({
  type: QUERY_LISTINGS_REQUEST,
  payload: { userId },
});

export const queryListingsSuccess = listingRefs => ({
  type: QUERY_LISTINGS_SUCCESS,
  payload: { listingRefs },
});

export const queryListingsError = e => ({
  type: QUERY_LISTINGS_ERROR,
  error: true,
  payload: e,
});

export const queryReviewsRequest = () => ({
  type: QUERY_REVIEWS_REQUEST,
});

export const queryReviewsSuccess = reviews => ({
  type: QUERY_REVIEWS_SUCCESS,
  payload: reviews,
});

export const queryReviewsError = e => ({
  type: QUERY_REVIEWS_ERROR,
  error: true,
  payload: e,
});

export const queryCompletedWorksRequest = userId => ({
  type: QUERY_COMPLETED_WORKS_REQUEST,
  payload: { userId },
});

export const queryCompletedWorksSuccess = (userId, completedWorks, onServer) => ({
  type: QUERY_COMPLETED_WORKS_SUCCESS,
  payload: { userId, completedWorks, onServer },
});

export const queryCompletedWorksError = (userId, error) => ({
  type: QUERY_COMPLETED_WORKS_ERROR,
  error: true,
  payload: { userId, error },
});

export const completedWorksServerDataReused = () => ({
  type: COMPLETED_WORKS_SERVER_DATA_REUSED,
});

// ================ Thunks ================ //

export const queryUserListings = (userId, config, ownProfileOnly = false) => (
  dispatch,
  getState,
  sdk
) => {
  dispatch(queryListingsRequest(userId));

  const {
    aspectWidth = 1,
    aspectHeight = 1,
    variantPrefix = 'listing-card',
  } = config.layout.listingImage;
  const aspectRatio = aspectHeight / aspectWidth;

  const queryParams = {
    include: ['author', 'images'],
    'fields.image': [`variants.${variantPrefix}`, `variants.${variantPrefix}-2x`],
    ...createImageVariantConfig(`${variantPrefix}`, 400, aspectRatio),
    ...createImageVariantConfig(`${variantPrefix}-2x`, 800, aspectRatio),
  };

  const listingStates = ['published', 'closed'];

  // Add timestamp to prevent SDK caching
  const cacheBuster = Date.now();

  return sdk.listings
    .query({
      author_id: userId,
      states: listingStates,
      ...queryParams,
      // Force fresh data by adding metadata param
      meta_cacheBuster: cacheBuster,
    })
    .then(response => {
      const listings = response?.data?.data || [];
      
      const listingRefs = listings
        .filter(
          l =>
            !l.attributes.deleted &&
            l.attributes.state &&
            listingStates.includes(l.attributes.state)
        )
        .map(({ id, type }) => ({ id, type }));

      dispatch(addMarketplaceEntities(response));
      dispatch(queryListingsSuccess(listingRefs));
      return response;
    })
    .catch(e => dispatch(queryListingsError(storableError(e))));
};

export const queryUserReviews = userId => (dispatch, getState, sdk) => {
  return sdk.reviews
    .query({
      subject_id: userId,
      state: 'public',
      include: ['author', 'author.profileImage'],
      'fields.image': ['variants.square-small', 'variants.square-small2x'],
    })
    .then(response => {
      const reviews = denormalisedResponseEntities(response);
      dispatch(queryReviewsSuccess(reviews));
    })
    .catch(e => dispatch(queryReviewsError(e)));
};

/**
 * Выполненные задания грузятся вместе с профилем, в том числе на сервере:
 * иначе в HTML у каждого мастера «Выполненные задания (0)», и это читают
 * поисковики и AI-ассистенты, которые не выполняют JavaScript.
 */
export const queryCompletedWorks = (userId, config) => (dispatch, getState) => {
  const id = userId.uuid;
  const isServer = typeof window === 'undefined';
  const state = getState().ProfilePage;

  // Сразу после серверного рендера браузер вызывает loadData ещё раз: список уже
  // в разметке, а каждый запрос — несколько обращений к Integration API.
  if (!isServer && state.completedWorksLoadedOnServer && state.completedWorksUserId === id) {
    dispatch(completedWorksServerDataReused());
    return Promise.resolve();
  }

  dispatch(queryCompletedWorksRequest(id));

  // На сервере window недоступен, поэтому корень берём из конфигурации
  const baseUrl = isServer ? apiBaseUrl(config?.marketplaceRootURL) : apiBaseUrl();
  const signalMaybe = isServer ? { signal: AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS) } : {};

  return fetch(
    `${baseUrl}/api/user-completed-transactions?userId=${encodeURIComponent(id)}`,
    signalMaybe
  )
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load completed works: ${response.status}`);
      }
      return response.json();
    })
    .then(data => dispatch(queryCompletedWorksSuccess(id, data.completedWorks || [], isServer)))
    .catch(e => dispatch(queryCompletedWorksError(id, storableError(e))));
};

export const showUser = (userId, config) => (dispatch, getState, sdk) => {
  dispatch(showUserRequest(userId));
  return sdk.users
    .show({
      id: userId,
      include: ['profileImage'],
      'fields.image': [
        'variants.square-small',
        'variants.square-small2x',
        'variants.scaled-small',
        'variants.scaled-medium',
        'variants.scaled-large',
      ],
    })
    .then(response => {
      const userFields = config?.user?.userFields;
      const sanitizeConfig = { userFields };
      dispatch(addMarketplaceEntities(response, sanitizeConfig));
      dispatch(showUserSuccess());
      return response;
    })
    .catch(e => dispatch(showUserError(storableError(e))));
};

const isCurrentUser = (userId, cu) => userId?.uuid === cu?.id?.uuid;

export const loadData = (params, search, config) => (dispatch, getState, sdk) => {
  const userId = new UUID(params.id);
  const isPreviewForCurrentUser = params.variant === PROFILE_PAGE_PENDING_APPROVAL_VARIANT;
  const currentUser = getState()?.user?.currentUser;
  const fetchCurrentUserOptions = {
    updateHasListings: false,
    updateNotifications: false,
  };

  // Clear state so that previously loaded data is not visible
  // in case this page load fails.
  dispatch(setInitialState());

  if (isPreviewForCurrentUser) {
    return dispatch(fetchCurrentUser(fetchCurrentUserOptions)).then(() => {
      if (isCurrentUser(userId, currentUser) && isUserAuthorized(currentUser)) {
        // Scenario: 'active' user somehow tries to open a link for "variant" profile
        return Promise.all([
          dispatch(showUser(userId, config)),
          dispatch(queryUserListings(userId, config)),
          dispatch(queryUserReviews(userId)),
          dispatch(queryCompletedWorks(userId, config)),
        ]);
      } else if (isCurrentUser(userId, currentUser)) {
        // Handle a scenario, where user (in pending-approval state)
        // tries to see their own profile page.
        // => just set userId to state
        return dispatch(showUserRequest(userId));
      } else {
        return Promise.resolve({});
      }
    });
  }

  // Fetch data for plain profile page.
  // Note 1: returns 404s if user is not 'active'.
  // Note 2: In private marketplace mode, this page won't fetch data if the user is unauthorized
  const isAuthorized = currentUser && isUserAuthorized(currentUser);
  const isPrivateMarketplace = config.accessControl.marketplace.private === true;
  const hasNoViewingRights = currentUser && !hasPermissionToViewData(currentUser);
  const canFetchData = !isPrivateMarketplace || (isPrivateMarketplace && isAuthorized);
  // On a private marketplace, show active (approved) current user's own page
  // even if they don't have viewing rights
  const canFetchOwnProfileOnly =
    isPrivateMarketplace &&
    isAuthorized &&
    hasNoViewingRights &&
    isCurrentUser(userId, currentUser);

  if (!canFetchData) {
    return Promise.resolve();
  } else if (canFetchOwnProfileOnly) {
    return Promise.all([
      dispatch(fetchCurrentUser(fetchCurrentUserOptions)),
      dispatch(queryUserListings(userId, config, canFetchOwnProfileOnly)),
      dispatch(showUserRequest(userId)),
      dispatch(queryCompletedWorks(userId, config)),
    ]);
  }

  // Без прав на просмотр страница уводит на NoAccessPage, задания не понадобятся
  const canSeeProfile = !(isPrivateMarketplace && hasNoViewingRights);

  return Promise.all([
    dispatch(fetchCurrentUser(fetchCurrentUserOptions)),
    dispatch(showUser(userId, config)),
    dispatch(queryUserListings(userId, config)),
    dispatch(queryUserReviews(userId)),
    ...(canSeeProfile ? [dispatch(queryCompletedWorks(userId, config))] : []),
  ]);
};
