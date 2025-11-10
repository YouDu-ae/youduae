import { types as sdkTypes, createImageVariantConfig } from '../../util/sdkLoader';
import { storableError } from '../../util/errors';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { trackListingCreated } from '../../analytics/plausibleEvents';

const requestAction = actionType => params => ({ type: actionType, payload: { params } });

const successAction = actionType => result => ({ type: actionType, payload: result.data });

const errorAction = actionType => error => ({ type: actionType, payload: error, error: true });

// ================ Action types ================ //

export const CREATE_LISTING_DRAFT_REQUEST = 'app/PostFromDraftPage/CREATE_LISTING_DRAFT_REQUEST';
export const CREATE_LISTING_DRAFT_SUCCESS = 'app/PostFromDraftPage/CREATE_LISTING_DRAFT_SUCCESS';
export const CREATE_LISTING_DRAFT_ERROR = 'app/PostFromDraftPage/CREATE_LISTING_DRAFT_ERROR';

export const PUBLISH_LISTING_REQUEST = 'app/PostFromDraftPage/PUBLISH_LISTING_REQUEST';
export const PUBLISH_LISTING_SUCCESS = 'app/PostFromDraftPage/PUBLISH_LISTING_SUCCESS';
export const PUBLISH_LISTING_ERROR = 'app/PostFromDraftPage/PUBLISH_LISTING_ERROR';

export const UPDATE_LISTING_REQUEST = 'app/PostFromDraftPage/UPDATE_LISTING_REQUEST';
export const UPDATE_LISTING_SUCCESS = 'app/PostFromDraftPage/UPDATE_LISTING_SUCCESS';
export const UPDATE_LISTING_ERROR = 'app/PostFromDraftPage/UPDATE_LISTING_ERROR';

export const UPLOAD_IMAGE_REQUEST = 'app/PostFromDraftPage/UPLOAD_IMAGE_REQUEST';
export const UPLOAD_IMAGE_SUCCESS = 'app/PostFromDraftPage/UPLOAD_IMAGE_SUCCESS';
export const UPLOAD_IMAGE_ERROR = 'app/PostFromDraftPage/UPLOAD_IMAGE_ERROR';

// ================ Reducer ================ //

const initialState = {
  createListingDraftInProgress: false,
  createListingDraftError: null,
  publishListingInProgress: false,
  publishListingError: null,
  updateListingInProgress: false,
  updateListingError: null,
  uploadImageInProgress: false,
  uploadImageError: null,
};

export default function reducer(state = initialState, action = {}) {
  const { type, payload } = action;
  switch (type) {
    case CREATE_LISTING_DRAFT_REQUEST:
      return { ...state, createListingDraftInProgress: true, createListingDraftError: null };
    case CREATE_LISTING_DRAFT_SUCCESS:
      return { ...state, createListingDraftInProgress: false };
    case CREATE_LISTING_DRAFT_ERROR:
      return { ...state, createListingDraftInProgress: false, createListingDraftError: payload };

    case PUBLISH_LISTING_REQUEST:
      return { ...state, publishListingInProgress: true, publishListingError: null };
    case PUBLISH_LISTING_SUCCESS:
      return { ...state, publishListingInProgress: false };
    case PUBLISH_LISTING_ERROR:
      return { ...state, publishListingInProgress: false, publishListingError: payload };

    case UPDATE_LISTING_REQUEST:
      return { ...state, updateListingInProgress: true, updateListingError: null };
    case UPDATE_LISTING_SUCCESS:
      return { ...state, updateListingInProgress: false };
    case UPDATE_LISTING_ERROR:
      return { ...state, updateListingInProgress: false, updateListingError: payload };

    case UPLOAD_IMAGE_REQUEST:
      return { ...state, uploadImageInProgress: true, uploadImageError: null };
    case UPLOAD_IMAGE_SUCCESS:
      return { ...state, uploadImageInProgress: false };
    case UPLOAD_IMAGE_ERROR:
      return { ...state, uploadImageInProgress: false, uploadImageError: payload };

    default:
      return state;
  }
}

// ================ Action creators ================ //

export const createListingDraftRequest = requestAction(CREATE_LISTING_DRAFT_REQUEST);
export const createListingDraftSuccess = successAction(CREATE_LISTING_DRAFT_SUCCESS);
export const createListingDraftError = errorAction(CREATE_LISTING_DRAFT_ERROR);

export const publishListingRequest = requestAction(PUBLISH_LISTING_REQUEST);
export const publishListingSuccess = successAction(PUBLISH_LISTING_SUCCESS);
export const publishListingError = errorAction(PUBLISH_LISTING_ERROR);

export const updateListingRequest = requestAction(UPDATE_LISTING_REQUEST);
export const updateListingSuccess = successAction(UPDATE_LISTING_SUCCESS);
export const updateListingError = errorAction(UPDATE_LISTING_ERROR);

export const uploadImageRequest = requestAction(UPLOAD_IMAGE_REQUEST);
export const uploadImageSuccess = successAction(UPLOAD_IMAGE_SUCCESS);
export const uploadImageError = errorAction(UPLOAD_IMAGE_ERROR);

// ================ Thunks ================ //

export const createListingDraft = params => (dispatch, getState, sdk) => {
  dispatch(createListingDraftRequest(params));

  return sdk.ownListings
    .create(params)
    .then(response => {
      dispatch(addMarketplaceEntities(response));
      dispatch(createListingDraftSuccess(response));
      trackListingCreated(response?.data?.data, { stage: 'draft' });
      return response;
    })
    .catch(e => {
      dispatch(createListingDraftError(storableError(e)));
      throw e;
    });
};

export const publishListingDraft = params => (dispatch, getState, sdk) => {
  dispatch(publishListingRequest(params));

  console.log('📤 Publishing draft listing:', params.id);

  return sdk.ownListings
    .publishDraft({ id: params.id }, { expand: true, include: ['author', 'images'] })
    .then(response => {
      console.log('✅ Listing published successfully');
      dispatch(addMarketplaceEntities(response));
      dispatch(publishListingSuccess(response));
      trackListingCreated(response?.data?.data, { stage: 'published' });
      return response;
    })
    .catch(e => {
      console.error('❌ Failed to publish draft:', e);
      dispatch(publishListingError(storableError(e)));
      throw e;
    });
};

export const updateListingDraft = params => (dispatch, getState, sdk) => {
  dispatch(updateListingRequest(params));

  const { id, imageId, published } = params;

  return sdk.ownListings
    .addImage({ id, imageId }, { expand: true, include: ['images'] })
    .then(response => {
      dispatch(addMarketplaceEntities(response));
      dispatch(updateListingSuccess(response));
      return response;
    })
    .catch(e => {
      dispatch(updateListingError(storableError(e)));
      throw e;
    });
};

export const uploadImage = params => (dispatch, getState, sdk) => {
  dispatch(uploadImageRequest(params));

  const { image } = params;

  return sdk.images
    .upload({ image })
    .then(response => {
      dispatch(uploadImageSuccess(response));
      return response;
    })
    .catch(e => {
      dispatch(uploadImageError(storableError(e)));
      throw e;
    });
};

// ================ Page data loader ================ //

export const loadData = (params, search) => dispatch => {
  // This page doesn't need to load data on server-side
  return Promise.resolve();
};

