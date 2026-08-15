/**
 * Сколько специалистов работает в каждой категории — для подсказки в мастере задания.
 *
 * Нарочно не переиспользует /search-executors: тот на каждого исполнителя делает
 * два дополнительных запроса ради рейтинга и числа выполненных задач. Здесь нужны
 * только счётчик и несколько аватарок, поэтому берём один запрос пользователей и
 * считаем все категории за один проход — карточку видит каждый, кто открыл мастер.
 */

const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const { createCache } = require('../api-util/cache');
const { queryAllPages } = require('../api-util/paginate');

const CACHE_TTL_MS = 10 * 60 * 1000;

// Больше в карточку не помещается, а лишние URL только раздувают ответ.
const MAX_AVATARS = 5;

const CACHE_KEY = 'all';

const summaryCache = createCache({ ttlMs: CACHE_TTL_MS });

const avatarUrl = image => {
  const variants = image?.attributes?.variants || {};
  return (
    variants['square-small2x']?.url || variants['square-small']?.url || variants.default?.url || null
  );
};

const buildSummary = async () => {
  const integrationSdk = sharetribeIntegrationSdk.createInstance({
    clientId: process.env.INTEGRATION_API_CLIENT_ID,
    clientSecret: process.env.INTEGRATION_API_CLIENT_SECRET,
  });

  const { items: users, included } = await queryAllPages(({ page, perPage }) =>
    integrationSdk.users.query({ include: ['profileImage'], page, perPage })
  );

  const imagesById = new Map(
    included.filter(item => item.type === 'image').map(item => [item.id.uuid, item])
  );

  const categories = {};
  const avatars = [];
  let total = 0;

  users.forEach(user => {
    const profile = user.attributes?.profile || {};
    const serviceCategories = profile.publicData?.serviceCategories;

    // Непустой список категорий — единственный признак исполнителя в профиле.
    if (!Array.isArray(serviceCategories) || serviceCategories.length === 0) {
      return;
    }

    total += 1;

    const imageId = user.relationships?.profileImage?.data?.id?.uuid;
    const avatar = imageId ? avatarUrl(imagesById.get(imageId)) : null;

    if (avatar && avatars.length < MAX_AVATARS) {
      avatars.push(avatar);
    }

    serviceCategories.forEach(category => {
      const entry = categories[category] || (categories[category] = { count: 0, avatars: [] });
      entry.count += 1;
      if (avatar && entry.avatars.length < MAX_AVATARS) {
        entry.avatars.push(avatar);
      }
    });
  });

  console.log(`👷 Specialists summary: ${total} of ${users.length} users (cache miss)`);

  return { total, avatars, categories };
};

module.exports = (req, res) => {
  if (!process.env.INTEGRATION_API_CLIENT_ID || !process.env.INTEGRATION_API_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Integration API credentials not configured' });
  }

  summaryCache
    .get(CACHE_KEY, buildSummary)
    .then(payload => {
      res.set('Cache-Control', `public, max-age=${CACHE_TTL_MS / 1000}`);
      res.status(200).json(payload);
    })
    .catch(err => {
      console.error('❌ Specialists summary failed:', err?.message);
      res.status(500).json({ error: 'Query failed' });
    });
};
