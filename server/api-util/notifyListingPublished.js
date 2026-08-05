const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const { notifyNewListingToCategory } = require('../api/telegram-bot');

const CATEGORY_LABELS = {
  repairs_main: 'Ремонт и строительство',
  Delivery: 'Курьерские услуги',
  Help_home: 'Уборка и помощь в доме',
  Cargo_transportation: 'Грузоперевозки',
  Installation_mashines: 'Установка бытовой техники',
  Beauty_health: 'Красота и здоровье',
  Photo: 'Фото, видео, аудио',
  Repair_digital: 'Ремонт цифровой техники',
  Legal_assistance: 'Юридическая и бухгалтерская помощь',
  training: 'Репетиторы и обучение',
  Automotive_services: 'Автомобильные услуги',
  Interior_designer: 'Дизайн интерьеров',
  Tourist_services: 'Туристические услуги',
  Web_design: 'Веб Дизайн/SEO',
};

const createIntegrationSdk = () => {
  const clientId = process.env.INTEGRATION_API_CLIENT_ID;
  const clientSecret = process.env.INTEGRATION_API_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return sharetribeIntegrationSdk.createInstance({ clientId, clientSecret });
};

const formatPrice = price => {
  if (!price || typeof price.amount !== 'number') {
    return null;
  }
  return `${Math.round(price.amount / 100)} ${price.currency || 'AED'}`;
};

/**
 * Sends the "new task in your category" Telegram alert to executors.
 *
 * The `telegramNotifiedAt` metadata flag makes this idempotent: publishing can
 * be triggered more than once for the same listing (client retries, draft
 * republish), and executors must not receive duplicates. The flag is written
 * before the messages go out so concurrent calls cannot both pass the check.
 */
const notifyExecutorsAboutListing = async listingId => {
  const integrationSdk = createIntegrationSdk();

  if (!integrationSdk) {
    return { skipped: 'missing-integration-credentials' };
  }

  const response = await integrationSdk.listings.show({ id: listingId });
  const listing = response.data.data;
  const { state, title, price, publicData = {}, metadata = {} } = listing.attributes;

  if (state !== 'published') {
    return { skipped: `state-${state}` };
  }
  if (metadata.telegramNotifiedAt) {
    return { skipped: 'already-notified' };
  }

  const categoryId = publicData.categoryLevel1;
  if (!categoryId) {
    return { skipped: 'no-category' };
  }

  await integrationSdk.listings.update({
    id: listingId,
    metadata: { telegramNotifiedAt: new Date().toISOString() },
  });

  const rootUrl = process.env.REACT_APP_MARKETPLACE_ROOT_URL || 'https://youdu.ae';

  return notifyNewListingToCategory({
    categoryId,
    categoryName: CATEGORY_LABELS[categoryId] || categoryId,
    listingTitle: title,
    price: formatPrice(price),
    listingUrl: `${rootUrl}/l/${listingId}`,
    listingId,
  });
};

module.exports = { notifyExecutorsAboutListing, CATEGORY_LABELS };
