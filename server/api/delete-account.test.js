const mockDb = {
  deleteUserLocalData: jest.fn(),
  recordDeletionRequest: jest.fn(),
};
const mockGetTrustedSdk = jest.fn();
const mockTrustedSdkFromBearer = jest.fn();
const mockRevoke = jest.fn();
const mockSendAccountEmail = jest.fn();
const mockNotifyAdmin = jest.fn();

jest.mock('../db', () => ({
  deleteUserLocalData: (...args) => mockDb.deleteUserLocalData(...args),
  recordDeletionRequest: (...args) => mockDb.recordDeletionRequest(...args),
}));
jest.mock('../api-util/sdk', () => ({ getTrustedSdk: (...args) => mockGetTrustedSdk(...args) }));
jest.mock('../api-util/mobileSdk', () => ({
  trustedSdkFromBearer: (...args) => mockTrustedSdkFromBearer(...args),
}));
jest.mock('../api-util/appleRevoke', () => ({
  revokeAppleAuthorization: (...args) => mockRevoke(...args),
}));
jest.mock('../api-util/accountEmails', () => ({
  sendAccountEmail: (...args) => mockSendAccountEmail(...args),
}));
jest.mock('./telegram-bot', () => ({
  notifyAdminAccountDeletionRequest: (...args) => mockNotifyAdmin(...args),
}));

const deleteAccount = require('./delete-account');

const sdkError = status => Object.assign(new Error(`status ${status}`), { status });

const fakeTrustedSdk = ({ deleteError } = {}) => ({
  currentUser: {
    show: jest.fn(async () => ({
      data: { data: { id: { uuid: 'user-1' }, attributes: { email: 'client@example.com' } } },
    })),
    delete: jest.fn(async () => {
      if (deleteError) throw deleteError;
      return { data: {} };
    }),
  },
});

const call = async ({ body = {}, headers = {} } = {}) => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  await deleteAccount({ body, headers }, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

describe('POST /api/account/delete', () => {
  let sdk;

  beforeEach(() => {
    jest.resetAllMocks();
    sdk = fakeTrustedSdk();
    mockGetTrustedSdk.mockResolvedValue(sdk);
    mockTrustedSdkFromBearer.mockResolvedValue(sdk);
    mockDb.recordDeletionRequest.mockResolvedValue(true);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('refuses a visitor without a session', async () => {
    mockGetTrustedSdk.mockRejectedValue(sdkError(401));
    const { status } = await call();
    expect(status).toBe(401);
    expect(sdk.currentUser.delete).not.toHaveBeenCalled();
  });

  it('uses the Bearer token the app sends instead of the cookie', async () => {
    await call({ headers: { authorization: 'Bearer abc' }, body: { currentPassword: 'secret' } });
    expect(mockTrustedSdkFromBearer).toHaveBeenCalled();
    expect(mockGetTrustedSdk).not.toHaveBeenCalled();
  });

  describe('with a password', () => {
    it('deletes the account at once and clears our own tables', async () => {
      const { status, body } = await call({ body: { currentPassword: 'secret' } });

      expect(status).toBe(200);
      expect(body).toEqual({ status: 'deleted' });
      expect(sdk.currentUser.delete).toHaveBeenCalledWith(
        { currentPassword: 'secret' },
        { expand: true }
      );
      expect(mockDb.deleteUserLocalData).toHaveBeenCalledWith('user-1');
      expect(mockSendAccountEmail).toHaveBeenCalledWith('deleted', 'client@example.com');
    });

    it('says so when the password is wrong and deletes nothing', async () => {
      sdk.currentUser.delete.mockRejectedValue(sdkError(403));

      const { status, body } = await call({ body: { currentPassword: 'wrong' } });

      expect(status).toBe(403);
      expect(body).toEqual({ error: 'wrong_password' });
      expect(mockDb.deleteUserLocalData).not.toHaveBeenCalled();
    });

    // The account is already gone at this point; a failed letter must not
    // make the app report that deletion failed.
    it('still reports success when the letter cannot be sent', async () => {
      mockSendAccountEmail.mockRejectedValue(new Error('SendGrid down'));
      const { status } = await call({ body: { currentPassword: 'secret' } });
      expect(status).toBe(200);
    });
  });

  describe('without a password', () => {
    it('records a request for the operator and tells the person the deadline', async () => {
      const { status, body } = await call({ body: { source: 'ios' } });

      expect(status).toBe(202);
      expect(body).toEqual({ status: 'requested', withinDays: 30 });
      expect(sdk.currentUser.delete).not.toHaveBeenCalled();
      expect(mockDb.recordDeletionRequest).toHaveBeenCalledWith({
        userId: 'user-1',
        email: 'client@example.com',
        method: 'manual',
      });
      expect(mockNotifyAdmin).toHaveBeenCalledWith({
        userId: 'user-1',
        email: 'client@example.com',
        source: 'приложение iOS',
      });
      expect(mockSendAccountEmail).toHaveBeenCalledWith('requested', 'client@example.com');
    });

    it('does not alert the operator twice for a repeated request', async () => {
      mockDb.recordDeletionRequest.mockResolvedValue(false);

      const { status } = await call();

      expect(status).toBe(202);
      expect(mockNotifyAdmin).not.toHaveBeenCalled();
      expect(mockSendAccountEmail).not.toHaveBeenCalled();
    });

    it('fails loudly when the request cannot be recorded', async () => {
      mockDb.recordDeletionRequest.mockRejectedValue(new Error('db down'));
      const { status } = await call();
      expect(status).toBe(500);
    });
  });

  describe('Sign in with Apple', () => {
    it('revokes the fresh authorization code before anything else', async () => {
      mockRevoke.mockResolvedValue({ revoked: true });

      await call({ body: { appleAuthorizationCode: 'code-1', appleClientId: 'ae.youdu.mobile' } });

      expect(mockRevoke).toHaveBeenCalledWith({
        authorizationCode: 'code-1',
        clientId: 'ae.youdu.mobile',
      });
    });

    it('carries on with the deletion when Apple refuses', async () => {
      mockRevoke.mockRejectedValue(new Error('invalid_grant'));

      const { status } = await call({ body: { appleAuthorizationCode: 'expired' } });

      expect(status).toBe(202);
      expect(mockDb.recordDeletionRequest).toHaveBeenCalled();
    });
  });
});
