const http = require('http');
const https = require('https');
const sharetribeSdk = require('sharetribe-flex-sdk');
const { typeHandlers } = require('../../api-util/sdk');

const CLIENT_ID = process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID;
const CLIENT_SECRET = process.env.SHARETRIBE_SDK_CLIENT_SECRET;
const TRANSIT_VERBOSE = process.env.REACT_APP_SHARETRIBE_SDK_TRANSIT_VERBOSE === 'true';
const BASE_URL = process.env.REACT_APP_SHARETRIBE_SDK_BASE_URL;

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || 'com.youdu.mobile';

const ALLOWED_IDP_IDS = new Set(['google', 'apple']);

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });
const baseUrlMaybe = BASE_URL ? { baseUrl: BASE_URL } : {};

const resolveIdpClientId = (idpId, fromBody) => {
  if (fromBody) return fromBody;
  if (idpId === 'google') return GOOGLE_CLIENT_ID;
  if (idpId === 'apple') return APPLE_CLIENT_ID;
  return null;
};

const isMissingUserError = err => {
  const status = err?.status || err?.response?.status;
  // loginWithIdp fails when IdP identity is not linked and email does not match a verified user
  return status === 401 || status === 404;
};

const isEmailTakenError = err => {
  const status = err?.status || err?.response?.status;
  if (status === 409) return true;
  const errors = err?.data?.errors || err?.response?.data?.errors || [];
  return errors.some(
    e =>
      e?.code === 'email-taken' ||
      e?.code === 'idp-profile-already-exists' ||
      String(e?.title || '')
        .toLowerCase()
        .includes('conflict')
  );
};

const friendlyErrorMessage = err => {
  if (isEmailTakenError(err)) {
    return (
      'Аккаунт с этим email уже существует. Войдите через email и пароль ' +
      '(или убедитесь, что email в профиле подтверждён — тогда вход через Apple/Google подхватит аккаунт).'
    );
  }
  const errors = err?.data?.errors || err?.response?.data?.errors || [];
  const first = errors[0];
  if (first?.title) return first.title;
  return err?.statusText || err?.message || 'Unknown error';
};

/**
 * Mobile IdP auth (Google / Apple).
 * Body (JSON):
 *  - idpId: 'google' | 'apple'
 *  - idpToken: ID token from native SDK
 *  - idpClientId?: override (defaults: Google Web client / com.youdu.mobile)
 *  - firstName?, lastName?, email?, displayName?
 *  - userType?: defaults to 'provider' (заказчик / YouDuMobile)
 *  - publicData?, protectedData?, privateData?
 *
 * Response JSON:
 *  { access_token, refresh_token, expires_in, token_type, scope, isNewUser, userType }
 */
module.exports = async (req, res) => {
  const {
    idpId,
    idpToken,
    idpClientId: idpClientIdFromBody,
    firstName,
    lastName,
    email,
    displayName,
    userType = 'provider',
    publicData = {},
    protectedData = {},
    privateData = {},
  } = req.body || {};

  if (!idpId || !idpToken) {
    return res.status(400).json({ error: 'idpId and idpToken are required' }).end();
  }

  if (!ALLOWED_IDP_IDS.has(idpId)) {
    return res.status(400).json({ error: 'Unsupported idpId. Use google or apple.' }).end();
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ mobile-idp: missing Sharetribe client credentials');
    return res.status(500).json({ error: 'Server auth is not configured' }).end();
  }

  const idpClientId = resolveIdpClientId(idpId, idpClientIdFromBody);
  if (!idpClientId) {
    return res.status(500).json({ error: 'IdP client ID is not configured' }).end();
  }

  const tokenStore = sharetribeSdk.tokenStore.memoryStore();
  const sdk = sharetribeSdk.createInstance({
    transitVerbose: TRANSIT_VERBOSE,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    httpAgent,
    httpsAgent,
    tokenStore,
    typeHandlers,
    ...baseUrlMaybe,
  });

  const loginParams = {
    idpId,
    idpClientId: String(idpClientId),
    idpToken: String(idpToken),
  };

  console.log('📱 mobile-idp: start', { idpId, idpClientId, userType });

  let isNewUser = false;

  try {
    try {
      await sdk.loginWithIdp(loginParams);
      console.log('✅ mobile-idp: loginWithIdp success');
    } catch (loginErr) {
      if (!isMissingUserError(loginErr)) {
        throw loginErr;
      }

      console.log('📱 mobile-idp: no existing IdP link / verified email match, creating…', {
        status: loginErr?.status,
        message: loginErr?.statusText || loginErr?.message,
      });
      isNewUser = true;

      const createParams = {
        ...loginParams,
        ...(email ? { email } : {}),
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        ...(displayName ? { displayName } : {}),
        publicData: {
          userType,
          ...publicData,
        },
        ...(Object.keys(protectedData).length ? { protectedData } : {}),
        ...(Object.keys(privateData).length ? { privateData } : {}),
      };

      try {
        await sdk.currentUser.createWithIdp(createParams);
        console.log('✅ mobile-idp: createWithIdp success');
      } catch (createErr) {
        if (isEmailTakenError(createErr)) {
          console.warn('⚠️ mobile-idp: email already registered, create skipped');
          const conflict = new Error(friendlyErrorMessage(createErr));
          conflict.status = 409;
          conflict.statusText = 'Conflict';
          conflict.data = createErr?.data || createErr?.response?.data;
          throw conflict;
        }
        throw createErr;
      }

      await sdk.loginWithIdp(loginParams);
      console.log('✅ mobile-idp: loginWithIdp after create success');
    }

    const token = tokenStore.getToken();
    if (!token?.access_token) {
      console.error('❌ mobile-idp: no token in store after login');
      return res.status(500).json({ error: 'Authentication succeeded but no token returned' }).end();
    }

    let resolvedUserType = null;
    try {
      const me = await sdk.currentUser.show();
      resolvedUserType = me?.data?.data?.attributes?.profile?.publicData?.userType || null;
    } catch (showErr) {
      console.warn('⚠️ mobile-idp: could not load currentUser:', showErr?.message);
    }

    return res
      .status(200)
      .json({
        access_token: token.access_token,
        refresh_token: token.refresh_token || null,
        expires_in: token.expires_in || null,
        token_type: token.token_type || 'bearer',
        scope: token.scope || 'user',
        isNewUser,
        userType: resolvedUserType || userType,
      })
      .end();
  } catch (e) {
    const status = e?.status || e?.response?.status || 500;
    const data = e?.data || e?.response?.data || null;
    const message = friendlyErrorMessage(e);
    console.error('❌ mobile-idp error:', status, message, data);

    return res
      .status(status >= 400 && status < 600 ? status : 500)
      .json({
        error: isEmailTakenError(e) ? 'email_taken' : 'IdP authentication failed',
        message,
        details: data,
      })
      .end();
  }
};
