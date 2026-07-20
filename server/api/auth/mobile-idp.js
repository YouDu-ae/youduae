const http = require('http');
const https = require('https');
const sharetribeSdk = require('sharetribe-flex-sdk');
const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const { typeHandlers } = require('../../api-util/sdk');

const CLIENT_ID = process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID;
const CLIENT_SECRET = process.env.SHARETRIBE_SDK_CLIENT_SECRET;
const TRANSIT_VERBOSE = process.env.REACT_APP_SHARETRIBE_SDK_TRANSIT_VERBOSE === 'true';
const BASE_URL = process.env.REACT_APP_SHARETRIBE_SDK_BASE_URL;
const INTEGRATION_CLIENT_ID = process.env.INTEGRATION_API_CLIENT_ID;
const INTEGRATION_CLIENT_SECRET = process.env.INTEGRATION_API_CLIENT_SECRET;

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || 'com.youdu.mobile';

const ALLOWED_IDP_IDS = new Set(['google', 'apple']);

/** YouDuMobile is for заказчики only (Sharetribe userType = provider) */
const MOBILE_ALLOWED_USER_TYPE = 'provider';

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

const roleMismatchMessage = (actualUserType) => {
  if (actualUserType === 'customer') {
    return (
      'Это приложение для заказчиков. Аккаунт исполнителя войдёт в отдельном приложении YouDu для специалистов. Пока пользуйтесь сайтом youdu.ae.'
    );
  }
  return (
    'Тип аккаунта не подходит для этого приложения. Войдите через другой аккаунт или сайт youdu.ae.'
  );
};

const emailTakenMessage = () =>
  'Аккаунт с этим email уже существует. Войдите через email и пароль ' +
  '(или убедитесь, что email в профиле подтверждён — тогда вход через Apple/Google подхватит аккаунт).';

/** Decode email claim from JWT without verifying signature (lookup only). */
const emailFromIdToken = idpToken => {
  try {
    const parts = String(idpToken).split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload.email || null;
  } catch {
    return null;
  }
};

const getIntegrationSdk = () => {
  if (!INTEGRATION_CLIENT_ID || !INTEGRATION_CLIENT_SECRET) return null;
  return sharetribeIntegrationSdk.createInstance({
    clientId: INTEGRATION_CLIENT_ID,
    clientSecret: INTEGRATION_CLIENT_SECRET,
  });
};

const lookupUserTypeByEmail = async email => {
  if (!email) return null;
  const integrationSdk = getIntegrationSdk();
  if (!integrationSdk) {
    console.warn('⚠️ mobile-idp: Integration API not configured, skip email lookup');
    return null;
  }
  try {
    const res = await integrationSdk.users.show({ email });
    const user = res?.data?.data;
    return user?.attributes?.profile?.publicData?.userType || null;
  } catch (err) {
    const status = err?.status || err?.response?.status;
    if (status === 404) return null;
    console.warn('⚠️ mobile-idp: users.show by email failed:', status, err?.message);
    return null;
  }
};

/**
 * Mobile IdP auth (Google / Apple).
 * Only allows Sharetribe userType === 'provider' (заказчик) into YouDuMobile.
 */
module.exports = async (req, res) => {
  const {
    idpId,
    idpToken,
    idpClientId: idpClientIdFromBody,
    firstName,
    lastName,
    email: emailFromBody,
    displayName,
    userType = MOBILE_ALLOWED_USER_TYPE,
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

  // Mobile app always expects заказчик accounts
  const expectedUserType = MOBILE_ALLOWED_USER_TYPE;
  if (userType && userType !== expectedUserType) {
    return res
      .status(403)
      .json({
        error: 'role_mismatch',
        userType,
        message: roleMismatchMessage(userType),
      })
      .end();
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ mobile-idp: missing Sharetribe client credentials');
    return res.status(500).json({ error: 'Server auth is not configured' }).end();
  }

  const idpClientId = resolveIdpClientId(idpId, idpClientIdFromBody);
  if (!idpClientId) {
    return res.status(500).json({ error: 'IdP client ID is not configured' }).end();
  }

  const resolvedEmail = emailFromBody || emailFromIdToken(idpToken);

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

  console.log('📱 mobile-idp: start', {
    idpId,
    idpClientId,
    expectedUserType,
    hasEmail: !!resolvedEmail,
  });

  let isNewUser = false;

  try {
    try {
      await sdk.loginWithIdp(loginParams);
      console.log('✅ mobile-idp: loginWithIdp success');
    } catch (loginErr) {
      if (!isMissingUserError(loginErr)) {
        throw loginErr;
      }

      // Before creating: if email belongs to an executor, reject with role_mismatch
      if (resolvedEmail) {
        const existingType = await lookupUserTypeByEmail(resolvedEmail);
        if (existingType && existingType !== expectedUserType) {
          console.warn('⚠️ mobile-idp: existing account role mismatch', {
            email: resolvedEmail,
            existingType,
          });
          return res
            .status(403)
            .json({
              error: 'role_mismatch',
              userType: existingType,
              message: roleMismatchMessage(existingType),
            })
            .end();
        }
      }

      console.log('📱 mobile-idp: no existing IdP link / verified email match, creating…', {
        status: loginErr?.status,
        message: loginErr?.statusText || loginErr?.message,
      });
      isNewUser = true;

      const createParams = {
        ...loginParams,
        ...(resolvedEmail ? { email: resolvedEmail } : {}),
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        ...(displayName ? { displayName } : {}),
        publicData: {
          userType: expectedUserType,
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
          const existingType = resolvedEmail
            ? await lookupUserTypeByEmail(resolvedEmail)
            : null;
          if (existingType && existingType !== expectedUserType) {
            console.warn('⚠️ mobile-idp: conflict + role mismatch', { existingType });
            return res
              .status(403)
              .json({
                error: 'role_mismatch',
                userType: existingType,
                message: roleMismatchMessage(existingType),
              })
              .end();
          }
          console.warn('⚠️ mobile-idp: email already registered (provider or unknown)');
          return res
            .status(409)
            .json({
              error: 'email_taken',
              userType: existingType || null,
              message: emailTakenMessage(),
            })
            .end();
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

    // Gate: only заказчики (provider) may use this mobile app
    if (resolvedUserType && resolvedUserType !== expectedUserType) {
      console.warn('⚠️ mobile-idp: rejecting login — role mismatch', { resolvedUserType });
      tokenStore.setToken(null);
      return res
        .status(403)
        .json({
          error: 'role_mismatch',
          userType: resolvedUserType,
          message: roleMismatchMessage(resolvedUserType),
        })
        .end();
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
        userType: resolvedUserType || expectedUserType,
      })
      .end();
  } catch (e) {
    const status = e?.status || e?.response?.status || 500;
    const data = e?.data || e?.response?.data || null;
    const errors = data?.errors || [];
    const message =
      errors[0]?.title || e?.statusText || e?.message || 'Unknown error';
    console.error('❌ mobile-idp error:', status, message, data);

    return res
      .status(status >= 400 && status < 600 ? status : 500)
      .json({
        error: 'IdP authentication failed',
        message,
        details: data,
      })
      .end();
  }
};
