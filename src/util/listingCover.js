/**
 * Запасная обложка задания без фото: логотип YouDu на нейтральном фоне.
 * Настоящие снимки заказчика перекрывают её. Одна картинка на все категории —
 * иллюстрации по темам выглядели как сгенерированные и били по доверию.
 */

export const DEFAULT_LISTING_COVER = '/static/listing-covers/default.jpg';

export const listingCoverFallback = () => DEFAULT_LISTING_COVER;

// Только на локальной машине: ?previewFallbackCovers=1 прячет настоящие фото,
// чтобы сравнить заглушку на всей ленте, не трогая прод.
export const shouldPreviewListingCovers = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  return isLocal && new URLSearchParams(window.location.search).get('previewFallbackCovers') === '1';
};
