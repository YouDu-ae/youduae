const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const {
  notifyNewListingToCategory,
  notifyAdminListingPendingApproval,
} = require('../api/telegram-bot');

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

const rootUrl = () => process.env.REACT_APP_MARKETPLACE_ROOT_URL || 'https://youdu.ae';

/**
 * Tells the admin a task is waiting for moderation.
 *
 * Nothing watches the pendingApproval state, so until this existed a task could
 * sit unapproved indefinitely — «Доставка» waited 28 days and nobody noticed.
 * The metadata flag is written before the message goes out, so a client retry
 * cannot produce a second alert; if the send itself fails, /pending in the bot
 * still surfaces the task.
 */
const notifyAdminAboutPendingListing = async ({ integrationSdk, listingId, listing, included }) => {
  const { title, price, publicData = {}, metadata = {} } = listing.attributes;

  if (metadata.adminPendingNotifiedAt) {
    return { skipped: 'admin-already-notified' };
  }

  await integrationSdk.listings.update({
    id: listingId,
    metadata: { adminPendingNotifiedAt: new Date().toISOString() },
  });

  const author = (included || []).find(entry => entry.type === 'user');
  const categoryId = publicData.categoryLevel1;

  const sent = await notifyAdminListingPendingApproval({
    listingTitle: title,
    authorName: author?.attributes?.profile?.displayName || 'без имени',
    categoryName: CATEGORY_LABELS[categoryId] || categoryId || 'без категории',
    price: formatPrice(price),
    listingUrl: `${rootUrl()}/l/${listingId}`,
    consoleUrl: `https://console.sharetribe.com/a/listings/${listingId}`,
  });

  return { adminNotified: Boolean(sent) };
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

  const response = await integrationSdk.listings.show({ id: listingId, include: ['author'] });
  const listing = response.data.data;
  const { state, title, price, publicData = {}, metadata = {} } = listing.attributes;

  // Moderation swallows the task: executors get nothing, so the admin has to.
  if (state === 'pendingApproval') {
    return notifyAdminAboutPendingListing({
      integrationSdk,
      listingId,
      listing,
      included: response.data.included,
    });
  }

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

  return notifyNewListingToCategory({
    categoryId,
    categoryName: CATEGORY_LABELS[categoryId] || categoryId,
    listingTitle: title,
    price: formatPrice(price),
    listingUrl: `${rootUrl()}/l/${listingId}`,
    listingId,
  });
};

module.exports = { notifyExecutorsAboutListing, CATEGORY_LABELS, formatPrice, rootUrl };
