/**
 * Rate limiters for the custom API routes.
 *
 * Limits are deliberately generous: mobile carriers in the UAE put many users
 * behind a single NAT address, so a strict per-IP budget would lock out real
 * visitors before it stopped a bot. The goal here is to cap runaway clients and
 * scripted abuse, not to shape normal traffic.
 */

const rateLimit = require('express-rate-limit');

const MINUTE = 60 * 1000;

/**
 * Heroku's router appends the originating client address to X-Forwarded-For,
 * so the last entry is the one value a client cannot spoof. The app sets
 * `trust proxy` permissively, which would otherwise make Express read the
 * left-most (client-supplied) entry.
 */
const clientIp = req => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    const parts = forwarded.split(',');
    const last = parts[parts.length - 1].trim();
    if (last) {
      return last;
    }
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
};

const createLimiter = ({ windowMs, limit, message, skip }) =>
  rateLimit({
    windowMs,
    limit,
    skip,
    keyGenerator: clientIp,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Custom keyGenerator handles the proxy chain, so the built-in checks for
    // permissive trust-proxy settings and IP fallbacks do not apply.
    validate: { trustProxy: false, keyGeneratorIpFallback: false, xForwardedForHeader: false },
    handler: (req, res) => {
      console.warn(`🚫 Rate limit hit: ${clientIp(req)} ${req.method} ${req.originalUrl}`);
      res.status(429).json({ error: message });
    },
  });

// Webhooks are called by Telegram's servers, not by browsers, and their volume
// is driven by bot activity rather than by visitors.
const isWebhook = req => req.path.includes('/webhook');

/** Broad backstop for every custom endpoint. Roughly two requests per second. */
const apiLimiter = createLimiter({
  windowMs: 5 * MINUTE,
  limit: 600,
  message: 'Слишком много запросов. Попробуйте через несколько минут.',
  skip: isWebhook,
});

/**
 * Endpoints that fan out to several Sharetribe calls. These are cached, so a
 * legitimate visitor rarely reaches the upstream API at all.
 */
const expensiveLimiter = createLimiter({
  windowMs: 5 * MINUTE,
  limit: 60,
  message: 'Слишком много запросов к поиску. Подождите немного.',
});

/** Endpoints that write data, send messages, or cost money per call. */
const writeLimiter = createLimiter({
  windowMs: 10 * MINUTE,
  limit: 30,
  message: 'Слишком много попыток. Подождите несколько минут.',
});

/** Google Places is billed per request. */
const placesLimiter = createLimiter({
  windowMs: 5 * MINUTE,
  limit: 150,
  message: 'Слишком много запросов к поиску адреса.',
});

module.exports = {
  apiLimiter,
  expensiveLimiter,
  writeLimiter,
  placesLimiter,
  clientIp,
};
