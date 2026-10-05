const VIDEO_ID = /^[\w-]{11}$/;
const EMBED_PATHS = ['embed', 'shorts', 'live', 'v'];

/**
 * Id ролика из любой ссылки, которую выдаёт YouTube: watch?v=, youtu.be,
 * shorts, live и embed.
 *
 * @param {string} url
 * @returns {string|null}
 */
export const youtubeVideoId = url => {
  let parsed;
  try {
    parsed = new URL((url || '').trim());
  } catch (e) {
    return null;
  }

  const host = parsed.hostname.replace(/^(www|m|music)\./, '');
  const [first, second] = parsed.pathname.split('/').filter(Boolean);

  let id = null;
  if (host === 'youtu.be') {
    id = first;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = first === 'watch' ? parsed.searchParams.get('v') : EMBED_PATHS.includes(first) && second;
  }

  return id && VIDEO_ID.test(id) ? id : null;
};

/**
 * Встраиваемый плеер без cookies до начала просмотра; этот домен разрешён в
 * frame-src (server/csp.js).
 *
 * @param {string} videoId
 * @returns {string}
 */
export const youtubeEmbedUrl = videoId =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0`;
