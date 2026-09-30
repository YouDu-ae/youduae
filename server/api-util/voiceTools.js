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
const CYRILLIC = /[а-яё]/i;

const RESOLVE_LOCATION_TOOL = {
  type: 'function',
  name: 'resolve_location',
  description:
    'Находит адрес в ОАЭ. Возвращает до трёх вариантов с place_id. ' +
    'Вызывай всякий раз, когда пользователь называет адрес, район или здание. ' +
    'Google знает места Дубая только по официальным латинским названиям, поэтому передавай их латиницей.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Адрес латиницей, как название пишется по-английски, даже если в расшифровке оно кириллицей: ' +
          '«Эмаар Бичфронт» → «Emaar Beachfront», «Блю Уотерс» → «Bluewaters», «Порт де ла Мер» → «Port de La Mer».',
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
};

const COUNT_SPECIALISTS_TOOL = {
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
};

const TASK_FIELD_PROPERTIES = {
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
};

const PREPARE_TASK_DRAFT_TOOL = {
  type: 'function',
  name: 'prepare_task_draft',
  description:
    'Проверяет собранные данные и готовит черновик задания для экрана. Ничего не публикует. ' +
    'Если вернулись ошибки, переспроси пользователя только о полях с ошибками.',
  parameters: {
    type: 'object',
    properties: TASK_FIELD_PROPERTIES,
    required: ['title', 'description', 'category', 'deadline', 'price', 'place_id'],
    additionalProperties: false,
  },
};

const FILL_TASK_FIELD_PROPERTIES = {
  ...TASK_FIELD_PROPERTIES,
  description: {
    type: 'string',
    description:
      'Подробное описание, 20–5000 символов. Включи всё, что сказал пользователь: время суток, ' +
      'доступ в здание, материалы, пожелания. Когда дополняешь описание, передай его целиком.',
  },
  subcategory: {
    type: 'string',
    description: 'id подкатегории из списка, если подходит. Передавай вместе с category.',
  },
};

// Responses makes a tool without `strict` strict, and strict mode requires
// every field. Unknown fields have to come as null, or the model makes them up;
// an enum needs null among its values too.
const nullable = property => ({
  ...property,
  type: [property.type, 'null'],
  ...(property.enum ? { enum: [...property.enum, null] } : {}),
});

const FILL_TASK_FIELDS_TOOL = {
  type: 'function',
  name: 'fill_task_fields',
  description:
    'Сразу вписывает в форму задания на экране поля, которые уже известны. Ничего не публикует. ' +
    'Передавай только новые или изменённые поля, остальные — null: не придумывай того, чего человек не говорил. ' +
    'В ответе — какой шаг мастера открыт и чего на нём не хватает; если вернулись ошибки, переспроси только об этих полях.',
  strict: true,
  parameters: {
    type: 'object',
    properties: Object.fromEntries(
      Object.entries(FILL_TASK_FIELD_PROPERTIES).map(([name, property]) => [name, nullable(property)])
    ),
    required: Object.keys(FILL_TASK_FIELD_PROPERTIES),
    additionalProperties: false,
  },
};

// Приложение заполняет форму один раз, готовым черновиком.
const TOOL_DEFINITIONS = [RESOLVE_LOCATION_TOOL, COUNT_SPECIALISTS_TOOL, PREPARE_TASK_DRAFT_TOOL];

// Мастер на сайте заполняется по шагам прямо во время разговора.
const STEP_TOOL_DEFINITIONS = [RESOLVE_LOCATION_TOOL, COUNT_SPECIALISTS_TOOL, FILL_TASK_FIELDS_TOOL];

const TOOL_NAMES = [
  ...new Set([...TOOL_DEFINITIONS, ...STEP_TOOL_DEFINITIONS].map(tool => tool.name)),
];

const text = value => (typeof value === 'string' ? value.trim() : '');

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const findCategory = (categories, categoryId) =>
  categories.find(category => category.id === categoryId) || null;

// Each check reads the tool arguments and returns { value } or { error }.
const FIELD_CHECKS = {
  title: ({ title }) => {
    const value = text(title);
    return value.length < LIMITS.titleMin || value.length > LIMITS.titleMax
      ? { error: `Название должно быть от ${LIMITS.titleMin} до ${LIMITS.titleMax} символов.` }
      : { value };
  },
  description: ({ description }) => {
    const value = text(description);
    return value.length < LIMITS.descriptionMin || value.length > LIMITS.descriptionMax
      ? {
          error: `Описание должно быть от ${LIMITS.descriptionMin} до ${LIMITS.descriptionMax} символов.`,
        }
      : { value };
  },
  category: ({ category }, categories) => {
    const value = findCategory(categories, text(category));
    return value ? { value } : { error: 'Такой категории нет в списке.' };
  },
  subcategory: ({ category, subcategory }, categories) => {
    const parent = findCategory(categories, text(category));
    const subcategoryId = text(subcategory);
    if (!parent || !subcategoryId) return { value: null };
    const value = parent.subcategories.find(sub => sub.id === subcategoryId);
    return value ? { value } : { error: 'Эта подкатегория не относится к выбранной категории.' };
  },
  deadline: ({ deadline }) => {
    const value = text(deadline);
    return has(DEADLINES, value)
      ? { value }
      : { error: 'Срок должен быть одним из: сегодня, завтра, в течение недели, долгосрочно.' };
  },
  price: ({ price }) => {
    const value = typeof price === 'number' ? Math.round(price) : NaN;
    return Number.isFinite(value) && value > 0 && value <= LIMITS.priceMax
      ? { value }
      : { error: 'Бюджет нужен целым числом дирхамов больше нуля.' };
  },
  payment_method: ({ payment_method: paymentMethod }) => {
    const value = text(paymentMethod);
    return !value || has(PAYMENT_METHODS, value)
      ? { value }
      : { error: 'Способ оплаты — наличными или банковским переводом.' };
  },
  place_id: ({ place_id: placeId }) => {
    const value = text(placeId);
    return value ? { value } : { error: 'Нужен адрес, подтверждённый пользователем.' };
  },
};

const TASK_FIELDS = Object.keys(FIELD_CHECKS);

const checkFields = (names, args, categories) => {
  const values = {};
  const errors = {};
  names.forEach(name => {
    const { value, error } = FIELD_CHECKS[name](args, categories);
    if (error) {
      errors[name] = error;
    } else {
      values[name] = value;
    }
  });
  return { values, errors };
};

/**
 * Проверяет поля черновика, кроме адреса: адрес требует запроса к Google и
 * проверяется отдельно. Без сетевых вызовов, чтобы правила можно было тестировать.
 *
 * @returns {{errors: Object<string, string>, fields: Object|null}}
 */
const validateDraftFields = (args, categories) => {
  const { values, errors } = checkFields(TASK_FIELDS, args, categories);

  if (Object.keys(errors).length > 0) {
    return { errors, fields: null };
  }

  return {
    errors,
    fields: {
      title: values.title,
      description: values.description,
      category: values.category,
      subcategory: values.subcategory,
      deadline: values.deadline,
      price: values.price,
      paymentMethod: values.payment_method,
      placeId: values.place_id,
    },
  };
};

// Where a checked value goes in the wizard's form.
const WIZARD_FIELDS = {
  title: ['title', value => value],
  description: ['description', value => value],
  category: ['category', value => value.id],
  subcategory: ['subcategory', value => value?.id || ''],
  deadline: ['deadline', value => value],
  price: ['price', value => value],
  payment_method: ['paymentMethod', value => value],
};

const isGiven = value => value !== undefined && value !== null && text(String(value)) !== '';

/**
 * Проверяет только переданные поля: на сайте помощник заполняет форму по шагам.
 * Годные поля возвращаются в виде мастера, даже если соседнее поле с ошибкой.
 *
 * @returns {{fields: Object, placeId: string|undefined, errors: Object<string, string>}}
 */
const validateTaskFields = (args, categories) => {
  const given = TASK_FIELDS.filter(name => isGiven(args[name]));
  const { values, errors } = checkFields(given, args, categories);

  // A subcategory is only checked against the category from the same call.
  if (given.includes('subcategory') && !given.includes('category')) {
    delete values.subcategory;
    errors.subcategory = 'Подкатегорию передавай вместе с категорией.';
  }
  if (errors.category) {
    delete values.subcategory;
  }

  const fields = {};
  Object.entries(values).forEach(([name, value]) => {
    if (!WIZARD_FIELDS[name]) return;
    const [field, toWizard] = WIZARD_FIELDS[name];
    fields[field] = toWizard(value);
  });

  return { fields, placeId: values.place_id, errors };
};

/**
 * Хватает ли в форме всего, без чего мастер не пустит к публикации.
 *
 * @param {Object} form поля в виде мастера: category — id, address — строка.
 */
const isTaskComplete = (form, categories) =>
  !!text(form.address) &&
  ['title', 'description', 'category', 'deadline', 'price'].every(
    name => !FIELD_CHECKS[name](form, categories).error
  );

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
    // Speech comes transcribed in Cyrillic, and Google does not know Dubai
    // places by their Russian spelling.
    if (CYRILLIC.test(input)) {
      return {
        ok: false,
        error:
          'Ничего не найдено по написанию кириллицей. Сразу повтори resolve_location, записав название латиницей, как оно пишется по-английски.',
      };
    }
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

/**
 * @param {Object} args поля, которые помощник уже узнал; любое подмножество.
 * @param {{categories: Array, form?: Object}} context form — что в форме сейчас,
 *   чтобы сказать, заполнено ли задание целиком вместе с новыми полями.
 */
const fillTaskFields = async (args, { categories, form = {} }) => {
  const { fields, placeId, errors } = validateTaskFields(args, categories);

  if (placeId) {
    const place = await lookupPlace(placeId);
    if (place) {
      fields.location = toWizardLocation(place);
    } else {
      errors.place_id = 'Не удалось определить этот адрес. Попроси назвать его ещё раз.';
    }
  }

  const failed = Object.keys(errors).length > 0;
  if (Object.keys(fields).length === 0 && !failed) {
    return { ok: false, error: 'Не передано ни одного поля.' };
  }

  const address = fields.location?.selectedPlace?.address || form.address;
  return {
    ok: !failed,
    fields,
    ...(failed ? { errors } : {}),
    complete: isTaskComplete({ ...form, ...fields, address }, categories),
  };
};

const EXECUTORS = {
  resolve_location: resolveLocation,
  count_specialists: countSpecialists,
  prepare_task_draft: prepareTaskDraft,
  fill_task_fields: fillTaskFields,
};

/**
 * @param {string} name Имя инструмента из TOOL_NAMES.
 * @param {Object} args Разобранные аргументы вызова.
 * @param {{categories: Array, form?: Object}} context
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
  STEP_TOOL_DEFINITIONS,
  TOOL_NAMES,
  DEADLINES,
  PAYMENT_METHODS,
  validateDraftFields,
  validateTaskFields,
  isTaskComplete,
  toWizardLocation,
  executeTool,
};
