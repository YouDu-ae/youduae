/**
 * Инструменты голосового помощника, которые вызывает backend-модель GPT-Live.
 *
 * Все они только читают и приводят данные к виду мастера на сайте — ни один не
 * создаёт и не публикует задание. Опубликовать задание может только человек,
 * нажав кнопку в мастере: публикация сразу рассылает уведомления специалистам,
 * и неверно расслышанный адрес или бюджет не должен уйти двум десяткам мастеров.
 *
 * Черновик, который собирает prepare_task_draft, совпадает по форме с тем, что
 * мастер хранит в guestListingStorage и публикует через /post-from-draft.
 */

const { fetchAutocomplete, fetchPlaceDetails, PlacesError } = require('../api/places-proxy');
const { getSpecialistsSummary } = require('./specialistsSummary');

// Значения поля «Дата выполнения» в мастере — это перечисление, а не дата.
const DEADLINES = {
  today: 'сегодня',
  tomorrow: 'завтра',
  week: 'в течение недели',
  'long-term': 'долгосрочно',
};

const PAYMENT_METHODS = {
  cash: 'наличными',
  'bank-transfer': 'банковским переводом',
};

// Те же пределы, что проверяет мастер: черновик, который мастер отвергнет,
// заставил бы человека исправлять то, что помощник уже «согласовал».
const LIMITS = {
  titleMin: 5,
  titleMax: 100,
  descriptionMin: 20,
  descriptionMax: 5000,
  priceMax: 1000000,
};

const MAX_LOCATION_CANDIDATES = 3;

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    name: 'resolve_location',
    description:
      'Находит адрес в ОАЭ по словам пользователя. Возвращает до трёх вариантов с place_id. ' +
      'Вызывай всякий раз, когда пользователь называет адрес, район или здание.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Адрес или район так, как его назвал пользователь, например «Dubai Marina, JBR».',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'count_specialists',
    description:
      'Сколько специалистов на YouDu работает в категории и сколько их всего. ' +
      'Задание видят все специалисты, откликнуться может любой.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'id категории из списка категорий.' },
      },
      required: ['category'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'prepare_task_draft',
    description:
      'Проверяет собранные данные и готовит черновик задания для экрана. Ничего не публикует. ' +
      'Если вернулись ошибки, переспроси пользователя только о полях с ошибками.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Короткое название задания, 5–100 символов.' },
        description: {
          type: 'string',
          description:
            'Подробное описание, 20–5000 символов. Включи всё, что сказал пользователь: время суток, ' +
            'доступ в здание, материалы, пожелания.',
        },
        category: { type: 'string', description: 'id категории из списка.' },
        subcategory: { type: 'string', description: 'id подкатегории из списка, если подходит.' },
        deadline: { type: 'string', enum: Object.keys(DEADLINES) },
        price: { type: 'number', description: 'Бюджет в дирхамах (AED), целое число больше нуля.' },
        payment_method: { type: 'string', enum: Object.keys(PAYMENT_METHODS) },
        place_id: { type: 'string', description: 'place_id варианта, который подтвердил пользователь.' },
      },
      required: ['title', 'description', 'category', 'deadline', 'price', 'place_id'],
      additionalProperties: false,
    },
  },
];

const TOOL_NAMES = TOOL_DEFINITIONS.map(tool => tool.name);

const text = value => (typeof value === 'string' ? value.trim() : '');

const findCategory = (categories, categoryId) =>
  categories.find(category => category.id === categoryId) || null;

/**
 * Проверяет поля черновика, кроме адреса: адрес требует запроса к Google и
 * проверяется отдельно. Без сетевых вызовов, чтобы правила можно было тестировать.
 *
 * @returns {{errors: Object<string, string>, fields: Object|null}}
 */
const validateDraftFields = (args, categories) => {
  const errors = {};

  const title = text(args.title);
  if (title.length < LIMITS.titleMin || title.length > LIMITS.titleMax) {
    errors.title = `Название должно быть от ${LIMITS.titleMin} до ${LIMITS.titleMax} символов.`;
  }

  const description = text(args.description);
  if (description.length < LIMITS.descriptionMin || description.length > LIMITS.descriptionMax) {
    errors.description = `Описание должно быть от ${LIMITS.descriptionMin} до ${LIMITS.descriptionMax} символов.`;
  }

  const category = findCategory(categories, text(args.category));
  if (!category) {
    errors.category = 'Такой категории нет в списке.';
  }

  const subcategoryId = text(args.subcategory);
  const subcategory =
    category && subcategoryId
      ? category.subcategories.find(sub => sub.id === subcategoryId) || null
      : null;
  if (category && subcategoryId && !subcategory) {
    errors.subcategory = 'Эта подкатегория не относится к выбранной категории.';
  }

  const deadline = text(args.deadline);
  if (!DEADLINES[deadline]) {
    errors.deadline = 'Срок должен быть одним из: сегодня, завтра, в течение недели, долгосрочно.';
  }

  const price = typeof args.price === 'number' ? Math.round(args.price) : NaN;
  if (!Number.isFinite(price) || price <= 0 || price > LIMITS.priceMax) {
    errors.price = 'Бюджет нужен целым числом дирхамов больше нуля.';
  }

  const paymentMethod = text(args.payment_method);
  if (paymentMethod && !PAYMENT_METHODS[paymentMethod]) {
    errors.payment_method = 'Способ оплаты — наличными или банковским переводом.';
  }

  if (!text(args.place_id)) {
    errors.place_id = 'Нужен адрес, подтверждённый пользователем.';
  }

  if (Object.keys(errors).length > 0) {
    return { errors, fields: null };
  }

  return {
    errors,
    fields: {
      title,
      description,
      category,
      subcategory,
      deadline,
      price,
      paymentMethod: paymentMethod || '',
      placeId: text(args.place_id),
    },
  };
};

/**
 * Значение поля адреса в том виде, в каком его сохраняет LocationAutocompleteInput:
 * мастер проверяет selectedPlace.address, а /post-from-draft берёт координаты
 * из selectedPlace.origin.
 */
const toWizardLocation = ({ address, lat, lng }) => ({
  search: address,
  predictions: [],
  selectedPlace: { address, origin: { lat, lng }, bounds: null },
});

const resolveLocation = async ({ query }) => {
  const input = text(query);
  if (!input) {
    return { ok: false, error: 'Пустой адрес.' };
  }

  const response = await fetchAutocomplete({ input });
  const predictions = Array.isArray(response?.predictions) ? response.predictions : [];

  if (predictions.length === 0) {
    return { ok: false, error: 'Адрес не найден в ОАЭ. Попроси назвать район или ориентир.' };
  }

  return {
    ok: true,
    candidates: predictions.slice(0, MAX_LOCATION_CANDIDATES).map(prediction => ({
      place_id: prediction.place_id,
      description: prediction.description,
    })),
  };
};

const lookupPlace = async placeId => {
  const response = await fetchPlaceDetails({ placeId });
  const result = response?.status === 'OK' ? response.result : null;
  const location = result?.geometry?.location;

  if (!result?.formatted_address || typeof location?.lat !== 'number') {
    return null;
  }
  return { address: result.formatted_address, lat: location.lat, lng: location.lng };
};

const countSpecialists = async ({ category }, { categories }) => {
  const known = findCategory(categories, text(category));
  if (!known) {
    return { ok: false, error: 'Такой категории нет в списке.' };
  }

  const summary = await getSpecialistsSummary();
  return {
    ok: true,
    category_name: known.name,
    specialists_in_category: summary.categories[known.id]?.count || 0,
    specialists_total: summary.total,
  };
};

const prepareTaskDraft = async (args, { categories }) => {
  const { errors, fields } = validateDraftFields(args, categories);
  if (!fields) {
    return { ok: false, errors };
  }

  const place = await lookupPlace(fields.placeId);
  if (!place) {
    return {
      ok: false,
      errors: { place_id: 'Не удалось определить этот адрес. Попроси назвать его ещё раз.' },
    };
  }

  return {
    ok: true,
    draft: {
      title: fields.title,
      description: fields.description,
      category: fields.category.id,
      subcategory: fields.subcategory?.id || '',
      deadline: fields.deadline,
      paymentMethod: fields.paymentMethod,
      price: fields.price,
      location: toWizardLocation(place),
    },
    // То, что помощник проговорит вслух перед тем, как попросить проверить экран.
    summary: {
      category: fields.category.name,
      subcategory: fields.subcategory?.name || null,
      deadline: DEADLINES[fields.deadline],
      price_aed: fields.price,
      address: place.address,
    },
  };
};

const EXECUTORS = {
  resolve_location: resolveLocation,
  count_specialists: countSpecialists,
  prepare_task_draft: prepareTaskDraft,
};

/**
 * @param {string} name Имя инструмента из TOOL_NAMES.
 * @param {Object} args Разобранные аргументы вызова.
 * @param {{categories: Array}} context
 * @returns {Promise<Object>} Результат для function_call_output. Ошибки данных
 *   возвращаются как { ok: false }, чтобы модель могла переспросить; исключения
 *   летят только при сбое инфраструктуры.
 */
const executeTool = async (name, args, context) => {
  const executor = EXECUTORS[name];
  if (!executor) {
    throw new Error(`Unknown voice tool: ${name}`);
  }

  try {
    return await executor(args || {}, context);
  } catch (error) {
    if (error instanceof PlacesError) {
      return { ok: false, error: 'Поиск адреса сейчас недоступен. Попроси назвать адрес позже.' };
    }
    throw error;
  }
};

module.exports = {
  TOOL_DEFINITIONS,
  TOOL_NAMES,
  DEADLINES,
  PAYMENT_METHODS,
  validateDraftFields,
  toWizardLocation,
  executeTool,
};
