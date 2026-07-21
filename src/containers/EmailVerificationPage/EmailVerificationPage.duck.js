import { parse } from '../../util/urlHelpers';
import { verify } from '../../ducks/emailVerification.duck';

// ================ Thunks ================ //

export const loadData = (params, search) => (dispatch, getState) => {
  const { isAuthenticated } = getState().auth;
  if (!isAuthenticated) {
    // Verification requires a logged-in session; page shows login CTA instead.
    return Promise.resolve(null);
  }

  const urlParams = parse(search);
  const verificationToken = urlParams.t;
  const token = verificationToken ? `${verificationToken}` : null;
  return dispatch(verify(token));
};
