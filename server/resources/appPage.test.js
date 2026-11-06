const appPage = require('./appPage');

const APP_STORE_URL = 'https://apps.apple.com/app/id6808781959';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const INSTAGRAM_ON_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 356.0.0.30.79 (iPhone15,2; iOS 18_1; ru_RU)';
const IMESSAGE_PREVIEW = `${IPHONE_SAFARI} facebookexternalhit/1.1 Facebot Twitterbot/1.0`;
const APPLEBOT = `${IPHONE_SAFARI} (Applebot/0.1; +http://www.apple.com/go/applebot)`;
const TELEGRAM_PREVIEW = 'TelegramBot (like TwitterBot)';
const WHATSAPP_PREVIEW = 'WhatsApp/2.24.21.79 i';
const FACEBOOK_PREVIEW =
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';

const ENV_KEYS = ['REACT_APP_PLAUSIBLE_DOMAINS', 'REACT_APP_MARKETPLACE_ROOT_URL'];

const createRequest = (userAgent, extraHeaders = {}) => {
  const headers = { 'user-agent': userAgent, ...extraHeaders };
  return {
    ip: '198.51.100.20',
    originalUrl: '/app?utm_source=whatsapp',
    get: name => headers[name.toLowerCase()],
  };
};

const createResponse = () => ({ set: jest.fn(), redirect: jest.fn() });

const visit = (userAgent, extraHeaders) => {
  const res = createResponse();
  const next = jest.fn();
  appPage(createRequest(userAgent, extraHeaders), res, next);
  return { res, next };
};

describe('appPage', () => {
  const saved = {};
  const originalFetch = global.fetch;

  beforeEach(() => {
    ENV_KEYS.forEach(key => {
      saved[key] = process.env[key];
    });
    process.env.REACT_APP_PLAUSIBLE_DOMAINS = 'youdu.ae,www.youdu.ae';
    process.env.REACT_APP_MARKETPLACE_ROOT_URL = 'https://youdu.ae/';
    global.fetch = jest.fn(() => Promise.resolve({ ok: true }));
  });

  afterEach(() => {
    ENV_KEYS.forEach(key => {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    });
    global.fetch = originalFetch;
  });

  it('sends people on iPhone straight to the App Store', () => {
    [IPHONE_SAFARI, INSTAGRAM_ON_IPHONE].forEach(userAgent => {
      const { res, next } = visit(userAgent);

      expect(res.redirect).toHaveBeenCalledWith(302, APP_STORE_URL);
      expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(next).not.toHaveBeenCalled();
    });
  });

  it('renders the page for link previews, Android and computers', () => {
    [
      IMESSAGE_PREVIEW,
      APPLEBOT,
      TELEGRAM_PREVIEW,
      WHATSAPP_PREVIEW,
      FACEBOOK_PREVIEW,
      ANDROID_CHROME,
      MAC_SAFARI,
      undefined,
    ].forEach(userAgent => {
      const { res, next } = visit(userAgent);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.redirect).not.toHaveBeenCalled();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('counts the redirected visit in Plausible as a view of the shared link', () => {
    visit(IPHONE_SAFARI, { 'cf-connecting-ip': '203.0.113.7', referer: 'https://t.me/' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://plausible.io/api/event');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
      'User-Agent': IPHONE_SAFARI,
      'X-Forwarded-For': '203.0.113.7',
    });
    expect(JSON.parse(options.body)).toEqual({
      name: 'pageview',
      domain: 'youdu.ae,www.youdu.ae',
      url: 'https://youdu.ae/app?utm_source=whatsapp',
      referrer: 'https://t.me/',
    });
  });

  it('uses the request IP and leaves out an empty referrer when Cloudflare is not in front', () => {
    visit(IPHONE_SAFARI);

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers['X-Forwarded-For']).toBe('198.51.100.20');
    expect(JSON.parse(options.body)).not.toHaveProperty('referrer');
  });

  it('skips Plausible when it is not configured', () => {
    delete process.env.REACT_APP_PLAUSIBLE_DOMAINS;

    const { res } = visit(IPHONE_SAFARI);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(302, APP_STORE_URL);
  });

  it('still redirects when Plausible is unreachable', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('offline')));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { res } = visit(IPHONE_SAFARI);
    await new Promise(resolve => setImmediate(resolve));

    expect(res.redirect).toHaveBeenCalledWith(302, APP_STORE_URL);
    expect(warn).toHaveBeenCalledWith('⚠️ app-page: Plausible pageview failed', 'offline');
    warn.mockRestore();
  });
});
