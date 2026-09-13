const sharetribeSdk = require('sharetribe-flex-sdk');
const { typeHandlers } = require('./sdk');

/**
 * Builds a trusted SDK from the Bearer token the mobile app sends.
 *
 * The web gets this from getTrustedSdk, which reads the session cookie. The app
 * has no cookie, so the token arrives in the Authorization header and has to be
 * exchanged by hand before privileged transitions will accept it.
 */

const CLIENT_ID = process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID;
const CLIENT_SECRET = process.env.SHARETRIBE_SDK_CLIENT_SECRET;
const BASE_URL = process.env.REACT_APP_SHARETRIBE_SDK_BASE_URL;

class BearerAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BearerAuthError';
    this.statusCode = 401;
  }
}

const readBearerToken = req => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new BearerAuthError('Bearer token is missing');
  }

  const accessToken = authHeader.substring(7);

  // Clients that lost their session tend to send these as literal strings.
  if (!accessToken || accessToken === 'null' || accessToken === 'undefined') {
    throw new BearerAuthError('Invalid access token');
  }

  return accessToken;
};

// Only the instance that performs the exchange needs the client secret; the
// trusted one is built from the token the exchange handed back.
const sdkWithToken = (token, { withSecret = false } = {}) => {
  const tokenStore = sharetribeSdk.tokenStore.memoryStore();
  tokenStore.setToken(token);

  return sharetribeSdk.createInstance({
    clientId: CLIENT_ID,
    ...(withSecret ? { clientSecret: CLIENT_SECRET } : {}),
    tokenStore,
    typeHandlers,
    ...(BASE_URL ? { baseUrl: BASE_URL } : {}),
  });
};

/**
 * @throws {BearerAuthError} when the header is missing or unusable.
 */
const trustedSdkFromBearer = async req => {
  const accessToken = readBearerToken(req);

  const sdk = sdkWithToken(
    { access_token: accessToken, token_type: 'bearer' },
    { withSecret: true }
  );
  const exchangeResponse = await sdk.exchangeToken();

  return sdkWithToken(exchangeResponse.data);
};

module.exports = { trustedSdkFromBearer, BearerAuthError };
