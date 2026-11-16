const http = require('http');
const https = require('https');
const sharetribeSdk = require('sharetribe-flex-sdk');
const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const { handleError, serialize, typeHandlers } = require('../../api-util/sdk');
const { verifyEmailVerifiedToken } = require('../email-otp');
const { verifyPhoneVerifiedToken, phoneAccountKey } = require('../phone-otp');
const { reservePhoneAccount, bindPhoneAccount, releasePhoneReservation } = require('../../db');

const CLIENT_ID = process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID;
const CLIENT_SECRET = process.env.SHARETRIBE_SDK_CLIENT_SECRET;
const TRANSIT_VERBOSE = process.env.REACT_APP_SHARETRIBE_SDK_TRANSIT_VERBOSE === 'true';
const USING_SSL = process.env.REACT_APP_SHARETRIBE_USING_SSL === 'true';
const BASE_URL = process.env.REACT_APP_SHARETRIBE_SDK_BASE_URL;
const INTEGRATION_CLIENT_ID = process.env.INTEGRATION_API_CLIENT_ID;
const INTEGRATION_CLIENT_SECRET = process.env.INTEGRATION_API_CLIENT_SECRET;

const SIGNUP_TIMEOUT_MS = 90000;

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

const isBrowserProxyUrl = url => typeof url === 'string' && url.includes('/api/st');
const baseUrl = BASE_URL && !isBrowserProxyUrl(BASE_URL) ? { baseUrl: BASE_URL } : {};

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

const getIntegrationSdk = () => {
  if (!INTEGRATION_CLIENT_ID || !INTEGRATION_CLIENT_SECRET) return null;
  return sharetribeIntegrationSdk.createInstance({
    clientId: INTEGRATION_CLIENT_ID,
    clientSecret: INTEGRATION_CLIENT_SECRET,
  });
};

/**
 * Mark Sharetribe emailVerified=true after our OTP already confirmed the address.
 * Avoids redundant Sharetribe verification emails and /verify-email redirects.
 */
const markEmailVerified = async email => {
  const integrationSdk = getIntegrationSdk();
  if (!integrationSdk) {
    console.warn('[signup] Integration API not configured, skip emailVerified');
    return;
  }
  try {
    const showRes = await integrationSdk.users.show({ email });
    const user = showRes?.data?.data;
    if (!user?.id) return;
    if (user.attributes?.emailVerified) return;

    await integrationSdk.users.verifyEmail(
      { id: user.id, email: user.attributes.email || email },
      { expand: true }
    );
    console.log('[signup] emailVerified set via Integration API');
  } catch (e) {
    console.warn(
      '[signup] failed to mark emailVerified:',
      e?.status || e?.message,
      e?.data?.errors?.[0]?.code
    );
  }
};

/**
 * Ties the verified number to the new account and flags the account in
 * metadata: only the operator can write metadata, so the flag can be trusted.
 */
const markPhoneVerified = async (phoneKey, userId) => {
  if (!userId) {
    console.error('[signup] no user id after signup, phone number left unbound');
    return;
  }
  try {
    await bindPhoneAccount(phoneKey, userId);
  } catch (e) {
    console.error('[signup] failed to bind phone number:', e?.message);
  }

  const integrationSdk = getIntegrationSdk();
  if (!integrationSdk) {
    console.warn('[signup] Integration API not configured, skip phoneVerified');
    return;
  }
  try {
    await integrationSdk.users.updateProfile({
      id: new sharetribeIntegrationSdk.types.UUID(userId),
      metadata: { phoneVerified: true },
    });
  } catch (e) {
    console.warn(
      '[signup] failed to mark phoneVerified:',
      e?.status || e?.message,
      e?.data?.errors?.[0]?.code
    );
  }
};

const verifySignupEmail = async (verifiedToken, normalizedEmail) => {
  let tokenPayload;
  try {
    tokenPayload = await verifyEmailVerifiedToken(verifiedToken);
  } catch (e) {
    return { message: 'Email verification is invalid or expired.', error: e.message };
  }
  if (normalizeEmail(tokenPayload.email) !== normalizedEmail) {
    return { message: 'Email does not match verified address.' };
  }
  return null;
};

module.exports = async (req, res) => {
  const { verifiedToken, phoneVerifiedToken, email, password, ...rest } = req.body || {};
  const normalizedEmail = normalizeEmail(email);

  if ((!verifiedToken && !phoneVerifiedToken) || !normalizedEmail || !password) {
    res.status(400).json({
      name: 'LocalAPIError',
      message: 'Missing required signup fields.',
    });
    return;
  }

  let verifiedPhone = null;
  if (phoneVerifiedToken) {
    try {
      verifiedPhone = (await verifyPhoneVerifiedToken(phoneVerifiedToken)).phone;
    } catch (e) {
      res.status(400).json({
        name: 'LocalAPIError',
        message: 'Phone verification is invalid or expired.',
        error: e.message,
      });
      return;
    }
  } else {
    const emailError = await verifySignupEmail(verifiedToken, normalizedEmail);
    if (emailError) {
      res.status(400).json({ name: 'LocalAPIError', ...emailError });
      return;
    }
  }

  const phoneKey = verifiedPhone ? phoneAccountKey(verifiedPhone) : null;
  if (phoneKey) {
    let reserved;
    try {
      reserved = await reservePhoneAccount(phoneKey);
    } catch (e) {
      console.error('[signup] failed to hold phone number:', e?.message);
      res.status(503).json({
        name: 'LocalAPIError',
        message: 'Phone number could not be checked.',
      });
      return;
    }
    if (!reserved) {
      res.status(409).json({
        name: 'LocalAPIError',
        message: 'Phone number is already registered.',
        error: 'phoneTaken',
      });
      return;
    }
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
    ...(verifiedPhone
      ? { protectedData: { ...(rest.protectedData || {}), phoneNumber: verifiedPhone } }
      : {}),
  };

  let userId = null;
  try {
    const createResponse = await withTimeout(sdk.currentUser.create(createParams), 'Signup');
    userId = createResponse?.data?.data?.id?.uuid || null;
    if (phoneKey) {
      await markPhoneVerified(phoneKey, userId);
    } else {
      await markEmailVerified(normalizedEmail);
    }
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
    if (phoneKey && !userId) {
      await releasePhoneReservation(phoneKey).catch(releaseError =>
        console.error('[signup] failed to release phone number:', releaseError?.message)
      );
    }
    handleError(res, e);
  }
};
