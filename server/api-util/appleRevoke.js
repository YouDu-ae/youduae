/**
 * Revokes the app's Sign in with Apple authorization when a user deletes their
 * account — Apple requires it for apps that offer Sign in with Apple.
 *
 * Nothing on our side keeps an Apple refresh token, so the app asks Apple for a
 * fresh authorization code at deletion time. The code is exchanged for a token
 * here and that token is revoked, which removes YouDu from the user's
 * "Apps using Apple ID" list.
 */

const { SignJWT, importPKCS8 } = require('jose');

const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';

// Apple accepts a client secret valid for up to six months; one use needs minutes.
const CLIENT_SECRET_TTL_SECONDS = 5 * 60;
const REQUEST_TIMEOUT_MS = 10 * 1000;

// Only our own client ids may be revoked with our key, whatever the caller sends.
const allowedClientIds = () =>
  [process.env.APPLE_CLIENT_ID || 'ae.youdu.mobile', process.env.REACT_APP_APPLE_CLIENT_ID].filter(
    Boolean
  );

const isAppleRevokeConfigured = () =>
  !!process.env.APPLE_TEAM_ID && !!process.env.APPLE_KEY_ID && !!process.env.APPLE_PRIVATE_KEY;

/**
 * The ES256 JWT Apple expects as client_secret, signed with the Sign in with
 * Apple key.
 */
const createAppleClientSecret = async ({ clientId, now = new Date() }) => {
  // Heroku stores the multi-line key with escaped newlines.
  const privateKey = await importPKCS8(
    process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    'ES256'
  );
  const issuedAt = Math.floor(now.getTime() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: process.env.APPLE_KEY_ID })
    .setIssuer(process.env.APPLE_TEAM_ID)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + CLIENT_SECRET_TTL_SECONDS)
    .setAudience('https://appleid.apple.com')
    .setSubject(clientId)
    .sign(privateKey);
};

const postForm = async (url, fields) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Apple ${url} answered ${response.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : {};
};

/**
 * @param {{authorizationCode: string, clientId: string}} params
 * @returns {Promise<{revoked: boolean, reason?: string}>}
 */
const revokeAppleAuthorization = async ({ authorizationCode, clientId }) => {
  if (!isAppleRevokeConfigured()) {
    return { revoked: false, reason: 'not-configured' };
  }
  if (!allowedClientIds().includes(clientId)) {
    return { revoked: false, reason: 'unknown-client-id' };
  }

  const clientSecret = await createAppleClientSecret({ clientId });

  const tokens = await postForm(APPLE_TOKEN_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    code: authorizationCode,
    grant_type: 'authorization_code',
  });

  // A refresh token revokes every token the user granted; fall back to the
  // access token when Apple does not issue one.
  const token = tokens.refresh_token || tokens.access_token;
  if (!token) {
    return { revoked: false, reason: 'no-token-issued' };
  }

  await postForm(APPLE_REVOKE_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    token,
    token_type_hint: tokens.refresh_token ? 'refresh_token' : 'access_token',
  });

  return { revoked: true };
};

module.exports = {
  revokeAppleAuthorization,
  createAppleClientSecret,
  isAppleRevokeConfigured,
};
