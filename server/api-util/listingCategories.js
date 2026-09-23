/**
 * Категории заданий в том виде, в каком их показывает мастер на сайте.
 *
 * Источник — хостед-ассет Sharetribe listings/listing-categories.json, тот же,
 * что клиент получает в config.categoryConfiguration. Список в
 * src/config/serviceCategories.js сюда не годится: это ES-модуль, а сервер
 * работает на CommonJS, и держать третью копию списка было бы хуже, чем
 * прочитать ассет.
 */

const { createCache } = require('./cache');

const ASSET_PATH = '/listings/listing-categories.json';

// Категории меняют в Console редко, а сессия голоса стартует на каждый разговор.
const CACHE_TTL_MS = 30 * 60 * 1000;

const categoriesCache = createCache({ ttlMs: CACHE_TTL_MS, maxEntries: 1 });

const normalize = entries =>
  (Array.isArray(entries) ? entries : [])
    .filter(entry => entry && typeof entry.id === 'string' && typeof entry.name === 'string')
    .map(({ id, name, subcategories }) => ({
      id,
      name,
      subcategories: normalize(subcategories).map(({ id: subId, name: subName }) => ({
        id: subId,
        name: subName,
      })),
    }));

const loadCategories = async sdk => {
  const response = await sdk.assetsByAlias({ paths: [ASSET_PATH], alias: 'latest' });
  const asset = response?.data?.data?.[0];
  const data = asset?.type === 'jsonAsset' ? asset.attributes?.data : null;
  const categories = normalize(data?.categories);

  if (categories.length === 0) {
    throw new Error('listing-categories asset is empty or missing');
  }
  return categories;
};

/**
 * @param {Object} sdk Любой экземпляр Marketplace SDK — ассет публичный.
 * @returns {Promise<Array<{id: string, name: string, subcategories: Array<{id: string, name: string}>}>>}
 */
const fetchListingCategories = sdk => categoriesCache.get('all', () => loadCategories(sdk));

module.exports = { fetchListingCategories, normalize };
