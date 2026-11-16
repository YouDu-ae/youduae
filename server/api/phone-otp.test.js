process.env.EMAIL_OTP_SECRET = 'test-otp-secret';
process.env.TWILIO_API_KEY_SID = 'SKtest';
process.env.TWILIO_API_KEY_SECRET = 'test-twilio-secret';
process.env.TWILIO_VERIFY_SERVICE_SID = 'VAtest';
process.env.PHONE_SIGNUP = 'on';

const mockClaimSend = jest.fn();
const mockCountAttempt = jest.fn();
const mockIsPhoneTaken = jest.fn();

jest.mock('../db', () => ({
  claimEmailOtpSend: (...args) => mockClaimSend(...args),
  countEmailOtpAttempt: (...args) => mockCountAttempt(...args),
  isPhoneAccountTaken: (...args) => mockIsPhoneTaken(...args),
}));

const {
  phoneSignupConfig,
  sendPhoneOtp,
  verifyPhoneOtp,
  verifyPhoneVerifiedToken,
  normalizePhoneNumber,
} = require('./phone-otp');

const PHONE = '+971501234567';

const call = async (handler, body, query = {}) => {
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
  await handler({ body, query }, res);
  return { status: res.statusCode || 200, body: res.body, headers: res.headers };
};

const twilioReplies = (status, body) =>
  global.fetch.mockResolvedValue({ ok: status < 400, status, json: async () => body });

const twilioRequest = (n = 0) => {
  const [url, options] = global.fetch.mock.calls[n];
  return { url, params: Object.fromEntries(new URLSearchParams(options.body)), options };
};

describe('phone OTP', () => {
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    twilioReplies(201, { status: 'pending' });
    mockClaimSend.mockResolvedValue(0);
    mockCountAttempt.mockResolvedValue(1);
    mockIsPhoneTaken.mockResolvedValue(false);
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    delete global.fetch;
  });

  describe('number format', () => {
    it.each([
      ['+971 50 123 4567', PHONE],
      ['050 123 4567', PHONE],
      ['501234567', PHONE],
      ['971501234567', PHONE],
      ['00971501234567', PHONE],
      ['+9710501234567', PHONE],
      ['+7 (916) 123-45-67', '+79161234567'],
    ])('reads %s as %s', (input, expected) => {
      expect(normalizePhoneNumber(input)).toBe(expected);
    });

    it.each(['', '12345', '+0501234567', 'phone', '0401234567'])('rejects %p', input => {
      expect(normalizePhoneNumber(input)).toBeNull();
    });
  });

  describe('send', () => {
    it('asks Twilio Verify to send a WhatsApp code', async () => {
      const { status, body } = await call(sendPhoneOtp, {
        phoneNumber: '050 123 4567',
        channel: 'whatsapp',
        locale: 'ru',
      });

      expect(status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          challengeToken: expect.any(String),
          phoneNumber: PHONE,
          channel: 'whatsapp',
          resendDelaySeconds: 60,
        })
      );
      const { url, params, options } = twilioRequest();
      expect(url).toBe('https://verify.twilio.com/v2/Services/VAtest/Verifications');
      expect(params).toEqual({ To: PHONE, Channel: 'whatsapp', Locale: 'ru' });
      expect(options.headers.Authorization).toBe(
        `Basic ${Buffer.from('SKtest:test-twilio-secret').toString('base64')}`
      );
    });

    it('counts sends per number and channel', async () => {
      await call(sendPhoneOtp, { phoneNumber: PHONE, channel: 'whatsapp' });
      await call(sendPhoneOtp, { phoneNumber: '0501234567', channel: 'whatsapp' });
      await call(sendPhoneOtp, { phoneNumber: PHONE, channel: 'sms' });

      const [first, second, third] = mockClaimSend.mock.calls;
      expect(first[1]).toEqual({ cooldownSeconds: 60, windowSeconds: 3600, maxPerWindow: 5 });
      expect(second[0]).toBe(first[0]);
      expect(third[0]).not.toBe(first[0]);
      expect(first[0]).not.toContain('501234567');
    });

    it('sends SMS only to UAE mobile numbers', async () => {
      const { status, body } = await call(sendPhoneOtp, {
        phoneNumber: '+79161234567',
        channel: 'sms',
      });

      expect(status).toBe(400);
      expect(body).toEqual({ error: 'smsNotAvailable' });
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockClaimSend).not.toHaveBeenCalled();
    });

    it('sends WhatsApp codes to numbers outside the UAE', async () => {
      const { status } = await call(sendPhoneOtp, {
        phoneNumber: '+79161234567',
        channel: 'whatsapp',
      });

      expect(status).toBe(200);
      expect(twilioRequest().params.To).toBe('+79161234567');
    });

    it('refuses a number that already has an account', async () => {
      mockIsPhoneTaken.mockResolvedValue(true);

      const { status, body } = await call(sendPhoneOtp, {
        phoneNumber: PHONE,
        channel: 'whatsapp',
      });

      expect(status).toBe(409);
      expect(body).toEqual({ error: 'phoneTaken' });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('refuses a code while the number is over its limit', async () => {
      mockClaimSend.mockResolvedValue(42);

      const { status, body, headers } = await call(sendPhoneOtp, {
        phoneNumber: PHONE,
        channel: 'whatsapp',
      });

      expect(status).toBe(429);
      expect(body).toEqual({ error: 'tooManyCodeRequests', retryAfterSeconds: 42 });
      expect(headers['Retry-After']).toBe('42');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('stops SMS when the daily budget is spent', async () => {
      mockClaimSend.mockResolvedValueOnce(0).mockResolvedValueOnce(3600);

      const { status, body } = await call(sendPhoneOtp, { phoneNumber: PHONE, channel: 'sms' });

      expect(status).toBe(503);
      expect(body).toEqual({ error: 'channelUnavailable' });
      expect(mockClaimSend.mock.calls[1][1]).toEqual({
        cooldownSeconds: 0,
        windowSeconds: 86400,
        maxPerWindow: 200,
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does not spend the SMS budget on WhatsApp', async () => {
      await call(sendPhoneOtp, { phoneNumber: PHONE, channel: 'whatsapp' });

      expect(mockClaimSend).toHaveBeenCalledTimes(1);
    });

    it.each([
      [60200, 400, { error: 'invalidPhoneNumber' }],
      [60203, 429, { error: 'tooManyCodeRequests', retryAfterSeconds: 600 }],
      [60223, 503, { error: 'channelUnavailable' }],
      [20003, 502, { error: 'codeSendFailed' }],
    ])('turns Twilio error %i into %i', async (code, expectedStatus, expectedBody) => {
      twilioReplies(400, { code, message: 'Twilio says no' });

      const { status, body } = await call(sendPhoneOtp, {
        phoneNumber: PHONE,
        channel: 'whatsapp',
      });

      expect(status).toBe(expectedStatus);
      expect(body).toEqual(expectedBody);
    });

    it('rejects an unknown channel', async () => {
      const { status, body } = await call(sendPhoneOtp, { phoneNumber: PHONE, channel: 'email' });

      expect(status).toBe(400);
      expect(body).toEqual({ error: 'invalidChannel' });
    });

    it('sends nothing when the limit cannot be checked', async () => {
      mockClaimSend.mockRejectedValue(new Error('database is down'));

      const { status } = await call(sendPhoneOtp, { phoneNumber: PHONE, channel: 'whatsapp' });

      expect(status).toBe(502);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('never writes the full number to the log', async () => {
      await call(sendPhoneOtp, { phoneNumber: PHONE, channel: 'whatsapp' });
      twilioReplies(400, { code: 60200, message: `Invalid parameter To: ${PHONE}` });
      await call(sendPhoneOtp, { phoneNumber: PHONE, channel: 'sms' });

      const logged = [...logSpy.mock.calls, ...errorSpy.mock.calls]
        .map(args =>
          args.map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ')
        )
        .join('\n');
      expect(logged).toContain('+9715******67');
      expect(logged).not.toContain('501234567');
    });
  });

  describe('verify', () => {
    const challenge = async () => {
      const { body } = await call(sendPhoneOtp, { phoneNumber: PHONE, channel: 'whatsapp' });
      global.fetch.mockClear();
      return body.challengeToken;
    };

    it('accepts a code Twilio approves', async () => {
      const challengeToken = await challenge();
      twilioReplies(200, { status: 'approved', valid: true });

      const { status, body } = await call(verifyPhoneOtp, { challengeToken, code: '123456' });

      expect(status).toBe(200);
      expect(body.phoneNumber).toBe(PHONE);
      const { url, params } = twilioRequest();
      expect(url).toBe('https://verify.twilio.com/v2/Services/VAtest/VerificationCheck');
      expect(params).toEqual({ To: PHONE, Code: '123456' });
      await expect(verifyPhoneVerifiedToken(body.verifiedToken)).resolves.toEqual(
        expect.objectContaining({ purpose: 'phone-verified', phone: PHONE })
      );
    });

    it('rejects a code Twilio does not approve', async () => {
      const challengeToken = await challenge();
      twilioReplies(200, { status: 'pending', valid: false });

      const { status, body } = await call(verifyPhoneOtp, { challengeToken, code: '000000' });

      expect(status).toBe(400);
      expect(body).toEqual({ error: 'incorrectCode' });
    });

    it('stops accepting a code after five checks, even the right one', async () => {
      const challengeToken = await challenge();
      mockCountAttempt.mockResolvedValue(6);

      const { status, body } = await call(verifyPhoneOtp, { challengeToken, code: '123456' });

      expect(status).toBe(429);
      expect(body).toEqual({ error: 'tooManyAttempts' });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('reports an expired code', async () => {
      const challengeToken = await challenge();
      twilioReplies(404, { code: 20404, message: 'The requested resource was not found' });

      const { status, body } = await call(verifyPhoneOtp, { challengeToken, code: '123456' });

      expect(status).toBe(400);
      expect(body).toEqual({ error: 'codeExpired' });
    });

    it('rejects the code when attempts cannot be counted', async () => {
      const challengeToken = await challenge();
      mockCountAttempt.mockRejectedValue(new Error('database is down'));

      const { status, body } = await call(verifyPhoneOtp, { challengeToken, code: '123456' });

      expect(status).toBe(500);
      expect(body.verifiedToken).toBeUndefined();
    });

    it('does not count attempts for a token it did not issue', async () => {
      const { status } = await call(verifyPhoneOtp, { challengeToken: 'forged', code: '123456' });

      expect(status).toBe(400);
      expect(mockCountAttempt).not.toHaveBeenCalled();
    });

    it('does not take a code token for a verified number', async () => {
      const challengeToken = await challenge();

      await expect(verifyPhoneVerifiedToken(challengeToken)).rejects.toThrow('invalidTokenPurpose');
    });
  });

  describe('config', () => {
    it('shows phone sign-up when it is on', async () => {
      const { body, headers } = await call(phoneSignupConfig, undefined);

      expect(body).toEqual({ enabled: true, smsCountryCode: '+971' });
      expect(headers['Cache-Control']).toBe('no-store');
    });
  });
});

describe('phone OTP switch', () => {
  const loadWithMode = mode => {
    let handlers;
    jest.isolateModules(() => {
      process.env.PHONE_SIGNUP = mode;
      handlers = require('./phone-otp');
    });
    process.env.PHONE_SIGNUP = 'on';
    return handlers;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('turns everything off by default', async () => {
    const handlers = loadWithMode('');

    const config = await call(handlers.phoneSignupConfig, undefined, { preview: '1' });
    const send = await call(handlers.sendPhoneOtp, { phoneNumber: PHONE, channel: 'whatsapp' });
    const verify = await call(handlers.verifyPhoneOtp, { challengeToken: 'x', code: '123456' });

    expect(config.body.enabled).toBe(false);
    expect(send.status).toBe(404);
    expect(verify.status).toBe(404);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows the preview only to links that ask for it', async () => {
    const handlers = loadWithMode('preview');

    const plain = await call(handlers.phoneSignupConfig, undefined, {});
    const preview = await call(handlers.phoneSignupConfig, undefined, { preview: '1' });

    expect(plain.body.enabled).toBe(false);
    expect(preview.body.enabled).toBe(true);
  });
});
