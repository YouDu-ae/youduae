import { storableError } from '../../util/errors';
import { fetchCurrentUser } from '../../ducks/user.duck';
import { trackKycStarted } from '../../analytics/plausibleEvents';

// ================ Action types ================ //

export const UPLOAD_DOCUMENTS_REQUEST = 'app/VerificationPage/UPLOAD_DOCUMENTS_REQUEST';
export const UPLOAD_DOCUMENTS_SUCCESS = 'app/VerificationPage/UPLOAD_DOCUMENTS_SUCCESS';
export const UPLOAD_DOCUMENTS_ERROR = 'app/VerificationPage/UPLOAD_DOCUMENTS_ERROR';

export const CLEAR_STATE = 'app/VerificationPage/CLEAR_STATE';

// ================ Reducer ================ //

const initialState = {
  uploadInProgress: false,
  uploadSuccess: false,
  uploadError: null,
};

export default function verificationPageReducer(state = initialState, action = {}) {
  const { type, payload } = action;
  switch (type) {
    case UPLOAD_DOCUMENTS_REQUEST:
      return {
        ...state,
        uploadInProgress: true,
        uploadSuccess: false,
        uploadError: null,
      };
    case UPLOAD_DOCUMENTS_SUCCESS:
      return {
        ...state,
        uploadInProgress: false,
        uploadSuccess: true,
        uploadError: null,
      };
    case UPLOAD_DOCUMENTS_ERROR:
      return {
        ...state,
        uploadInProgress: false,
        uploadSuccess: false,
        uploadError: payload,
      };
    case CLEAR_STATE:
      return initialState;
    default:
      return state;
  }
}

// ================ Action creators ================ //

export const uploadDocumentsRequest = () => ({ type: UPLOAD_DOCUMENTS_REQUEST });
export const uploadDocumentsSuccess = () => ({ type: UPLOAD_DOCUMENTS_SUCCESS });
export const uploadDocumentsError = error => ({
  type: UPLOAD_DOCUMENTS_ERROR,
  payload: error,
  error: true,
});

export const clearVerificationState = () => ({ type: CLEAR_STATE });

// ================ Thunks ================ //

/**
 * Upload verification documents
 * 
 * Process:
 * 1. Upload images to Sharetribe Images API
 * 2. Store image IDs in user's protectedData
 * 3. Set verification status to 'pending'
 */
export const uploadVerificationDocuments = (files, documentType) => (dispatch, getState, sdk) => {
  dispatch(uploadDocumentsRequest());
  const state = getState();
  const currentUserId = state?.user?.currentUser?.id?.uuid;
  trackKycStarted({ userId: currentUserId, documentType });

  // 1. Upload all images in parallel
  const uploadPromises = files.map(file =>
    sdk.images.upload({ image: file }).catch(error => {
      console.error('Failed to upload image:', error);
      return null; // Return null for failed uploads
    })
  );

  return Promise.all(uploadPromises)
    .then(results => {
      // 2. Filter out failed uploads and extract image IDs
      const successfulUploads = results.filter(r => r !== null);

      if (successfulUploads.length === 0) {
        throw new Error('All image uploads failed');
      }

      const imageIds = successfulUploads.map(r => r.data.data.id.uuid);

      // 3. Prepare verification documents data
      const verificationDocuments = imageIds.map(id => ({
        id,
        type: documentType,
        uploadedAt: new Date().toISOString(),
        status: 'pending',
      }));

      // 4. Update user's protectedData with document IDs
      return sdk.currentUser.updateProfile({
        protectedData: {
          verificationDocuments,
        },
      });
    })
    .then(response => {
      dispatch(uploadDocumentsSuccess());
      // Refresh current user data to get updated protectedData
      dispatch(fetchCurrentUser());
      return response;
    })
    .catch(e => {
      const error = storableError(e);
      dispatch(uploadDocumentsError(error));
      throw error;
    });
};

/**
 * Check verification status
 * This is automatically handled through currentUser in Redux store,
 * but can be called explicitly if needed
 */
export const checkVerificationStatus = () => (dispatch, getState, sdk) => {
  return dispatch(fetchCurrentUser());
};

