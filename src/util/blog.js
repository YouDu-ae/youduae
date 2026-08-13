/**
 * Обложки статей блога.
 *
 * API отдаёт image: null, если файл обложки отсутствует, поэтому подставлять
 * заглушку нужно на стороне клиента. Заглушка — реальный файл 1200×630,
 * чтобы она годилась и для карточек, и для превью при шеринге.
 */

export const DEFAULT_BLOG_COVER = '/static/blog/default.jpg';

export const blogCoverUrl = article => (article && article.image) || DEFAULT_BLOG_COVER;

export const blogCoverAbsoluteUrl = article => `https://youdu.ae${blogCoverUrl(article)}`;
