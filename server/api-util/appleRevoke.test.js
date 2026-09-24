const crypto = require('crypto');
const { jwtVerify, decodeProtectedHeader } = require('jose');

const {
  createAppleClientSecret,
  revokeAppleAuthorization,
  isAppleRevokeConfigured,
} = require('./appleRevoke');

// A throwaway P-256 key in the same PKCS#8 form Apple hands out as a .p8 file.
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });

const ENV_KEYS = ['APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY', 'APPLE_CLIENT_ID'];

describe('appleRevoke', () => {
  const saved = {};
  const originalFetch = global.fetch;

  beforeEach(() => {
    ENV_KEYS.forEach(key => {
      saved[key] = process.env[key];
    });
    process.env.APPLE_TEAM_ID = 'TEAM123';
    process.env.APPLE_KEY_ID = 'KEY456';
    // Heroku keeps the key with escaped newlines.
    process.env.APPLE_PRIVATE_KEY = pem.replace(/\n/g, '\\n');
    delete process.env.APPLE_CLIENT_ID;
  });

  afterEach(() => {
    ENV_KEYS.forEach(key => {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    });
    global.fetch = originalFetch;
  });

  describe('createAppleClientSecret', () => {
    it('signs the claims Apple checks with the Sign in with Apple key', async () => {
      const now = new Date('2026-09-24T08:00:00Z');
      const secret = await createAppleClientSecret({ clientId: 'ae.youdu.mobile', now });

      expect(decodeProtectedHeader(secret)).toEqual({ alg: 'ES256', kid: 'KEY456' });

      const { payload } = await jwtVerify(secret, publicKey, {
        issuer: 'TEAM123',
        audience: 'https://appleid.apple.com',
        subject: 'ae.youdu.mobile',
        currentDate: now,
      });
      expect(payload.exp - payload.iat).toBe(300);
    });
  });

  describe('revokeAppleAuthorization', () => {
    it('exchanges the code and revokes the refresh token', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ refresh_token: 'r-1', access_token: 'a-1' }),
        })
        .mockResolvedValueOnce({ ok: true, text: async () => '' });

      const result = await revokeAppleAuthorization({
        authorizationCode: 'code-1',
        clientId: 'ae.youdu.mobile',
      });

      expect(result).toEqual({ revoked: true });

      const [tokenUrl, tokenRequest] = global.fetch.mock.calls[0];
      expect(tokenUrl).toBe('https://appleid.apple.com/auth/token');
      const tokenForm = new URLSearchParams(tokenRequest.body);
      expect(tokenForm.get('grant_type')).toBe('authorization_code');
      expect(tokenForm.get('code')).toBe('code-1');

      const [revokeUrl, revokeRequest] = global.fetch.mock.calls[1];
      expect(revokeUrl).toBe('https://appleid.apple.com/auth/revoke');
      const revokeForm = new URLSearchParams(revokeRequest.body);
      expect(revokeForm.get('token')).toBe('r-1');
      expect(revokeForm.get('token_type_hint')).toBe('refresh_token');
    });

    it('does not sign for a client id that is not ours', async () => {
      global.fetch = jest.fn();

      const result = await revokeAppleAuthorization({
        authorizationCode: 'code-1',
        clientId: 'com.someone.else',
      });

      expect(result).toEqual({ revoked: false, reason: 'unknown-client-id' });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('surfaces an Apple refusal to the caller', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{"error":"invalid_grant"}',
      });

      await expect(
        revokeAppleAuthorization({ authorizationCode: 'old', clientId: 'ae.youdu.mobile' })
      ).rejects.toThrow('invalid_grant');
    });

    it('stays out of the way when the key is not configured', async () => {
      delete process.env.APPLE_PRIVATE_KEY;
      expect(isAppleRevokeConfigured()).toBe(false);
      expect(
        await revokeAppleAuthorization({ authorizationCode: 'c', clientId: 'ae.youdu.mobile' })
      ).toEqual({ revoked: false, reason: 'not-configured' });
    });
  });
});
