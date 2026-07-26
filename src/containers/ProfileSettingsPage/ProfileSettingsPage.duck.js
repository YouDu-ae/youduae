import { denormalisedResponseEntities } from '../../util/data';
import { storableError } from '../../util/errors';
import { currentUserShowSuccess } from '../../ducks/user.duck';

// ================ Action types ================ //

export const CLEAR_UPDATED_FORM = 'app/ProfileSettingsPage/CLEAR_UPDATED_FORM';

export const UPLOAD_IMAGE_REQUEST = 'app/ProfileSettingsPage/UPLOAD_IMAGE_REQUEST';
export const UPLOAD_IMAGE_SUCCESS = 'app/ProfileSettingsPage/UPLOAD_IMAGE_SUCCESS';
export const UPLOAD_IMAGE_ERROR = 'app/ProfileSettingsPage/UPLOAD_IMAGE_ERROR';

export const UPLOAD_PORTFOLIO_IMAGE_REQUEST = 'app/ProfileSettingsPage/UPLOAD_PORTFOLIO_IMAGE_REQUEST';
export const UPLOAD_PORTFOLIO_IMAGE_SUCCESS = 'app/ProfileSettingsPage/UPLOAD_PORTFOLIO_IMAGE_SUCCESS';
export const UPLOAD_PORTFOLIO_IMAGE_ERROR = 'app/ProfileSettingsPage/UPLOAD_PORTFOLIO_IMAGE_ERROR';
export const REMOVE_PORTFOLIO_IMAGE = 'app/ProfileSettingsPage/REMOVE_PORTFOLIO_IMAGE';

export const UPDATE_PROFILE_REQUEST = 'app/ProfileSettingsPage/UPDATE_PROFILE_REQUEST';
export const UPDATE_PROFILE_SUCCESS = 'app/ProfileSettingsPage/UPDATE_PROFILE_SUCCESS';
export const UPDATE_PROFILE_ERROR = 'app/ProfileSettingsPage/UPDATE_PROFILE_ERROR';

// ================ Reducer ================ //

const initialState = {
  image: null,
  uploadImageError: null,
  uploadInProgress: false,
  updateInProgress: false,
  updateProfileError: null,
  portfolioImages: [],
  portfolioUploadInProgress: false,
  portfolioUploadError: null,
};

export default function reducer(state = initialState, action = {}) {
  const { type, payload } = action;
  switch (type) {
    case UPLOAD_IMAGE_REQUEST:
      // payload.params: { id: 'tempId', file }
      return {
        ...state,
        image: { ...payload.params },
        uploadInProgress: true,
        uploadImageError: null,
      };
    case UPLOAD_IMAGE_SUCCESS: {
      // payload: { id: 'tempId', uploadedImage }
      const { id, uploadedImage } = payload;
      const { file } = state.image || {};
      const image = { id, imageId: uploadedImage.id, file, uploadedImage };
      return { ...state, image, uploadInProgress: false };
    }
    case UPLOAD_IMAGE_ERROR: {
      // eslint-disable-next-line no-console
      return { ...state, image: null, uploadInProgress: false, uploadImageError: payload.error };
    }

    case UPDATE_PROFILE_REQUEST:
      return {
        ...state,
        updateInProgress: true,
        updateProfileError: null,
      };
    case UPDATE_PROFILE_SUCCESS:
      return {
        ...state,
        image: null,
        updateInProgress: false,
      };
    case UPDATE_PROFILE_ERROR:
      return {
        ...state,
        image: null,
        updateInProgress: false,
        updateProfileError: payload,
      };

    case CLEAR_UPDATED_FORM:
      return { ...state, updateProfileError: null, uploadImageError: null, portfolioUploadError: null };

    case UPLOAD_PORTFOLIO_IMAGE_REQUEST:
      return {
        ...state,
        portfolioUploadInProgress: true,
        portfolioUploadError: null,
      };
    case UPLOAD_PORTFOLIO_IMAGE_SUCCESS: {
      const { tempId, imageId, imageUrl } = payload;
      const newImage = { tempId, imageId, imageUrl, status: 'pending' };
      return {
        ...state,
        portfolioImages: [...state.portfolioImages, newImage],
        portfolioUploadInProgress: false,
      };
    }
    case UPLOAD_PORTFOLIO_IMAGE_ERROR:
      return {
        ...state,
        portfolioUploadInProgress: false,
        portfolioUploadError: payload.error,
      };
    case REMOVE_PORTFOLIO_IMAGE: {
      const { imageId } = payload;
      return {
        ...state,
        portfolioImages: state.portfolioImages.filter(img => img.imageId !== imageId),
      };
    }

    default:
      return state;
  }
}

// ================ Selectors ================ //

// ================ Action creators ================ //

export const clearUpdatedForm = () => ({
  type: CLEAR_UPDATED_FORM,
});

// SDK method: images.upload
export const uploadImageRequest = params => ({ type: UPLOAD_IMAGE_REQUEST, payload: { params } });
export const uploadImageSuccess = result => ({ type: UPLOAD_IMAGE_SUCCESS, payload: result.data });
export const uploadImageError = error => ({
  type: UPLOAD_IMAGE_ERROR,
  payload: error,
  error: true,
});

// Portfolio image actions
export const uploadPortfolioImageRequest = () => ({ type: UPLOAD_PORTFOLIO_IMAGE_REQUEST });
export const uploadPortfolioImageSuccess = data => ({ type: UPLOAD_PORTFOLIO_IMAGE_SUCCESS, payload: data });
export const uploadPortfolioImageError = error => ({
  type: UPLOAD_PORTFOLIO_IMAGE_ERROR,
  payload: error,
  error: true,
});
export const removePortfolioImageAction = imageId => ({ type: REMOVE_PORTFOLIO_IMAGE, payload: { imageId } });

// SDK method: sdk.currentUser.updateProfile
export const updateProfileRequest = params => ({
  type: UPDATE_PROFILE_REQUEST,
  payload: { params },
});
export const updateProfileSuccess = result => ({
  type: UPDATE_PROFILE_SUCCESS,
  payload: result.data,
});
export const updateProfileError = error => ({
  type: UPDATE_PROFILE_ERROR,
  payload: error,
  error: true,
});

// ================ Thunk ================ //

// Images return imageId which we need to map with previously generated temporary id
export function uploadImage(actionPayload) {
  return (dispatch, getState, sdk) => {
    const id = actionPayload.id;
    dispatch(uploadImageRequest(actionPayload));

    const bodyParams = {
      image: actionPayload.file,
    };
    const queryParams = {
      expand: true,
      'fields.image': ['variants.square-small', 'variants.square-small2x'],
    };

    return sdk.images
      .upload(bodyParams, queryParams)
      .then(resp => {
        const uploadedImage = resp.data.data;
        dispatch(uploadImageSuccess({ data: { id, uploadedImage } }));
      })
      .catch(e => dispatch(uploadImageError({ id, error: storableError(e) })));
  };
}

// Upload portfolio image
export function uploadPortfolioImage(file) {
  return (dispatch, getState, sdk) => {
    const tempId = `portfolio_${Date.now()}`;
    dispatch(uploadPortfolioImageRequest());

    const bodyParams = {
      image: file,
    };
    const queryParams = {
      expand: true,
      'fields.image': ['variants.default', 'variants.landscape-crop', 'variants.landscape-crop2x'],
    };

    return sdk.images
      .upload(bodyParams, queryParams)
      .then(resp => {
        const uploadedImage = resp.data.data;
        const imageId = uploadedImage.id.uuid;
        const imageUrl = uploadedImage.attributes?.variants?.['landscape-crop']?.url ||
                        uploadedImage.attributes?.variants?.default?.url;
        dispatch(uploadPortfolioImageSuccess({ tempId, imageId, imageUrl }));
        return { imageId, imageUrl };
      })
      .catch(e => dispatch(uploadPortfolioImageError({ error: storableError(e) })));
  };
}

// Remove portfolio image from state
export function removePortfolioImage(imageId) {
  return dispatch => {
    dispatch(removePortfolioImageAction(imageId));
  };
}

export const updateProfile = actionPayload => {
  return (dispatch, getState, sdk) => {
    dispatch(updateProfileRequest());

    const queryParams = {
      expand: true,
      include: ['profileImage'],
      'fields.image': ['variants.square-small', 'variants.square-small2x'],
    };

    return sdk.currentUser
      .updateProfile(actionPayload, queryParams)
      .then(response => {
        dispatch(updateProfileSuccess(response));

        const entities = denormalisedResponseEntities(response);
        if (entities.length !== 1) {
          throw new Error('Expected a resource in the sdk.currentUser.updateProfile response');
        }
        const currentUser = entities[0];

        // Update current user in state.user.currentUser through user.duck.js
        dispatch(currentUserShowSuccess(currentUser));
      })
      .catch(e => dispatch(updateProfileError(storableError(e))));
  };
};
