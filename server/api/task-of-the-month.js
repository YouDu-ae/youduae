/**
 * «Задание месяца» на /cooperation: самое крупное по сумме задание, выполненное
 * в прошлом месяце, его исполнитель и отзыв заказчика.
 *
 * Роли в терминах Sharetribe перевёрнуты (см. api-util/reputation.js):
 * исполнитель — customer сделки, заказчик — provider.
 */

const integrationSdk = require('sharetribe-flex-integration-sdk');
const { handleError } = require('../api-util/sdk');
const { createCache } = require('../api-util/cache');
const { queryAllPages } = require('../api-util/paginate');
const { COMPLETED_TRANSITIONS, REVIEW_TYPE_BY_ROLE, ROLE } = require('../api-util/reputation');
const { transactionValueAED } = require('../api-util/transactionValue');
const {
  avatarUrl,
  hasIntegrationCredentials,
  hasOpenProfile,
} = require('../api-util/specialistsSummary');

const TRANSIT_VERBOSE = process.env.REACT_APP_SHARETRIBE_SDK_TRANSIT_VERBOSE === 'true';

// Прошлый месяц уже закрыт, за час может появиться разве что отзыв
const CACHE_TTL_MS = 60 * 60 * 1000;

const cache = createCache({ ttlMs: CACHE_TTL_MS, maxEntries: 2 });

// В ОАЭ нет перехода на летнее время
const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;

const COMPLETE_TRANSITION = 'transition/complete';
const SPECIALIST_REVIEW_TYPE = REVIEW_TYPE_BY_ROLE[ROLE.SPECIALIST];

/**
 * Границы прошлого месяца по времени Дубая: задание, закрытое 1-го числа в два
 * часа ночи, по UTC попало бы ещё в предыдущий месяц.
 *
 * @param {Date} now
 * @returns {{key: string, start: Date, end: Date}} key — 'YYYY-MM'; end не входит
 */
const previousMonthRange = now => {
  const dubaiNow = new Date(now.getTime() + DUBAI_OFFSET_MS);
  const year = dubaiNow.getUTCFullYear();
  const month = dubaiNow.getUTCMonth();
  const monthStart = new Date(Date.UTC(year, month - 1, 1));

  return {
    key: monthStart.toISOString().slice(0, 7),
    start: new Date(monthStart.getTime() - DUBAI_OFFSET_MS),
    end: new Date(Date.UTC(year, month, 1) - DUBAI_OFFSET_MS),
  };
};

// lastTransitionedAt не подходит: отзыв, оставленный в сентябре, сделал бы
// августовское задание сентябрьским.
const completedAt = tx => {
  const complete = (tx.attributes.transitions || []).find(
    t => t.transition === COMPLETE_TRANSITION
  );
  return complete ? new Date(complete.createdAt) : null;
};

/**
 * @param {Array} transactions выполненные сделки с include listing, customer,
 *   customer.profileImage, reviews, reviews.author
 * @param {Array} included
 * @param {{start: Date, end: Date}} range
 * @returns {Object|null} null, если в месяце нечего показать
 */
const pickTaskOfTheMonth = (transactions, included, { start, end }) => {
  const resources = new Map(included.map(item => [`${item.type}/${item.id.uuid}`, item]));
  const lookup = ref => (ref ? resources.get(`${ref.type}/${ref.id.uuid}`) : undefined);

  const [winner] = transactions
    .map(tx => ({
      tx,
      doneAt: completedAt(tx),
      amountAED: transactionValueAED(tx),
      listing: lookup(tx.relationships?.listing?.data),
      specialist: lookup(tx.relationships?.customer?.data),
    }))
    .filter(
      ({ doneAt, amountAED, listing, specialist }) =>
        doneAt &&
        doneAt >= start &&
        doneAt < end &&
        amountAED > 0 &&
        listing?.attributes?.title &&
        hasOpenProfile(specialist?.attributes) &&
        specialist?.attributes?.profile?.displayName
    )
    .sort((a, b) => b.amountAED - a.amountAED || b.doneAt - a.doneAt);

  if (!winner) {
    return null;
  }

  const { tx, doneAt, amountAED, listing, specialist } = winner;

  // Отзыв в статусе pending Sharetribe скрывает, пока вторая сторона не оставит
  // свой или не истечёт срок отзывов: раньше показывать его нельзя.
  const review = (tx.relationships?.reviews?.data || [])
    .map(lookup)
    .find(
      r =>
        r?.attributes?.type === SPECIALIST_REVIEW_TYPE &&
        r.attributes.state === 'public' &&
        !r.attributes.deleted
    );
  const reviewAuthor = review && lookup(review.relationships?.author?.data);

  return {
    title: listing.attributes.title,
    amountAED,
    completedAt: doneAt.toISOString(),
    specialist: {
      id: specialist.id.uuid,
      displayName: specialist.attributes.profile.displayName,
      avatarUrl: avatarUrl(lookup(specialist.relationships?.profileImage?.data)),
    },
    review: review
      ? {
          rating: review.attributes.rating || null,
          content: (review.attributes.content || '').trim(),
          authorName: reviewAuthor?.attributes?.profile?.displayName || null,
        }
      : null,
  };
};

const fetchTaskOfTheMonth = async range => {
  const sdk = integrationSdk.createInstance({
    clientId: process.env.INTEGRATION_API_CLIENT_ID,
    clientSecret: process.env.INTEGRATION_API_CLIENT_SECRET,
    transitVerbose: TRANSIT_VERBOSE,
  });

  // Сделка, созданная после конца месяца, не могла в нём завершиться
  const { items, included } = await queryAllPages(({ page, perPage }) =>
    sdk.transactions.query({
      lastTransitions: COMPLETED_TRANSITIONS,
      createdAtEnd: range.end.toISOString(),
      include: ['listing', 'customer', 'customer.profileImage', 'reviews', 'reviews.author'],
      'fields.listing': ['title'],
      // Аватар 64 px, 240 px хватает и для экранов с плотностью 3x
      'fields.image': ['variants.square-small'],
      page,
      perPage,
    })
  );

  const task = pickTaskOfTheMonth(items, included, range);

  console.log(
    `🏆 [Task of the month] ${range.key}: ${task ? 'found' : 'none'} among ${
      items.length
    } completed transactions (cache miss)`
  );

  return { month: range.key, task };
};

const handler = (req, res) => {
  if (!hasIntegrationCredentials()) {
    console.error('❌ [Task of the month] Integration API credentials are missing');
    return res.status(500).json({ error: 'Integration API credentials not configured' });
  }

  const range = previousMonthRange(new Date());

  return cache
    .get(range.key, () => fetchTaskOfTheMonth(range))
    .then(payload => {
      res.set('Cache-Control', `public, max-age=${CACHE_TTL_MS / 1000}`);
      res.status(200).json(payload);
    })
    .catch(e => {
      console.error('❌ [Task of the month] Error:', e);
      handleError(res, e);
    });
};

module.exports = handler;
module.exports.previousMonthRange = previousMonthRange;
module.exports.pickTaskOfTheMonth = pickTaskOfTheMonth;
