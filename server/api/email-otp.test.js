process.env.SENDGRID_API_KEY = 'test-sendgrid-key';
process.env.EMAIL_OTP_SECRET = 'test-otp-secret';

const mockSend = jest.fn();
const mockClaimSend = jest.fn();
const mockCountAttempt = jest.fn();

jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: (...args) => mockSend(...args),
}));
jest.mock('../db', () => ({
  claimEmailOtpSend: (...args) => mockClaimSend(...args),
  countEmailOtpAttempt: (...args) => mockCountAttempt(...args),
}));

const { sendEmailOtp, verifyEmailOtp } = require('./email-otp');

const EMAIL = 'person@example.com';

const call = async (handler, body) => {
  const res = {
    headers: {},
    set: jest.fn((name, value) => {
      res.headers[name] = value;
      return res;
    }),
    status: jest.fn(code => {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn(data => {
      res.body = data;
      return res;
    }),
  };
  await handler({ body }, res);
  return { status: res.statusCode || 200, body: res.body, headers: res.headers };
};

const sentCode = () =>
  mockSend.mock.calls[mockSend.mock.calls.length - 1][0].text.match(/\d{6}/)[0];

describe('email OTP', () => {
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue([{ statusCode: 202, headers: { 'x-message-id': 'm1' } }]);
    mockClaimSend.mockResolvedValue(0);
    mockCountAttempt.mockResolvedValue(1);
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('send', () => {
    it('sends a code and counts it against the address', async () => {
      const { status, body } = await call(sendEmailOtp, { email: EMAIL, locale: 'ru' });

      expect(status).toBe(200);
      expect(body.challengeToken).toEqual(expect.any(String));
      expect(body.resendDelaySeconds).toBe(60);
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockClaimSend).toHaveBeenCalledWith(expect.any(String), {
        cooldownSeconds: 60,
        windowSeconds: 3600,
        maxPerWindow: 5,
      });
    });

    it('counts one address however it is capitalised', async () => {
      await call(sendEmailOtp, { email: EMAIL });
      await call(sendEmailOtp, { email: 'Person@Example.COM' });

      const [first, second] = mockClaimSend.mock.calls.map(([key]) => key);
      expect(second).toBe(first);
      expect(first).not.toContain('person');
    });

    it('refuses a code while the address is over its limit', async () => {
      mockClaimSend.mockResolvedValue(42);

      const { status, body, headers } = await call(sendEmailOtp, { email: EMAIL });

      expect(status).toBe(429);
      expect(body).toEqual({ error: 'tooManyCodeRequests', retryAfterSeconds: 42 });
      expect(headers['Retry-After']).toBe('42');
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('sends nothing when the limit cannot be checked', async () => {
      mockClaimSend.mockRejectedValue(new Error('database is down'));

      const { status } = await call(sendEmailOtp, { email: EMAIL });

      expect(status).toBe(502);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('does not check limits for an invalid address', async () => {
      const { status, body } = await call(sendEmailOtp, { email: 'not-an-email' });

      expect(status).toBe(400);
      expect(body).toEqual({ error: 'invalidEmail' });
      expect(mockClaimSend).not.toHaveBeenCalled();
    });

    it('never writes the full address to the log', async () => {
      await call(sendEmailOtp, { email: EMAIL });

      const logged = [...logSpy.mock.calls, ...errorSpy.mock.calls]
        .map(args =>
          args.map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ')
        )
        .join('\n');
      expect(logged).toContain('pe***@example.com');
      expect(logged).not.toContain(EMAIL);
    });
  });

  describe('verify', () => {
    const challenge = async () => {
      const { body } = await call(sendEmailOtp, { email: EMAIL });
      return { challengeToken: body.challengeToken, code: sentCode() };
    };

    it('accepts the right code', async () => {
      const { challengeToken, code } = await challenge();

      const { status, body } = await call(verifyEmailOtp, { challengeToken, code });

      expect(status).toBe(200);
      expect(body.email).toBe(EMAIL);
      expect(body.verifiedToken).toEqual(expect.any(String));
    });

    it('counts every check against the code it was sent with', async () => {
      const { challengeToken, code } = await challenge();
      const wrong = code === '000000' ? '111111' : '000000';

      const { status, body } = await call(verifyEmailOtp, { challengeToken, code: wrong });

      expect(status).toBe(400);
      expect(body).toEqual({ error: 'incorrectCode' });
      const [challengeId, expiresAt] = mockCountAttempt.mock.calls[0];
      expect(challengeId).toEqual(expect.any(String));
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + 9 * 60 * 1000);
    });

    it('allows five checks per code', async () => {
      const { challengeToken, code } = await challenge();
      mockCountAttempt.mockResolvedValue(5);

      const { status } = await call(verifyEmailOtp, { challengeToken, code });

      expect(status).toBe(200);
    });

    it('stops accepting a code after five checks, even the right one', async () => {
      const { challengeToken, code } = await challenge();
      mockCountAttempt.mockResolvedValue(6);

      const { status, body } = await call(verifyEmailOtp, { challengeToken, code });

      expect(status).toBe(429);
      expect(body).toEqual({ error: 'tooManyAttempts' });
    });

    it('rejects the code when attempts cannot be counted', async () => {
      const { challengeToken, code } = await challenge();
      mockCountAttempt.mockRejectedValue(new Error('database is down'));

      const { status, body } = await call(verifyEmailOtp, { challengeToken, code });

      expect(status).toBe(500);
      expect(body.verifiedToken).toBeUndefined();
    });

    it('does not count attempts for a token it did not issue', async () => {
      const { status } = await call(verifyEmailOtp, { challengeToken: 'forged', code: '123456' });

      expect(status).toBe(400);
      expect(mockCountAttempt).not.toHaveBeenCalled();
    });
  });
});
