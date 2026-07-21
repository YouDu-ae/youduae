/**
 * Reverse proxy: browser → youdu.ae/api/st/* → flex-api.sharetribe.com/*
 *
 * Needed when clients cannot reliably reach flex-api.sharetribe.com (timeouts / ERR_NETWORK).
 * Mount BEFORE bodyParser and compression so the raw request body streams correctly.
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

const SHARETRIBE_API_ORIGIN =
  process.env.SHARETRIBE_API_PROXY_TARGET || 'https://flex-api.sharetribe.com';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

const agent = new https.Agent({ keepAlive: true, maxSockets: 50 });

const buildTargetPath = originalUrl => {
  // /api/st/v1/api/current_user/show?... → /v1/api/current_user/show?...
  const stripped = originalUrl.replace(/^\/api\/st\/?/, '/');
  return stripped.startsWith('/') ? stripped : `/${stripped}`;
};

const copyHeaders = (fromHeaders, hostname) => {
  const headers = {};
  Object.keys(fromHeaders || {}).forEach(key => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) return;
    // Forward only Sharetribe auth cookies (st-*), not other site cookies
    if (lower === 'cookie') {
      const stCookies = (fromHeaders[key] || '')
        .split(';')
        .map(c => c.trim())
        .filter(c => c.startsWith('st-'))
        .join('; ');
      if (stCookies) {
        headers[key] = stCookies;
      }
      return;
    }
    headers[key] = fromHeaders[key];
  });
  headers.host = hostname;
  headers['x-forwarded-host'] = fromHeaders.host || hostname;
  headers['x-forwarded-proto'] = 'https';
  return headers;
};

module.exports = (req, res) => {
  let target;
  try {
    target = new URL(SHARETRIBE_API_ORIGIN);
  } catch (e) {
    console.error('[st-proxy] invalid SHARETRIBE_API_PROXY_TARGET');
    res.status(500).json({ error: 'proxy_misconfigured' });
    return;
  }

  const pathWithQuery = buildTargetPath(req.originalUrl || req.url);
  const isHttps = target.protocol === 'https:';
  const transport = isHttps ? https : http;

  const options = {
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || (isHttps ? 443 : 80),
    path: pathWithQuery,
    method: req.method,
    headers: copyHeaders(req.headers, target.hostname),
    agent: isHttps ? agent : undefined,
    timeout: 90000,
  };

  const proxyReq = transport.request(options, proxyRes => {
    const responseHeaders = { ...proxyRes.headers };
    // Let Express/compression decide encoding; drop upstream encoding mismatches
    delete responseHeaders['transfer-encoding'];
    // Same-origin proxy — do not forward Sharetribe CORS headers
    delete responseHeaders['access-control-allow-origin'];
    delete responseHeaders['access-control-allow-credentials'];

    res.writeHead(proxyRes.statusCode || 502, responseHeaders);
    proxyRes.pipe(res);
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy(new Error('Sharetribe proxy timeout'));
  });

  proxyReq.on('error', err => {
    console.error('[st-proxy]', err.message, pathWithQuery);
    if (!res.headersSent) {
      res.status(502).json({
        error: 'sharetribe_proxy_failed',
        message: err.message,
      });
    } else {
      res.end();
    }
  });

  req.pipe(proxyReq);
};
