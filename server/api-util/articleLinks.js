const OWN_HOSTS = ['youdu.ae', 'www.youdu.ae'];
const TRACKING_PARAM = /^(utm_[a-z0-9_]+|gclid|fbclid|yclid|msclkid)$/i;
const TELEGRAM_USERNAME = /^@([a-z0-9_]{4,32})$/i;
const BARE_DOMAIN = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?=[/?#:]|$)/i;
const HREF = /(\shref\s*=\s*)(["'])(.*?)\2/gi;

// A scheme-less href resolves against the article URL (/blog/@name, /blog/youdu.ae/s) and gives 404.
const withScheme = href => {
  const username = href.match(TELEGRAM_USERNAME);
  if (username) {
    return `https://t.me/${username[1]}`;
  }
  if (href.startsWith('//')) {
    return `https:${href}`;
  }
  return BARE_DOMAIN.test(href) ? `https://${href}` : href;
};

const withoutOwnTracking = href => {
  let url;
  try {
    url = new URL(href);
  } catch (e) {
    return href;
  }
  if (!OWN_HOSTS.includes(url.hostname)) {
    return href;
  }
  const tracking = [...url.searchParams.keys()].filter(key => TRACKING_PARAM.test(key));
  if (!tracking.length) {
    return href;
  }
  tracking.forEach(key => url.searchParams.delete(key));
  return url.toString();
};

const normalizeHref = href => withoutOwnTracking(withScheme(href.trim().replace(/&amp;/g, '&')));

/**
 * Give links in article HTML absolute addresses: "@name" becomes a t.me link,
 * a bare domain gets https://, and links to youdu.ae lose utm parameters and click ids.
 *
 * @param {String} html article content
 * @returns {String} the same HTML with fixed href values
 */
const normalizeArticleLinks = html => {
  if (typeof html !== 'string') {
    return html;
  }
  return html.replace(HREF, (match, prefix, quote, href) => {
    const normalized = normalizeHref(href);
    if (normalized === href) {
      return match;
    }
    return `${prefix}${quote}${normalized.replace(/&/g, '&amp;')}${quote}`;
  });
};

module.exports = { normalizeArticleLinks };
