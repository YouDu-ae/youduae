const crypto = require('crypto');
const { SignJWT, jwtVerify } = require('jose');
const { claimEmailOtpSend, countEmailOtpAttempt, isPhoneAccountTaken } = require('../db');

const encodeText = str => {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  const { TextEncoder: NodeTextEncoder } = require('util');
  return new NodeTextEncoder().encode(str);
};

const {
  TWILIO_API_KEY_SID: apiKeySid,
  TWILIO_API_KEY_SECRET: apiKeySecret,
  TWILIO_VERIFY_SERVICE_SID: verifyServiceSid,
  EMAIL_OTP_SECRET: otpSecret,
  EMAIL_OTP_VERIFIED_TTL_SECONDS,
  PHONE_SIGNUP,
  PHONE_OTP_SMS_DAILY_LIMIT,
} = process.env;

// 'off' hides phone sign-up, 'preview' shows it only on /signup?phoneSignupPreview=1.
const signupMode = ['on', 'preview'].includes(PHONE_SIGNUP) ? PHONE_SIGNUP : 'off';

// Twilio Verify keeps a code valid for ten minutes.
const CODE_TTL_SECONDS = 10 * 60;
const RESEND_COOLDOWN_SECONDS = 60;
const SEND_WINDOW_SECONDS = 60 * 60;
const MAX_SENDS_PER_WINDOW = 5;
const MAX_VERIFY_ATTEMPTS = 5;
const SMS_BUDGET_WINDOW_SECONDS = 24 * 60 * 60;
const TWILIO_TIMEOUT_MS = 15000;
const CHANNELS = ['whatsapp', 'sms'];
const SMS_COUNTRY_CODE = '+971';

const smsDailyLimit = Number(PHONE_OTP_SMS_DAILY_LIMIT || 200);
const verifiedTtlSeconds = Number(EMAIL_OTP_VERIFIED_TTL_SECONDS || 1800);

const signingKey = otpSecret ? encodeText(otpSecret) : null;

const requiredConfig = [
  'TWILIO_API_KEY_SID',
  'TWILIO_API_KEY_SECRET',
  'TWILIO_VERIFY_SERVICE_SID',
  'EMAIL_OTP_SECRET',
];

const isConfigured = requiredConfig.every(key => !!process.env[key]);

const configurationError = () => {
  console.error('Phone OTP configuration missing. Required env vars:', requiredConfig.join(', '));
  return {
    status: 500,
    body: {
      error: 'otpConfigurationMissing',
      message: 'Phone verification is not configured.',
    },
  };
};

const disabledError = { error: 'phoneSignupDisabled' };

/**
 * Brings a number to E.164. A number without a country code is taken for a UAE
 * mobile written the local way: 050 123 4567 or 50 123 4567.
 */
const normalizePhoneNumber = value => {
  if (typeof value !== 'string') return null;
  let number = value.replace(/[\s().-]/g, '');
  if (number.startsWith('00')) {
    number = `+${number.slice(2)}`;
  }
  if (!number.startsWith('+')) {
    const uaeMobile = number.match(/^(?:971)?0?(5\d{8})$/);
    if (!uaeMobile) return null;
    number = `+971${uaeMobile[1]}`;
  }
  number = number.replace(/^\+9710/, '+971');
  return /^\+[1-9]\d{7,14}$/.test(number) ? number : null;
};

const isUaeMobile = phone => /^\+9715\d{8}$/.test(phone);

const keyedHash = value =>
  crypto
    .createHmac('sha256', otpSecret)
    .update(value)
    .digest('base64url');

const sendLimitKey = (phone, channel) => keyedHash(`send-phone:${channel}:${phone}`);

const smsBudgetKey = () => keyedHash(`sms-budget:${new Date().toISOString().slice(0, 10)}`);

// Rotating EMAIL_OTP_SECRET changes every key, which frees every number held in
// phone_accounts.
const phoneAccountKey = phone => keyedHash(`account-phone:${phone}`);

/** Mask a number for logs: +9715*****67 */
const maskPhone = phone =>
  typeof phone === 'string' && phone.length > 7
    ? `${phone.slice(0, 5)}${'*'.repeat(phone.length - 7)}${phone.slice(-2)}`
    : '(none)';

// Twilio error messages can quote the number they were given.
const scrubNumbers = text => String(text || '').replace(/\+?\d[\d\s()-]{6,}\d/g, '[number]');

const logPhoneOtpEvent = (level, event, details = {}) => {
  const payload = {
    event,
    ...details,
    phone: details.phone ? maskPhone(details.phone) : undefined,
    at: new Date().toISOString(),
  };
  if (level === 'error') {
    console.error('[phone-otp]', JSON.stringify(payload));
  } else {
    console.log('[phone-otp]', JSON.stringify(payload));
  }
};

const signJwt = async (payload, expiresInSeconds) => {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + expiresInSeconds)
    .setJti(crypto.randomUUID())
    .sign(signingKey);
};

const verifyJwt = async token => {
  return jwtVerify(token, signingKey, {
    algorithms: ['HS256'],
  });
};

const twilioLocale = locale => {
  const language = typeof locale === 'string' ? locale.slice(0, 2).toLowerCase() : '';
  return ['ru', 'ar', 'en'].includes(language) ? language : 'en';
};

const twilioVerify = async (resource, params) => {
  const credentials = Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString('base64');
  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${verifyServiceSid}/${resource}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(TWILIO_TIMEOUT_MS),
    }
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || `Twilio Verify responded ${response.status}`);
    error.status = response.status;
    error.twilioCode = body.code;
    throw error;
  }
  return body;
};

// Codes are listed at https://www.twilio.com/docs/api/errors
const sendFailure = error => {
  switch (error.twilioCode) {
    case 60200:
      return { status: 400, body: { error: 'invalidPhoneNumber' } };
    case 60203:
      return { status: 429, body: { error: 'tooManyCodeRequests', retryAfterSeconds: 600 } };
    case 60205:
      return { status: 400, body: { error: 'smsNotAvailable' } };
    case 60223:
    case 60410:
    case 60605:
      return { status: 503, body: { error: 'channelUnavailable' } };
    default:
      return { status: 502, body: { error: 'codeSendFailed' } };
  }
};

const checkFailure = error => {
  if (error.status === 404) {
    return { status: 400, body: { error: 'codeExpired' } };
  }
  if (error.twilioCode === 60202) {
    return { status: 429, body: { error: 'tooManyAttempts' } };
  }
  return { status: error.status ? 502 : 500, body: { error: 'verificationFailed' } };
};

const phoneSignupConfig = (req, res) => {
  const preview = req.query?.preview === '1';
  res.set('Cache-Control', 'no-store');
  res.json({
    enabled: isConfigured && (signupMode === 'on' || (signupMode === 'preview' && preview)),
    smsCountryCode: SMS_COUNTRY_CODE,
  });
};

const sendPhoneOtp = async (req, res) => {
  if (signupMode === 'off') {
    res.status(404).json(disabledError);
    return;
  }
  if (!isConfigured) {
    const { status, body } = configurationError();
    logPhoneOtpEvent('error', 'otp_send_config_missing');
    res.status(status).json(body);
    return;
  }

  const { phoneNumber, channel, locale } = req.body || {};
  const phone = normalizePhoneNumber(phoneNumber);

  try {
    if (!phone) {
      logPhoneOtpEvent('error', 'otp_send_invalid_phone');
      res.status(400).json({ error: 'invalidPhoneNumber' });
      return;
    }
    if (!CHANNELS.includes(channel)) {
      res.status(400).json({ error: 'invalidChannel' });
      return;
    }
    if (channel === 'sms' && !isUaeMobile(phone)) {
      logPhoneOtpEvent('info', 'otp_send_sms_not_available', { phone });
      res.status(400).json({ error: 'smsNotAvailable' });
      return;
    }

    logPhoneOtpEvent('info', 'otp_send_requested', { phone, channel, locale });

    const waitSeconds = await claimEmailOtpSend(sendLimitKey(phone, channel), {
      cooldownSeconds: RESEND_COOLDOWN_SECONDS,
      windowSeconds: SEND_WINDOW_SECONDS,
      maxPerWindow: MAX_SENDS_PER_WINDOW,
    });
    if (waitSeconds > 0) {
      logPhoneOtpEvent('info', 'otp_send_limited', { phone, channel, waitSeconds });
      res.set('Retry-After', String(waitSeconds));
      res.status(429).json({ error: 'tooManyCodeRequests', retryAfterSeconds: waitSeconds });
      return;
    }

    if (await isPhoneAccountTaken(phoneAccountKey(phone))) {
      logPhoneOtpEvent('info', 'otp_send_phone_taken', { phone });
      res.status(409).json({ error: 'phoneTaken' });
      return;
    }

    if (channel === 'sms') {
      const budgetWait = await claimEmailOtpSend(smsBudgetKey(), {
        cooldownSeconds: 0,
        windowSeconds: SMS_BUDGET_WINDOW_SECONDS,
        maxPerWindow: smsDailyLimit,
      });
      if (budgetWait > 0) {
        logPhoneOtpEvent('error', 'otp_send_sms_budget_spent', { limit: smsDailyLimit });
        res.status(503).json({ error: 'channelUnavailable' });
        return;
      }
    }

    await twilioVerify('Verifications', {
      To: phone,
      Channel: channel,
      Locale: twilioLocale(locale),
    });

    const challengeToken = await signJwt(
      { purpose: 'phone-otp', phone, channel },
      CODE_TTL_SECONDS
    );

    logPhoneOtpEvent('info', 'otp_send_success', { phone, channel });

    res.json({
      success: true,
      challengeToken,
      phoneNumber: phone,
      channel,
      expiresAt: new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString(),
      resendDelaySeconds: RESEND_COOLDOWN_SECONDS,
    });
  } catch (e) {
    const { status, body } = sendFailure(e);
    logPhoneOtpEvent('error', 'otp_send_failed', {
      phone,
      channel,
      message: scrubNumbers(e.message),
      twilioStatus: e.status,
      twilioCode: e.twilioCode,
    });
    if (body.retryAfterSeconds) {
      res.set('Retry-After', String(body.retryAfterSeconds));
    }
    res.status(status).json(body);
  }
};

const verifyPhoneOtp = async (req, res) => {
  if (signupMode === 'off') {
    res.status(404).json(disabledError);
    return;
  }
  if (!isConfigured) {
    const { status, body } = configurationError();
    logPhoneOtpEvent('error', 'otp_verify_config_missing');
    res.status(status).json(body);
    return;
  }

  const { challengeToken, code } = req.body || {};

  if (!challengeToken || !code) {
    logPhoneOtpEvent('error', 'otp_verify_missing_params');
    res.status(400).json({ error: 'missingParameters' });
    return;
  }

  let payload;
  try {
    const verified = await verifyJwt(challengeToken);
    payload = verified.payload;
  } catch (e) {
    logPhoneOtpEvent('error', 'otp_verify_invalid_or_expired_token');
    res.status(400).json({ error: 'invalidOrExpiredToken' });
    return;
  }

  if (payload.purpose !== 'phone-otp' || !payload.phone) {
    logPhoneOtpEvent('error', 'otp_verify_invalid_purpose');
    res.status(400).json({ error: 'invalidTokenPurpose' });
    return;
  }

  try {
    const attempts = await countEmailOtpAttempt(payload.jti, new Date(payload.exp * 1000));
    if (attempts > MAX_VERIFY_ATTEMPTS) {
      logPhoneOtpEvent('error', 'otp_verify_too_many_attempts', { phone: payload.phone });
      res.status(429).json({ error: 'tooManyAttempts' });
      return;
    }

    const normalizedCode = String(code).trim();
    if (!/^\d{4,10}$/.test(normalizedCode)) {
      res.status(400).json({ error: 'incorrectCode' });
      return;
    }

    const check = await twilioVerify('VerificationCheck', {
      To: payload.phone,
      Code: normalizedCode,
    });
    if (check.status !== 'approved') {
      logPhoneOtpEvent('error', 'otp_verify_incorrect_code', { phone: payload.phone });
      res.status(400).json({ error: 'incorrectCode' });
      return;
    }

    const verifiedToken = await signJwt(
      { purpose: 'phone-verified', phone: payload.phone },
      verifiedTtlSeconds
    );

    logPhoneOtpEvent('info', 'otp_verify_success', {
      phone: payload.phone,
      channel: payload.channel,
    });

    res.json({
      success: true,
      phoneNumber: payload.phone,
      verifiedToken,
      expiresAt: new Date(Date.now() + verifiedTtlSeconds * 1000).toISOString(),
    });
  } catch (e) {
    const { status, body } = checkFailure(e);
    logPhoneOtpEvent('error', 'otp_verify_failed', {
      phone: payload.phone,
      message: scrubNumbers(e.message),
      twilioStatus: e.status,
      twilioCode: e.twilioCode,
    });
    res.status(status).json(body);
  }
};

const verifyPhoneVerifiedToken = async verifiedToken => {
  if (!isConfigured) {
    throw new Error('otpConfigurationMissing');
  }
  if (!verifiedToken) {
    throw new Error('missingToken');
  }

  let payload;
  try {
    const verified = await verifyJwt(verifiedToken);
    payload = verified.payload;
  } catch (e) {
    throw new Error('invalidOrExpiredToken');
  }

  if (payload.purpose !== 'phone-verified' || !payload.phone) {
    throw new Error('invalidTokenPurpose');
  }

  return payload;
};

module.exports = {
  phoneSignupConfig,
  sendPhoneOtp,
  verifyPhoneOtp,
  verifyPhoneVerifiedToken,
  phoneAccountKey,
  normalizePhoneNumber,
};
