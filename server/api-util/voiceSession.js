/**
 * Голосовая сессия GPT-Live для пилота «составить задание голосом».
 *
 * Схема подключения: браузер присылает SDP-предложение, сервер ключом проекта
 * создаёт сессию через POST /v1/live/sessions и возвращает SDP-ответ. Звук идёт
 * по WebRTC напрямую между браузером и OpenAI; вызовы инструментов браузер
 * пересылает на /api/voice/tool.
 *
 * Вся конфигурация сессии — модели, инструкции, инструменты — собирается здесь.
 * От клиента принимается только SDP, иначе любой мог бы подменить промт.
 */

const crypto = require('crypto');
const { TOOL_DEFINITIONS, STEP_TOOL_DEFINITIONS, DEADLINES } = require('./voiceTools');

const LIVE_SESSIONS_URL = 'https://api.openai.com/v1/live/sessions';

// Heroku обрывает запрос на 30-й секунде; ответ OpenAI должен успеть раньше.
const CREATE_TIMEOUT_MS = 15 * 1000;

// Разговор о задании укладывается в несколько минут. Инструменты по сессии,
// открытой раньше, отвергаются: это не даёт бесконечно пользоваться старым id.
const SESSION_MAX_AGE_MS = 30 * 60 * 1000;

const DEFAULT_DAILY_LIMIT = 5;

// Дата текста согласия на передачу голоса в OpenAI (VoiceIntake.consent*).
// Меняется вместе с текстом, если меняется смысл: тогда согласие спросят заново.
const VOICE_CONSENT_VERSION = '2026-09-24';

const isVoicePilotEnabled = () => process.env.VOICE_PILOT_ENABLED === 'true';

// Sharetribe id тех, кому пилот уже открыт, через запятую. Пустой список
// открывает пилот всем вошедшим — это и есть шаг «запустить для всех».
const pilotUserIds = () =>
  (process.env.VOICE_PILOT_USER_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

/**
 * Решает сервер, а не сборка сайта: так список тестовых аккаунтов меняется
 * перезапуском, без пересборки, и не попадает в бандл, который видит каждый.
 */
const isVoiceAllowedFor = userId => {
  if (!isVoicePilotEnabled() || !userId) return false;
  const allowed = pilotUserIds();
  return allowed.length === 0 || allowed.includes(userId);
};

const dailySessionLimit = () => {
  const configured = parseInt(process.env.VOICE_DAILY_SESSION_LIMIT, 10);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_DAILY_LIMIT;
};

const liveModel = () => process.env.VOICE_LIVE_MODEL || 'gpt-live-1';
const backendModel = () => process.env.VOICE_BACKEND_MODEL || 'gpt-5.6-terra';
// Unset keeps GPT-Live's default voice (marin). Chosen on the server so it can
// be switched without a deploy or an app release; applies to new conversations.
const outputVoice = () => (process.env.VOICE_OUTPUT_VOICE || '').trim();

class LiveSessionError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'LiveSessionError';
    this.status = status;
  }
}

/**
 * Сегодняшняя дата по Дубаю. Нужна модели, чтобы отличать «сегодня» от «завтра»:
 * сервер живёт в UTC, а пользователи — на четыре часа впереди.
 */
const dubaiToday = now =>
  new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Dubai',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);

const formatCategories = categories =>
  categories
    .map(category => {
      const subcategories = category.subcategories.map(sub => `${sub.id} — ${sub.name}`).join('; ');
      return subcategories
        ? `${category.id} — ${category.name}: ${subcategories}`
        : `${category.id} — ${category.name}`;
    })
    .join('\n');

/**
 * Шаги мастера на сайте — в том порядке и под теми названиями, что видит человек.
 * На сайте помощник заполняет форму по шагам, пока идёт разговор; приложение
 * по-прежнему получает готовый черновик в конце.
 */
const WIZARD_STEPS = [
  { id: 'title', name: 'Название', holds: 'название и описание' },
  {
    id: 'details',
    name: 'Детали',
    holds: 'категория и срок; подкатегория и способ оплаты — если подходят',
  },
  { id: 'location', name: 'Локация', holds: 'адрес' },
  { id: 'pricing', name: 'Цена', holds: 'бюджет в дирхамах' },
  { id: 'photos', name: 'Фото', holds: 'фото добавляет и задание публикует сам человек' },
];

const wizardStepIdOf = raw =>
  (WIZARD_STEPS.find(step => step.id === raw) || WIZARD_STEPS[0]).id;

const LIVE_PERSONA = [
  'Тебя зовут Вульф. Ты голосовой помощник YouDu — сервиса, где жители Дубая находят мастеров для любых задач.',
  'Характер: спокойный, уверенный профессионал, который решает проблемы. Говоришь по делу, без суеты и лишних слов, вежливо и с лёгкой невозмутимостью. Не шутишь без повода и не переигрываешь.',
  'Ты не человек: если спросят, прямо скажи, что ты голосовой помощник YouDu.',
  'В этом разговоре ты помогаешь человеку составить задание. Ничем другим не занимаешься: если просят о постороннем, вежливо скажи, что сейчас помогаешь только с заданием.',
  'Говори по-русски, коротко, одним-двумя предложениями. Задавай по одному вопросу за раз.',
  'Районы и здания Дубая люди называют по-английски с русским акцентом: Emaar Beachfront, Bluewaters, Port de La Mer, JLT, JVC, Dubai Marina. Узнавай такие названия и передавай бэкенду как есть; если не расслышал, переспроси или попроси назвать ближайший ориентир.',
];

/**
 * GPT-Live decides for itself when to hand work to the backend, and only the
 * delegation policy tells it when: without one it asks every question itself
 * and the backend never fills a field. OpenAI's prompting guide asks to keep
 * the English labels of the policy as they are.
 */
const LIVE_DRAFT_FLOW = [
  'Узнай, что нужно сделать, где, когда и какой бюджет в дирхамах. Способ оплаты спроси, только если человек сам заговорит о нём.',
  'Черновик задания составляет бэкенд из того, что ты ему передал; адреса и число мастеров тоже получай от бэкенда. Сам ничего из этого не придумывай и не обещай конкретных мастеров, сроков или цен.',
  'Задание не публикуется в разговоре. Когда бэкенд сообщит, что черновик готов, кратко перескажи его, попроси проверить на экране и нажать «Опубликовать» и спроси, нужно ли что-то ещё.',
  '',
  'Delegation policy:',
  'Backend tools:',
  '- Черновик задания: составляет из рассказа человека название, описание, категорию, срок, адрес и бюджет, выводит черновик на экран и отвечает, чего не хватает.',
  '- Адреса: находит адрес в Дубае и предлагает варианты.',
  '- Мастера: говорит, сколько специалистов в категории.',
  '',
  'Delegate to the backend when:',
  '- Человек рассказал, что нужно сделать, где, когда и какой бюджет: передай всё одним разом.',
  '- Человек выбрал вариант адреса или ответил на вопрос, который задал бэкенд.',
  '- Человек поправил или дополнил задание после того, как ты уже передал его бэкенду.',
  '',
  'Do not delegate to the backend when:',
  '- Человек только поздоровался, поблагодарил или прощается.',
  '- Тебе нужно коротко переспросить, чтобы понять ответ.',
  '',
  'Не говори, что черновик готов или виден на экране, пока бэкенд этого не подтвердил.',
];

const LIVE_STEP_FLOW = [
  `На экране мастер задания из пяти шагов: ${WIZARD_STEPS.map(step => `«${step.name}»`).join(', ')}. Иди по шагам по порядку и спрашивай о том шаге, который открыт: что нужно сделать, когда, где, какой бюджет в дирхамах. Способ оплаты спроси, только если человек сам заговорит о нём.`,
  'Сам ты в форму ничего не вписываешь. Поля вписывает бэкенд, и только то, что ты ему передал; мастер переходит к следующему шагу, когда бэкенд заполнил открытый. Адреса и число мастеров тоже получай от бэкенда. Сам ничего не придумывай и не обещай конкретных мастеров, сроков или цен.',
  'Не пересказывай всё задание в конце: человек видит его на экране. Задание не публикуется в разговоре: когда бэкенд сообщит, что открыт шаг «Фото», предложи добавить фото и нажать «Опубликовать задание» и спроси, нужно ли что-то ещё.',
  '',
  'Delegation policy:',
  'Backend tools:',
  '- Форма задания: вписывает в мастер на экране название, описание, категорию, срок, адрес и бюджет из рассказа человека и отвечает, какой шаг открыт и чего на нём не хватает.',
  '- Адреса: находит адрес в Дубае и предлагает варианты.',
  '- Мастера: говорит, сколько специалистов в категории.',
  '',
  'Delegate to the backend when:',
  '- Человек рассказал что-то о задании: что сделать, когда, где, какой бюджет — даже одной фразой и даже если ответил не на тот вопрос, который ты задал.',
  '- Человек назвал адрес, район или здание или выбрал один из вариантов адреса.',
  '- Человек поправил или дополнил то, что уже сказал.',
  '',
  'Do not delegate to the backend when:',
  '- Человек только поздоровался, поблагодарил или прощается.',
  '- Тебе нужно коротко переспросить, чтобы понять ответ.',
  '',
  'Передавай бэкенду сразу после ответа человека, до следующего вопроса: о чём спросить дальше, скажет бэкенд. Пока он работает, можно коротко сказать, что записываешь. Не говори, что поле заполнено или что осталось добавить фото, пока бэкенд этого не подтвердил.',
];

const LIVE_CLOSING =
  'Если человеку больше ничего не нужно, коротко попрощайся и закончи словами «Всего доброго!». Говори «Всего доброго» только в самом конце разговора: по этим словам приложение закрывает разговор.';

const liveInstructions = stepMode =>
  [...LIVE_PERSONA, ...(stepMode ? LIVE_STEP_FLOW : LIVE_DRAFT_FLOW), LIVE_CLOSING].join('\n');

/**
 * GPT-Live waits for the caller to speak first, so after allowing the
 * microphone people heard nothing and could not tell the conversation had
 * started. The client sends this with session.instructions.append right after
 * session.started, which makes the model open the conversation.
 */
const GREETING_INSTRUCTIONS = [
  'Поздоровайся сейчас, первым, по-русски, не дожидаясь, пока человек заговорит. Говори спокойно и уверенно, в своём характере.',
  'Скажи дословно: «Меня зовут Вульф, я голосовой помощник YouDu, и я решаю проблемы. Расскажите, что нужно сделать, — я помогу».',
  'Затем замолчи и слушай. Если человек заговорит во время приветствия, остановись и слушай его.',
].join(' ');

/**
 * Sent by the client when the draft is ready and the person has been silent
 * for a while, so the conversation ends instead of recording silence. The
 * closing words are what the client listens for before closing the session.
 */
/**
 * Sent by the client once the draft is ready and no photo is attached yet.
 */
const PHOTO_TIP_INSTRUCTIONS = [
  'Черновик готов, а фото к заданию ещё нет. Коротко, одним предложением, в своём характере посоветуй прикрепить фото на шаге «Фото»:',
  'по фото мастерам проще оценить работу и точнее назвать цену. Не настаивай.',
].join(' ');

/**
 * What the form already holds when a conversation starts: typed by the person
 * or left by an earlier conversation. Only known fields, trimmed to sane
 * lengths — this text goes into the backend prompt.
 */
const CURRENT_FIELD_LIMITS = {
  title: 100,
  description: 1000,
  category: 60,
  subcategory: 60,
  deadline: 20,
  paymentMethod: 20,
  address: 200,
};

const sanitizeCurrentFields = raw => {
  if (!raw || typeof raw !== 'object') return {};
  const fields = {};
  Object.entries(CURRENT_FIELD_LIMITS).forEach(([key, limit]) => {
    const value = typeof raw[key] === 'string' ? raw[key].trim().slice(0, limit) : '';
    if (value) fields[key] = value;
  });
  const price = Number(raw.price);
  if (Number.isFinite(price) && price > 0 && price < 10000000) fields.price = Math.round(price);
  return fields;
};

const CURRENT_FIELD_LABELS = {
  title: 'Название',
  description: 'Описание',
  category: 'Категория (id)',
  subcategory: 'Подкатегория (id)',
  deadline: 'Срок',
  paymentMethod: 'Оплата',
  address: 'Адрес',
  price: 'Бюджет, AED',
};

const currentFieldsSection = (fields, stepMode) => {
  const lines = Object.entries(CURRENT_FIELD_LABELS)
    .filter(([key]) => fields[key] !== undefined)
    .map(([key, label]) => `- ${label}: ${fields[key]}`);
  if (lines.length === 0) return [];
  return [
    '',
    'В форме уже заполнено (человек ввёл сам или остались от прошлого разговора):',
    ...lines,
    stepMode
      ? 'Если человек меняет только часть, передай в fill_task_fields только новые значения. Если описывает совсем другое задание — передай все поля заново. Новый адрес всё равно проверь через resolve_location, чтобы получить place_id.'
      : 'Если человек меняет только часть, в prepare_task_draft передай новые значения, а остальные сохрани как есть. Если описывает совсем другое задание — собирай заново. Адрес для prepare_task_draft всё равно проверь через resolve_location, чтобы получить place_id.',
  ];
};

const greetingFor = fields =>
  Object.keys(fields).length === 0
    ? GREETING_INSTRUCTIONS
    : [
        'Поздоровайся сейчас, первым, по-русски, не дожидаясь, пока человек заговорит. Говори спокойно и уверенно, в своём характере.',
        'Скажи дословно: «Меня зовут Вульф, я голосовой помощник YouDu, и я решаю проблемы. Вижу, часть задания уже заполнена. Расскажите, что нужно сделать или что поменять, — я помогу».',
        'Затем замолчи и слушай. Если человек заговорит во время приветствия, остановись и слушай его.',
      ].join(' ');

const FAREWELL_INSTRUCTIONS = [
  'Человек молчит. Коротко попрощайся в своём характере, одним-двумя предложениями:',
  'скажи, что задание готово, осталось проверить поля на экране и нажать «Опубликовать», и закончи словами «Всего доброго!».',
].join(' ');

const STEP_FAREWELL_INSTRUCTIONS = [
  'Человек молчит. Коротко попрощайся в своём характере, одним-двумя предложениями:',
  'скажи, что задание заполнено, осталось добавить фото, если они есть, и нажать «Опубликовать задание», и закончи словами «Всего доброго!».',
].join(' ');

const farewellFor = stepMode => (stepMode ? STEP_FAREWELL_INSTRUCTIONS : FAREWELL_INSTRUCTIONS);

// Places people name most often, in the spelling Google knows them by. Helps
// the backend map an accented, Cyrillic-transcribed name to the right one.
const DUBAI_PLACES = [
  'Dubai Marina', 'JBR (Jumeirah Beach Residence)', 'JLT (Jumeirah Lake Towers)', 'Bluewaters Island',
  'Emaar Beachfront', 'Dubai Harbour', 'Palm Jumeirah', 'Port de La Mer', 'La Mer', 'Jumeirah',
  'Umm Suqeim', 'Al Barsha', 'Al Sufouh', 'Dubai Internet City', 'Dubai Media City', 'Knowledge Park',
  'The Greens', 'The Views', 'Emirates Hills', 'The Springs', 'The Meadows', 'The Lakes', 'Jumeirah Islands',
  'Jumeirah Park', 'Jumeirah Golf Estates', 'JVC (Jumeirah Village Circle)', 'JVT (Jumeirah Village Triangle)',
  'Dubai Sports City', 'Motor City', 'Arabian Ranches', 'Damac Hills', 'Dubai Hills Estate', 'Al Quoz',
  'Downtown Dubai', 'Business Bay', 'DIFC', 'City Walk', 'Al Wasl', 'Jumeirah Bay', 'Dubai Creek Harbour',
  'Dubai Festival City', 'Al Jaddaf', 'Culture Village', 'Mirdif', 'Deira', 'Bur Dubai', 'Al Karama',
  'Oud Metha', 'Al Qusais', 'Al Nahda', 'International City', 'Silicon Oasis', 'Dubai South',
  'Town Square', 'Mudon', 'Meydan', 'Sobha Hartland', 'Al Furjan', 'Discovery Gardens', 'Jebel Ali',
];

const stepIntro = currentStep => {
  const index = WIZARD_STEPS.findIndex(step => step.id === currentStep);
  return [
    'Ты бэкенд голосового помощника YouDu. Человек заполняет задание в мастере на экране, а ты прямо во время разговора вписываешь в форму то, что он рассказал, через fill_task_fields.',
    'Шаги мастера:',
    ...WIZARD_STEPS.map((step, i) => `${i + 1}. «${step.name}» — ${step.holds}.`),
    `Сейчас открыт шаг ${index + 1} «${WIZARD_STEPS[index].name}».`,
  ];
};

const STEP_RULES = [
  '- Иди по шагам по порядку. Как только данные открытого шага ясны, сразу вызывай fill_task_fields с полями этого шага: они появятся на экране, и мастер сам перейдёт к следующему шагу. Не жди, пока соберёшь всё задание.',
  '- Если человек заранее назвал данные следующих шагов, передай и их — переспрашивать не нужно.',
  '- Передавай только то, что человек сказал, и то, что ты составил из его слов: название, описание, категорию. Остальные поля — null. Не подставляй срок, бюджет, адрес или способ оплаты, которых человек не называл.',
  '- Ответ fill_task_fields говорит, какой шаг открыт и чего на нём не хватает: спрашивай об этом. Человек может и сам переключать шаги и вводить данные руками — ориентируйся на последнее, что известно об экране.',
  '- Название и описание составь сам по рассказу человека. Категорию и подкатегорию тоже выбери сам по смыслу задания; спрашивай, только если по рассказу непонятно.',
  '- Когда человек подтвердил вариант адреса, сразу передай его place_id в fill_task_fields.',
  '- Если человек просит изменить уже заполненное, передай в fill_task_fields только изменённые поля.',
  '- Когда открыт шаг «Фото», все поля заполнены: предложи добавить фото, если их нет, — по фото мастерам проще оценить работу и назвать цену, — и нажать «Опубликовать задание». Не настаивай на фото.',
];

/**
 * @param {Object} params
 * @param {string|null} [params.currentStep] шаг мастера на сайте. Без него
 *   разговор идёт как в приложении: черновик целиком в конце.
 */
const backendInstructions = ({ categories, now, currentFields = {}, currentStep = null }) => {
  const stepMode = !!currentStep;
  return [
    ...(stepMode
      ? stepIntro(currentStep)
      : [
          'Ты бэкенд голосового помощника YouDu. Твоя цель — собрать данные для prepare_task_draft и вызвать его.',
        ]),
    `Сегодня ${dubaiToday(now)} (время Дубая).`,
    '',
    'Правила:',
    ...(stepMode ? STEP_RULES : []),
    '- Адрес: всякий раз вызывай resolve_location. Места Дубая люди называют по-английски с русским акцентом, а расшифровка часто пишет их кириллицей и с ошибками. Передавай официальное латинское название: «Эмаар Бичфронт» → Emaar Beachfront, «Блю Уотерс» → Bluewaters, «Порт де ла Мер» → Port de La Mer, «Джей Эл Ти» → JLT. Сверяйся со списком районов ниже. Если вариантов несколько, перечисли их и спроси, какой верный. place_id бери только из ответа resolve_location.',
    `- Срок — одно из значений: ${Object.entries(DEADLINES)
      .map(([id, label]) => `${id} (${label})`)
      .join(', ')}. «На этой неделе», «в ближайшие дни», «в пятницу» — это week. «Не срочно» — long-term.`,
    '- Время суток, этаж, доступ в здание, материалы и прочие подробности пиши в описание: отдельных полей для них нет.',
    '- Бюджет — целое число дирхамов. «До 400» — это 400. Если бюджет не назван, спроси его.',
    '- Способ оплаты не спрашивай: передай его, только если человек назвал его сам, иначе null.',
    '- Категорию и подкатегорию выбирай строго из списка ниже по id. Если ничего не подходит точно, выбери ближайшую категорию, а подкатегорию передай как null.',
    '- Когда категория ясна, можно вызвать count_specialists и честно сказать, сколько мастеров в категории. Задание видят все специалисты, откликнуться может любой.',
    stepMode
      ? '- Если fill_task_fields вернул ошибки, переспроси только об этих полях.'
      : '- Если prepare_task_draft вернул ошибки, переспроси только о полях с ошибками.',
    '- Никогда не говори, что задание опубликовано: это черновик, публикует человек.',
    '',
    `Районы и комплексы Дубая (официальные названия): ${DUBAI_PLACES.join(', ')}.`,
    '',
    'Категории (id — название: подкатегории):',
    formatCategories(categories),
    ...currentFieldsSection(currentFields, stepMode),
  ].join('\n');
};

/**
 * @param {{categories: Array, now: Date, currentFields?: Object, currentStep?: string|null}} params
 *   currentStep — открытый шаг мастера на сайте (id из WIZARD_STEPS); без него
 *   помощник собирает черновик целиком, как ждёт приложение.
 * @returns {Object} Поле `session` запроса POST /v1/live/sessions.
 */
const buildSessionConfig = ({ categories, now, currentFields = {}, currentStep = null }) => ({
  model: liveModel(),
  instructions: liveInstructions(!!currentStep),
  ...(outputVoice() ? { audio: { output: { voice: outputVoice() } } } : {}),
  delegation: {
    type: 'responses',
    responses: {
      model: backendModel(),
      instructions: backendInstructions({ categories, now, currentFields, currentStep }),
      tools: currentStep ? STEP_TOOL_DEFINITIONS : TOOL_DEFINITIONS,
      tool_choice: 'auto',
      // Черновик зависит от place_id, который возвращает resolve_location.
      parallel_tool_calls: false,
    },
  },
});

/**
 * Стабильный идентификатор пользователя для OpenAI без раскрытия его id на
 * YouDu. Документация просит передавать его при создании сессии.
 */
const safetyIdentifierFor = userId =>
  crypto
    .createHash('sha256')
    .update(`youdu-voice:${userId}`)
    .digest('hex');

/**
 * @returns {Promise<{sessionId: string, sdp: string}>}
 * @throws {LiveSessionError}
 */
const createLiveSession = async ({ sdp, session, safetyIdentifier }) => {
  let response;
  try {
    response = await fetch(LIVE_SESSIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Safety-Identifier': safetyIdentifier,
      },
      body: JSON.stringify({ session, transport: { type: 'webrtc', sdp } }),
      signal: AbortSignal.timeout(CREATE_TIMEOUT_MS),
    });
  } catch (error) {
    throw new LiveSessionError(502, `OpenAI is unreachable: ${error.message}`);
  }

  if (!response.ok) {
    // Тело ошибки пишем в лог, но клиенту не отдаём: в нём бывают детали конфигурации.
    const detail = await response.text().catch(() => '');
    throw new LiveSessionError(
      response.status >= 500 ? 502 : response.status,
      `OpenAI rejected the session (${response.status}): ${detail.slice(0, 500)}`
    );
  }

  const body = await response.json();
  const sessionId = body?.session?.id;
  const answer = body?.transport?.sdp;
  if (typeof sessionId !== 'string' || typeof answer !== 'string') {
    throw new LiveSessionError(502, 'OpenAI returned a session without id or SDP answer');
  }

  return { sessionId, sdp: answer };
};

module.exports = {
  isVoicePilotEnabled,
  isVoiceAllowedFor,
  dailySessionLimit,
  buildSessionConfig,
  wizardStepIdOf,
  GREETING_INSTRUCTIONS,
  FAREWELL_INSTRUCTIONS,
  farewellFor,
  PHOTO_TIP_INSTRUCTIONS,
  sanitizeCurrentFields,
  greetingFor,
  safetyIdentifierFor,
  createLiveSession,
  LiveSessionError,
  SESSION_MAX_AGE_MS,
  VOICE_CONSENT_VERSION,
};
