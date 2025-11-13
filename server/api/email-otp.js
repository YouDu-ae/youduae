const crypto = require('crypto');
const { SignJWT, jwtVerify } = require('jose');
const sgMail = require('@sendgrid/mail');

const encodeText = str => {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  const { TextEncoder: NodeTextEncoder } = require('util');
  return new NodeTextEncoder().encode(str);
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const {
  SENDGRID_API_KEY: sendgridApiKey,
  SENDGRID_FROM_EMAIL: fromEmail,
  SENDGRID_FROM_NAME: fromNameEnv,
  EMAIL_OTP_SECRET: otpSecret,
  EMAIL_OTP_TTL_SECONDS,
  EMAIL_OTP_RESEND_SECONDS,
  EMAIL_OTP_VERIFIED_TTL_SECONDS,
} = process.env;

const otpTtlSeconds = Number(EMAIL_OTP_TTL_SECONDS || 600);
const resendCooldownSeconds = Number(EMAIL_OTP_RESEND_SECONDS || 60);
const verifiedTtlSeconds = Number(EMAIL_OTP_VERIFIED_TTL_SECONDS || 1800);
const fromName = fromNameEnv || 'YouDu';
const defaultFromEmail = fromEmail || 'noreply@mail.youdu.ae';

// Initialize SendGrid
if (sendgridApiKey) {
  sgMail.setApiKey(sendgridApiKey);
}

const signingKey = otpSecret ? encodeText(otpSecret) : null;

const requiredConfig = ['SENDGRID_API_KEY', 'EMAIL_OTP_SECRET'];

const isConfigured = requiredConfig.every(key => !!process.env[key]);

const configurationError = () => {
  console.error('Email OTP configuration missing. Required env vars:', requiredConfig.join(', '));
  return {
    status: 500,
    body: {
      error: 'otpConfigurationMissing',
      message: 'Email verification is not configured.',
    },
  };
};

const hashCode = code => {
  const hmac = crypto.createHmac('sha256', otpSecret);
  hmac.update(code);
  return hmac.digest('base64url');
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

const generateCode = () => {
  const buffer = crypto.randomBytes(4);
  const num = buffer.readUInt32BE(0) % 1000000;
  return num.toString().padStart(6, '0');
};

const buildEmailBody = (code, locale) => {
  const isRu = typeof locale === 'string' && locale.toLowerCase().startsWith('ru');
  const subject = isRu ? 'YouDu: код подтверждения' : 'YouDu verification code';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;background-color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <tr>
      <td style="padding:40px 32px;text-align:center;">
        <h1 style="margin:0 0 24px 0;font-size:24px;font-weight:600;color:#0c0c0c;">${fromName}</h1>
        <p style="margin:0 0 16px 0;font-size:16px;line-height:24px;color:#333;">
          ${isRu ? 'Ваш код подтверждения:' : 'Your verification code:'}
        </p>
        <div style="background:#f0f0f0;border-radius:8px;padding:24px;margin:16px 0;">
          <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0c0c0c;">${code}</span>
        </div>
        <p style="margin:16px 0 0 0;font-size:14px;line-height:20px;color:#666;">
          ${isRu ? 'Код действителен 10 минут. Если вы не запрашивали авторизацию, просто проигнорируйте это письмо.' : 'The code is valid for 10 minutes. If you didn\'t request this, you can safely ignore this email.'}
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px;text-align:center;border-top:1px solid #e0e0e0;background:#fafafa;border-radius:0 0 8px 8px;">
        <p style="margin:0;font-size:13px;color:#999;">© ${new Date().getFullYear()} ${fromName}. ${isRu ? 'Все права защищены.' : 'All rights reserved.'}</p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const text = `${isRu ? 'Ваш код подтверждения YouDu:' : 'Your YouDu verification code:'} ${code}\n\n${isRu ? 'Код действителен 10 минут.' : 'The code is valid for 10 minutes.'}`;

  return { subject, html, text };
};

const sendEmailViaSendGrid = async (email, html, text, subject) => {
  const msg = {
    to: email,
    from: {
      email: defaultFromEmail,
      name: fromName,
    },
    subject,
    text,
    html,
  };

  try {
    const response = await sgMail.send(msg);
    console.log('✅ Email sent successfully via SendGrid:', {
      recipient: email,
      statusCode: response[0]?.statusCode,
      messageId: response[0]?.headers?.['x-message-id'],
    });
    return response;
  } catch (error) {
    console.error('❌ SendGrid send error:', {
      message: error.message,
      code: error.code,
      response: error.response?.body,
    });
    throw new Error(`SendGrid email send failed: ${error.message}`);
  }
};

const sendEmailOtp = async (req, res) => {
  try {
    if (!isConfigured) {
      const { status, body } = configurationError();
      res.status(status).json(body);
      return;
    }

    const { email, locale } = req.body || {};

    if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
      res.status(400).json({ error: 'invalidEmail' });
      return;
    }

    const code = generateCode();
    const codeHash = hashCode(code);
    const challengeToken = await signJwt(
      {
        purpose: 'email-otp',
        email,
        codeHash,
      },
      otpTtlSeconds
    );

    const { subject, html, text } = buildEmailBody(code, locale);

    await sendEmailViaSendGrid(email, html, text, subject);

    res.json({
      success: true,
      challengeToken,
      expiresAt: new Date(Date.now() + otpTtlSeconds * 1000).toISOString(),
      resendDelaySeconds: resendCooldownSeconds,
    });
  } catch (e) {
    console.error('Failed to send email OTP:', e);
    res.status(502).json({ error: 'emailSendFailed' });
  }
};

const verifyEmailOtp = async (req, res) => {
  try {
    if (!isConfigured) {
      const { status, body } = configurationError();
      res.status(status).json(body);
      return;
    }

    const { challengeToken, code } = req.body || {};

    if (!challengeToken || !code) {
      res.status(400).json({ error: 'missingParameters' });
      return;
    }

    let payload;
    try {
      const verified = await verifyJwt(challengeToken);
      payload = verified.payload;
    } catch (e) {
      res.status(400).json({ error: 'invalidOrExpiredToken' });
      return;
    }

    if (payload.purpose !== 'email-otp') {
      res.status(400).json({ error: 'invalidTokenPurpose' });
      return;
    }

    const inputCodeHash = hashCode(code);
    if (inputCodeHash !== payload.codeHash) {
      res.status(400).json({ error: 'incorrectCode' });
      return;
    }

    const verifiedToken = await signJwt(
      {
        purpose: 'email-verified',
        email: payload.email,
      },
      verifiedTtlSeconds
    );

    res.json({
      success: true,
      email: payload.email,
      verifiedToken,
      expiresAt: new Date(Date.now() + verifiedTtlSeconds * 1000).toISOString(),
    });
  } catch (e) {
    console.error('Failed to verify email OTP:', e);
    res.status(500).json({ error: 'verificationFailed' });
  }
};

const assertEmailVerified = async (req, res) => {
  try {
    if (!isConfigured) {
      const { status, body } = configurationError();
      res.status(status).json(body);
      return;
    }

    const { verifiedToken } = req.body || {};

    if (!verifiedToken) {
      res.status(400).json({ error: 'missingToken', verified: false });
      return;
    }

    let payload;
    try {
      const verified = await verifyJwt(verifiedToken);
      payload = verified.payload;
    } catch (e) {
      res.status(400).json({ error: 'invalidOrExpiredToken', verified: false });
      return;
    }

    if (payload.purpose !== 'email-verified') {
      res.status(400).json({ error: 'invalidTokenPurpose', verified: false });
      return;
    }

    res.json({
      verified: true,
      email: payload.email,
    });
  } catch (e) {
    console.error('Failed to assert email verification:', e);
    res.status(500).json({ error: 'assertionFailed', verified: false });
  }
};

module.exports = {
  sendEmailOtp,
  verifyEmailOtp,
  assertEmailVerified,
};

