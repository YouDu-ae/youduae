const APP_STORE_URL = 'https://apps.apple.com/app/id6808781959';
const PLAUSIBLE_EVENT_URL = 'https://plausible.io/api/event';

const IPHONE = /iPhone|iPod/;
// iMessage и Applebot приходят с User-Agent iPhone, но превью строится по og-тегам страницы
const LINK_PREVIEW = /bot|crawl|spider|facebookexternalhit|whatsapp|preview/i;

const isIPhoneVisitor = userAgent => IPHONE.test(userAgent) && !LINK_PREVIEW.test(userAgent);

// Скрипт Plausible на странице такой визит не увидит: до страницы посетитель не доходит
const trackPageview = req => {
  const domain = process.env.REACT_APP_PLAUSIBLE_DOMAINS;
  const rootURL = (process.env.REACT_APP_MARKETPLACE_ROOT_URL || '').replace(/\/$/, '');
  if (!domain || !rootURL) {
    return;
  }

  const referrer = req.get('Referer');
  fetch(PLAUSIBLE_EVENT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': req.get('User-Agent'),
      // Plausible отличает посетителей по IP браузера, иначе все визиты сольются в один
      'X-Forwarded-For': req.get('CF-Connecting-IP') || req.ip,
    },
    body: JSON.stringify({
      name: 'pageview',
      domain,
      url: `${rootURL}${req.originalUrl}`,
      ...(referrer ? { referrer } : {}),
    }),
    signal: AbortSignal.timeout(5000),
  }).catch(e => console.warn('⚠️ app-page: Plausible pageview failed', e.message));
};

module.exports = (req, res, next) => {
  if (!isIPhoneVisitor(req.get('User-Agent') || '')) {
    return next();
  }

  trackPageview(req);
  res.set('Cache-Control', 'no-store');
  return res.redirect(302, APP_STORE_URL);
};
