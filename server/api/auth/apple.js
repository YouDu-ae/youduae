const passport = require('passport');
const AppleStrategy = require('passport-apple');
const loginWithIdp = require('./loginWithIdp');

const radix = 10;
const PORT = parseInt(process.env.REACT_APP_DEV_API_SERVER_PORT, radix);
const rootUrl = process.env.REACT_APP_MARKETPLACE_ROOT_URL;
const USING_SSL = process.env.REACT_APP_SHARETRIBE_USING_SSL === 'true';

// Apple Sign-In configuration
const clientID = process.env.REACT_APP_APPLE_CLIENT_ID; // Services ID (e.g., ae.youdu.web)
const teamID = process.env.APPLE_TEAM_ID;
const keyID = process.env.APPLE_KEY_ID;
const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n'); // Handle escaped newlines

let callbackURL = null;

const useDevApiServer = process.env.NODE_ENV === 'development' && !!PORT;

if (useDevApiServer) {
  callbackURL = `http://localhost:${PORT}/api/auth/apple/callback`;
} else {
  callbackURL = `${rootUrl}/api/auth/apple/callback`;
}

const strategyOptions = {
  clientID,
  teamID,
  keyID,
  privateKeyString: privateKey,
  callbackURL,
  passReqToCallback: true,
  scope: ['name', 'email'],
};

/**
 * Function Passport calls when a redirect returns the user from Apple to the application.
 *
 * Apple Sign-In specifics:
 * - Apple only sends user's name on the FIRST authentication
 * - Email may be a private relay address (@privaterelay.appleid.com)
 * - The id_token is a JWT that Sharetribe can verify
 *
 * @param {Object} req Express request object
 * @param {String} accessToken Access token (not used with Apple)
 * @param {String} refreshToken Refresh token (not used with Apple)
 * @param {Object} idToken The id_token JWT from Apple
 * @param {Object} profile User profile (may be empty on subsequent logins)
 * @param {Function} done Session management function
 */
const verifyCallback = (req, accessToken, refreshToken, idToken, profile, done) => {
  // Apple sends user info in req.body on first sign-in only
  const appleUser = req.body?.user ? JSON.parse(req.body.user) : null;

  // Get email from id_token claims or profile
  const email = profile?.email || idToken?.email;

  // Get name from first sign-in data or profile
  const firstName = appleUser?.name?.firstName || profile?.name?.firstName || '';
  const lastName = appleUser?.name?.lastName || profile?.name?.lastName || '';

  // Get state from cookie (stored before redirect to Apple)
  // Note: Apple sends POST callback, cookies with sameSite:lax may not be sent
  let state = {};
  try {
    const stateCookie = req.cookies?.['st-apple-state'];
    if (stateCookie) {
      state = JSON.parse(stateCookie);
    }
  } catch (e) {
    console.warn('Failed to parse apple state cookie:', e.message);
  }

  // Use defaults if state wasn't retrieved (cross-origin POST issue)
  const from = state.from || null;
  const defaultReturn = state.defaultReturn || '/';
  const defaultConfirm = state.defaultConfirm || '/signup/confirm';
  const userType = state.userType || null;

  // The idToken is what we pass to Sharetribe
  // It's a JWT that Sharetribe will verify against Apple's public keys
  const idpToken = idToken;

  const userData = {
    email,
    firstName,
    lastName,
    idpToken,
    from,
    defaultReturn,
    defaultConfirm,
    userType,
  };

  done(null, userData);
};

// Only register strategy if all required credentials are present
if (clientID && teamID && keyID && privateKey) {
  passport.use(new AppleStrategy(strategyOptions, verifyCallback));
}

/**
 * Initiate authentication with Apple. Redirects user to Apple's sign-in page.
 */
exports.authenticateApple = (req, res, next) => {
  const { from, defaultReturn, defaultConfirm, userType } = req.query || {};

  // Store state in a cookie (Apple callback is POST, so we can't use URL state like Google)
  const state = JSON.stringify({
    from,
    defaultReturn,
    defaultConfirm,
    userType,
  });

  res.cookie('st-apple-state', state, {
    maxAge: 15 * 60 * 1000, // 15 minutes
    httpOnly: true,
    secure: true, // Required for sameSite: 'none'
    sameSite: 'none', // Allow cross-origin POST from Apple
  });

  passport.authenticate('apple')(req, res, next);
};

/**
 * Handle callback from Apple after authentication.
 * Note: Apple sends a POST request to the callback URL.
 */
exports.authenticateAppleCallback = (req, res, next) => {
  const sessionFn = (err, user) => {
    // Clear the state cookie
    res.clearCookie('st-apple-state');
    return loginWithIdp(err, user, req, res, clientID, 'apple');
  };

  passport.authenticate('apple', sessionFn)(req, res, next);
};
