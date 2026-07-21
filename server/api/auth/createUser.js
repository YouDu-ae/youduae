const http = require('http');
const https = require('https');
const sharetribeSdk = require('sharetribe-flex-sdk');
const { handleError, serialize, typeHandlers } = require('../../api-util/sdk');
const { verifyEmailVerifiedToken } = require('../email-otp');

const CLIENT_ID = process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID;
const CLIENT_SECRET = process.env.SHARETRIBE_SDK_CLIENT_SECRET;
const TRANSIT_VERBOSE = process.env.REACT_APP_SHARETRIBE_SDK_TRANSIT_VERBOSE === 'true';
const USING_SSL = process.env.REACT_APP_SHARETRIBE_USING_SSL === 'true';
const BASE_URL = process.env.REACT_APP_SHARETRIBE_SDK_BASE_URL;

const SIGNUP_TIMEOUT_MS = 90000;

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

const baseUrl = BASE_URL ? { baseUrl: BASE_URL } : {};

const withTimeout = (promise, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout`)), SIGNUP_TIMEOUT_MS);
    }),
  ]);

const normalizeEmail = email =>
  String(email || '')
    .trim()
    .toLowerCase();

module.exports = async (req, res) => {
  const { verifiedToken, email, password, ...rest } = req.body || {};
  const normalizedEmail = normalizeEmail(email);

  if (!verifiedToken || !normalizedEmail || !password) {
    res.status(400).json({
      name: 'LocalAPIError',
      message: 'Missing required signup fields.',
    });
    return;
  }

  let tokenPayload;
  try {
    tokenPayload = await verifyEmailVerifiedToken(verifiedToken);
  } catch (e) {
    res.status(400).json({
      name: 'LocalAPIError',
      message: 'Email verification is invalid or expired.',
      error: e.message,
    });
    return;
  }

  if (normalizeEmail(tokenPayload.email) !== normalizedEmail) {
    res.status(400).json({
      name: 'LocalAPIError',
      message: 'Email does not match verified address.',
    });
    return;
  }

  const tokenStore = sharetribeSdk.tokenStore.expressCookieStore({
    clientId: CLIENT_ID,
    req,
    res,
    secure: USING_SSL,
  });

  const sdk = sharetribeSdk.createInstance({
    transitVerbose: TRANSIT_VERBOSE,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    httpAgent,
    httpsAgent,
    tokenStore,
    typeHandlers,
    ...baseUrl,
  });

  const createParams = {
    email: normalizedEmail,
    password,
    ...rest,
  };

  try {
    await withTimeout(sdk.currentUser.create(createParams), 'Signup');
    const loginResponse = await withTimeout(
      sdk.login({ username: normalizedEmail, password }),
      'Login after signup'
    );

    const { status, statusText, data } = loginResponse;
    res
      .status(status)
      .set('Content-Type', 'application/transit+json')
      .send(
        serialize({
          status,
          statusText,
          data,
        })
      )
      .end();
  } catch (e) {
    handleError(res, e);
  }
};
