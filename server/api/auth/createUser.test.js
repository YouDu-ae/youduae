process.env.EMAIL_OTP_SECRET = 'test-otp-secret';
process.env.SENDGRID_API_KEY = 'test-sendgrid-key';
process.env.TWILIO_API_KEY_SID = 'SKtest';
process.env.TWILIO_API_KEY_SECRET = 'test-twilio-secret';
process.env.TWILIO_VERIFY_SERVICE_SID = 'VAtest';
process.env.INTEGRATION_API_CLIENT_ID = 'integration-client';
process.env.INTEGRATION_API_CLIENT_SECRET = 'integration-secret';

const { SignJWT } = require('jose');

const mockCreate = jest.fn();
const mockLogin = jest.fn();
const mockUpdateProfile = jest.fn();
const mockShowUser = jest.fn();
const mockVerifyEmail = jest.fn();
const mockReserve = jest.fn();
const mockBind = jest.fn();
const mockRelease = jest.fn();

jest.mock('sharetribe-flex-sdk', () => {
  const actual = jest.requireActual('sharetribe-flex-sdk');
  return {
    ...actual,
    tokenStore: { ...actual.tokenStore, expressCookieStore: () => ({}) },
    createInstance: () => ({
      currentUser: { create: (...args) => mockCreate(...args) },
      login: (...args) => mockLogin(...args),
    }),
  };
});
jest.mock('sharetribe-flex-integration-sdk', () => {
  const actual = jest.requireActual('sharetribe-flex-integration-sdk');
  return {
    ...actual,
    createInstance: () => ({
      users: {
        updateProfile: (...args) => mockUpdateProfile(...args),
        show: (...args) => mockShowUser(...args),
        verifyEmail: (...args) => mockVerifyEmail(...args),
      },
    }),
  };
});
jest.mock('../../db', () => ({
  reservePhoneAccount: (...args) => mockReserve(...args),
  bindPhoneAccount: (...args) => mockBind(...args),
  releasePhoneReservation: (...args) => mockRelease(...args),
}));
jest.mock('@sendgrid/mail', () => ({ setApiKey: jest.fn(), send: jest.fn() }));
jest.mock('../../api-util/sdk', () => ({
  handleError: (res, e) => res.status(e?.status || 500).end(),
  serialize: value => JSON.stringify(value),
  typeHandlers: [],
}));

const createUser = require('./createUser');
const { phoneAccountKey } = require('../phone-otp');

const PHONE = '+971501234567';

const signToken = payload =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .setJti('test-token')
    .sign(new TextEncoder().encode('test-otp-secret'));

const call = async body => {
  const res = {
    status: jest.fn(code => {
      res.statusCode = code;
      return res;
    }),
    set: jest.fn(() => res),
    send: jest.fn(() => res),
    json: jest.fn(data => {
      res.body = data;
      return res;
    }),
    end: jest.fn(() => res),
  };
  await createUser({ body }, res);
  return res;
};

const signupBody = async (overrides = {}) => ({
  phoneVerifiedToken: await signToken({ purpose: 'phone-verified', phone: PHONE }),
  email: 'New.Person@Example.com',
  password: 'long-enough-password',
  firstName: 'New',
  lastName: 'Person',
  protectedData: { phoneNumber: '+971500000000', terms: ['tos-and-privacy-accepted'] },
  ...overrides,
});

describe('createUser', () => {
  let errorSpy;
  let warnSpy;
  let logSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    // createUser races every Sharetribe call against a 90 s timer it never clears.
    jest.useFakeTimers();
    mockCreate.mockResolvedValue({ status: 200, data: { data: { id: { uuid: 'user-1' } } } });
    mockLogin.mockResolvedValue({ status: 200, statusText: 'OK', data: { access_token: 'a' } });
    mockUpdateProfile.mockResolvedValue({});
    mockShowUser.mockResolvedValue({
      data: { data: { id: 'user-1', attributes: { emailVerified: false, email: 'x' } } },
    });
    mockVerifyEmail.mockResolvedValue({});
    mockReserve.mockResolvedValue(true);
    mockBind.mockResolvedValue();
    mockRelease.mockResolvedValue();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  describe('with a verified phone number', () => {
    it('creates the account with that number and ties the number to it', async () => {
      const res = await call(await signupBody());

      expect(res.statusCode).toBe(200);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new.person@example.com',
          protectedData: { phoneNumber: PHONE, terms: ['tos-and-privacy-accepted'] },
        })
      );
      const key = phoneAccountKey(PHONE);
      expect(mockReserve).toHaveBeenCalledWith(key);
      expect(mockBind).toHaveBeenCalledWith(key, 'user-1');
      const [params] = mockUpdateProfile.mock.calls[0];
      expect(params.id.uuid).toBe('user-1');
      expect(params.metadata).toEqual({ phoneVerified: true });
      expect(mockVerifyEmail).not.toHaveBeenCalled();
      expect(mockRelease).not.toHaveBeenCalled();
    });

    it('refuses a number that already has an account', async () => {
      mockReserve.mockResolvedValue(false);

      const res = await call(await signupBody());

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toBe('phoneTaken');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('lets go of the number when Sharetribe refuses the account', async () => {
      mockCreate.mockRejectedValue({
        status: 409,
        statusText: 'Conflict',
        data: { errors: [{ code: 'email-taken' }] },
      });

      const res = await call(await signupBody());

      expect(res.statusCode).toBe(409);
      expect(mockRelease).toHaveBeenCalledWith(phoneAccountKey(PHONE));
      expect(mockBind).not.toHaveBeenCalled();
    });

    it('creates nothing when the number cannot be checked', async () => {
      mockReserve.mockRejectedValue(new Error('database is down'));

      const res = await call(await signupBody());

      expect(res.statusCode).toBe(503);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('rejects a token it did not issue', async () => {
      const res = await call(await signupBody({ phoneVerifiedToken: 'forged' }));

      expect(res.statusCode).toBe(400);
      expect(mockReserve).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('does not take a code token for a verified number', async () => {
      const codeToken = await signToken({ purpose: 'phone-otp', phone: PHONE });

      const res = await call(await signupBody({ phoneVerifiedToken: codeToken }));

      expect(res.statusCode).toBe(400);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('with a verified email', () => {
    it('still signs up the way app 1.0.1 does', async () => {
      const verifiedToken = await signToken({
        purpose: 'email-verified',
        email: 'new.person@example.com',
      });

      const res = await call(await signupBody({ phoneVerifiedToken: undefined, verifiedToken }));

      expect(res.statusCode).toBe(200);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          protectedData: { phoneNumber: '+971500000000', terms: ['tos-and-privacy-accepted'] },
        })
      );
      expect(mockVerifyEmail).toHaveBeenCalled();
      expect(mockReserve).not.toHaveBeenCalled();
      expect(mockUpdateProfile).not.toHaveBeenCalled();
    });

    it('rejects a token for another address', async () => {
      const verifiedToken = await signToken({
        purpose: 'email-verified',
        email: 'someone.else@example.com',
      });

      const res = await call(await signupBody({ phoneVerifiedToken: undefined, verifiedToken }));

      expect(res.statusCode).toBe(400);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});
