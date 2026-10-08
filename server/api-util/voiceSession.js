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
const {
  TOOL_DEFINITIONS,
  STEP_TOOL_DEFINITIONS,
  APP_STEP_TOOL_DEFINITIONS,
  DEADLINES,
  dubaiDate,
} = require('./voiceTools');

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

// Testers who need more than the daily cap. Same shape as the pilot list:
// comma-separated user ids, empty means nobody is exempt.
const dailyLimitExemptUserIds = () =>
  (process.env.VOICE_DAILY_LIMIT_EXEMPT_USER_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

const isExemptFromDailyVoiceLimit = userId =>
  Boolean(userId) && dailyLimitExemptUserIds().includes(userId);

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
 * Шаги мастеров на сайте и в приложении — в том порядке и под теми названиями,
 * что видит человек. Помощник заполняет их по шагам, пока идёт разговор; сборки
 * приложения, которые не называют своих шагов, получают готовый черновик в конце.
 */
const WIZARD_STEPS = {
  site: [
    { id: 'title', name: 'Название', holds: 'название и описание' },
    {
      id: 'details',
      name: 'Детали',
      holds: 'категория и срок; подкатегория и способ оплаты — если подходят',
    },
    { id: 'location', name: 'Локация', holds: 'адрес' },
    { id: 'pricing', name: 'Цена', holds: 'бюджет в дирхамах' },
    { id: 'photos', name: 'Фото', holds: 'фото добавляет и задание публикует сам человек' },
  ],
  app: [
    {
      id: 'task',
      name: 'Задание',
      holds:
        'название, описание, категория и под ними фото; фото человек добавляет сам кнопкой «+»',
    },
    { id: 'details', name: 'Детали', holds: 'адрес, бюджет в дирхамах и дата' },
    {
      id: 'review',
      name: 'Проверка',
      holds: 'человек проверяет задание и сам нажимает «Опубликовать»',
    },
  ],
};

const wizardOf = raw => (raw === 'app' ? 'app' : 'site');

const wizardStepIdOf = (raw, wizard = 'site') => {
  const steps = WIZARD_STEPS[wizardOf(wizard)];
  return (steps.find(step => step.id === raw) || steps[0]).id;
};

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
  `На экране мастер задания из пяти шагов: ${WIZARD_STEPS.site.map(step => `«${step.name}»`).join(', ')}. Иди по шагам по порядку и спрашивай о том шаге, который открыт: что нужно сделать, когда, где, какой бюджет в дирхамах. Способ оплаты спроси, только если человек сам заговорит о нём.`,
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

// The app animates what the backend filled in and only then opens the next
// step, so a question about that step must wait for the backend to report it.
const LIVE_APP_STEP_FLOW = [
  'На экране приложения мастер задания из трёх шагов: «Задание» — что нужно сделать и фото, «Детали» — адрес, бюджет и дата, «Проверка». Спрашивай в том порядке, в каком всё это стоит на экране. Говори только о том шаге, который открыт, и не спрашивай о следующем, пока бэкенд не сообщит, что он открыт.',
  'Сам ты в форму ничего не вписываешь. Поля вписывает бэкенд, и только то, что ты ему передал; приложение показывает их и само переходит к следующему шагу. Адреса и число мастеров тоже получай от бэкенда. Сам ничего не придумывай и не обещай конкретных мастеров, сроков или цен.',
  'Фото голосом не добавить: человек добавляет их сам кнопкой «+» на шаге «Задание». Когда бэкенд попросит спросить о фото, спроси, есть ли фото к заданию, и если есть, предложи добавить их сейчас. Пока человек выбирает фото, не торопи его: приложение само сообщит, когда они добавятся.',
  'Задание не публикуется в разговоре: когда бэкенд сообщит, что открыт шаг «Проверка», попроси проверить задание на экране и нажать «Опубликовать» и попрощайся.',
  '',
  'Delegation policy:',
  'Backend tools:',
  '- Форма задания: составляет из рассказа человека название, описание и категорию, вписывает их, адрес, бюджет и дату в форму на экране и отвечает, какой шаг открыт и чего на нём не хватает.',
  '- Адреса: находит адрес в Дубае и предлагает варианты.',
  '- Мастера: говорит, сколько специалистов в категории.',
  '',
  'Delegate to the backend when:',
  '- Человек рассказал что-то о задании: что сделать, где, какой бюджет, когда — даже одной фразой и даже если ответил не на тот вопрос, который ты задал.',
  '- Человек назвал адрес, район или здание или выбрал один из вариантов адреса.',
  '- Человек ответил, что фото нет или что добавит их позже.',
  '- Человек поправил или дополнил то, что уже сказал.',
  '',
  'Do not delegate to the backend when:',
  '- Человек только поздоровался, поблагодарил или прощается.',
  '- Тебе нужно коротко переспросить, чтобы понять ответ.',
  '- Человек сказал, что сейчас добавит фото: скажи, что подождёшь.',
  '',
  'Передавай бэкенду сразу после ответа человека, до следующего вопроса: о чём спросить дальше, скажет бэкенд. Пока он работает, можно коротко сказать, что записываешь. Не говори, что поле заполнено или задание готово, пока бэкенд этого не подтвердил.',
];

const LIVE_CLOSING =
  'Если человеку больше ничего не нужно, коротко попрощайся и закончи словами «Всего доброго!». Говори «Всего доброго» только в самом конце разговора: по этим словам приложение закрывает разговор.';

const liveFlow = (stepMode, wizard) => {
  if (!stepMode) return LIVE_DRAFT_FLOW;
  return wizard === 'app' ? LIVE_APP_STEP_FLOW : LIVE_STEP_FLOW;
};

const liveInstructions = (stepMode, wizard) =>
  [...LIVE_PERSONA, ...liveFlow(stepMode, wizard), LIVE_CLOSING].join('\n');

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

// The app's form starts with cash payment already chosen, so a payment method
// alone does not mean the person has filled anything in.
const hasTaskContent = fields => Object.keys(fields).some(key => key !== 'paymentMethod');

const currentFieldsSection = (fields, stepMode) => {
  if (!hasTaskContent(fields)) return [];
  const lines = Object.entries(CURRENT_FIELD_LABELS)
    .filter(([key]) => fields[key] !== undefined)
    .map(([key, label]) => `- ${label}: ${fields[key]}`);
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
  !hasTaskContent(fields)
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

const APP_STEP_FAREWELL_INSTRUCTIONS = [
  'Человек молчит. Коротко попрощайся в своём характере, одним-двумя предложениями:',
  'скажи, что задание заполнено, осталось проверить его на экране и нажать «Опубликовать», и закончи словами «Всего доброго!».',
].join(' ');

const farewellFor = (stepMode, wizard = 'site') => {
  if (!stepMode) return FAREWELL_INSTRUCTIONS;
  return wizard === 'app' ? APP_STEP_FAREWELL_INSTRUCTIONS : STEP_FAREWELL_INSTRUCTIONS;
};

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

const stepIntro = (currentStep, wizard) => {
  const steps = WIZARD_STEPS[wizard];
  const index = steps.findIndex(step => step.id === currentStep);
  return [
    `Ты бэкенд голосового помощника YouDu. Человек заполняет задание в мастере на экране ${
      wizard === 'app' ? 'приложения' : 'сайта'
    }, а ты прямо во время разговора вписываешь в форму то, что он рассказал, через fill_task_fields.`,
    'Шаги мастера:',
    ...steps.map((step, i) => `${i + 1}. «${step.name}» — ${step.holds}.`),
    `Сейчас открыт шаг ${index + 1} «${steps[index].name}».`,
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

// Asking for the title, description and category one by one would sound like a
// questionnaire: the backend writes them itself once it knows what the job is.
const APP_STEP_RULES = [
  '- Шаг «Задание» заполняй, когда понятно, что именно нужно сделать. Одной общей фразы мало: на «нужен ремонт в ванной» или «нужна уборка» спроси, что именно нужно сделать. Когда понятно, сам составь название, описание и категорию и передай их одним вызовом fill_task_fields. Не спрашивай отдельно ни название, ни описание, ни категорию.',
  '- Фото на шаге «Задание» человек добавляет сам кнопкой «+», голосом их не добавить. Когда ответ fill_task_fields просит спросить о фото, спроси, есть ли фото к заданию, и если есть, предложи добавить их сейчас: по фото мастерам проще оценить работу и назвать цену. Не настаивай.',
  '- Если человек ответил, что фото нет или что добавит их позже, сразу вызови fill_task_fields с photos_done: true: приложение перейдёт к шагу «Детали». Если он сказал, что сейчас добавит фото, ничего не вызывай: когда фото добавятся, приложение само перейдёт дальше.',
  '- Если человек уже назвал бюджет или дату, передай их в том же вызове: приложение покажет их на шаге «Детали», и переспрашивать их не нужно. Адрес, названный заранее, ищи через resolve_location, когда откроется шаг «Детали».',
  '- Не спрашивай о следующем шаге, пока ответ fill_task_fields не сообщит, что он открыт: приложение переходит к нему, когда заполнен открытый, и человек должен видеть шаг, о котором его спрашивают.',
  '- На шаге «Детали» спрашивай в том порядке, в каком поля стоят на экране: сначала адрес, потом бюджет, потом дату.',
  '- Передавай только то, что человек сказал, и то, что ты составил из его слов: название, описание, категорию. Остальные поля — null. Не подставляй дату, бюджет, адрес или способ оплаты, которых человек не называл.',
  '- Ответ fill_task_fields говорит, какой шаг открыт и чего на нём не хватает: спрашивай только об этом, по одному вопросу. Человек может и сам переключать шаги и вводить данные руками — ориентируйся на последнее, что известно об экране.',
  '- Если человек просит изменить уже заполненное, передай в fill_task_fields только изменённые поля.',
  '- Когда открыт шаг «Проверка», все поля заполнены: коротко попроси проверить задание на экране и нажать «Опубликовать». Если фото нет и о них ещё не спрашивали, одной фразой скажи, что их можно добавить на первом шаге: по фото мастерам проще оценить работу. Не настаивай. Затем попрощайся словами «Всего доброго!».',
];

const ADDRESS_RULE =
  '- Адрес: всякий раз вызывай resolve_location. Места Дубая люди называют по-английски с русским акцентом, а расшифровка часто пишет их кириллицей и с ошибками. Передавай официальное латинское название: «Эмаар Бичфронт» → Emaar Beachfront, «Блю Уотерс» → Bluewaters, «Порт де ла Мер» → Port de La Mer, «Джей Эл Ти» → JLT. Сверяйся со списком районов ниже.';

const ADDRESS_CHOICE = {
  site: 'Если вариантов несколько, перечисли их и спроси, какой верный. place_id бери только из ответа resolve_location.',
  app: 'Если один из вариантов явно совпадает с тем, что назвал человек, сразу передай его place_id в fill_task_fields: адрес появится на экране. Перечисляй варианты, только если непонятно, какой из них нужен. place_id бери только из ответа resolve_location.',
};

const siteDeadlineRule = () =>
  `- Срок — одно из значений: ${Object.entries(DEADLINES)
    .map(([id, label]) => `${id} (${label})`)
    .join(', ')}. «На этой неделе», «в ближайшие дни», «в пятницу» — это week. «Не срочно» — long-term.`;

const APP_DEADLINE_RULE =
  '- Дата — день, когда нужно сделать, в виде ГГГГ-ММ-ДД, не раньше сегодняшнего. «Сегодня», «завтра», «в пятницу», «пятого октября» — эти дни: бери дату из списка ближайших дней выше. Если назван не день, а срок, не переспрашивай: «на этой неделе» — ближайшее воскресенье, «в ближайшие дни» — через три дня, «не срочно» — через месяц.';

const DAYS_LISTED = 14;

// The backend reads «в пятницу» off this list instead of counting weekdays.
const upcomingDays = now =>
  Array.from({ length: DAYS_LISTED }, (_, i) => {
    const date = dubaiDate(now, i);
    const label = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'UTC',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(`${date}T00:00:00Z`));
    return `${label} — ${date}`;
  }).join('; ');

/**
 * @param {Object} params
 * @param {string|null} [params.currentStep] открытый шаг мастера. Без него
 *   разговор идёт как в старых сборках приложения: черновик целиком в конце.
 * @param {'site'|'app'} [params.wizard] чей мастер на экране
 */
const backendInstructions = ({
  categories,
  now,
  currentFields = {},
  currentStep = null,
  wizard = 'site',
}) => {
  const stepMode = !!currentStep;
  const appSteps = stepMode && wizard === 'app';
  return [
    ...(stepMode
      ? stepIntro(currentStep, wizard)
      : [
          'Ты бэкенд голосового помощника YouDu. Твоя цель — собрать данные для prepare_task_draft и вызвать его.',
        ]),
    `Сегодня ${dubaiToday(now)} (время Дубая).`,
    ...(appSteps ? [`Ближайшие дни: ${upcomingDays(now)}.`] : []),
    '',
    'Правила:',
    ...(stepMode ? (appSteps ? APP_STEP_RULES : STEP_RULES) : []),
    `${ADDRESS_RULE} ${ADDRESS_CHOICE[appSteps ? 'app' : 'site']}`,
    appSteps ? APP_DEADLINE_RULE : siteDeadlineRule(),
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

const backendTools = (stepMode, wizard) => {
  if (!stepMode) return TOOL_DEFINITIONS;
  return wizard === 'app' ? APP_STEP_TOOL_DEFINITIONS : STEP_TOOL_DEFINITIONS;
};

/**
 * @param {{categories: Array, now: Date, currentFields?: Object, currentStep?: string|null, wizard?: 'site'|'app'}} params
 *   currentStep — открытый шаг мастера (id из WIZARD_STEPS[wizard]); без него
 *   помощник собирает черновик целиком, как ждут старые сборки приложения.
 * @returns {Object} Поле `session` запроса POST /v1/live/sessions.
 */
const buildSessionConfig = ({
  categories,
  now,
  currentFields = {},
  currentStep = null,
  wizard = 'site',
}) => ({
  model: liveModel(),
  instructions: liveInstructions(!!currentStep, wizard),
  ...(outputVoice() ? { audio: { output: { voice: outputVoice() } } } : {}),
  delegation: {
    type: 'responses',
    responses: {
      model: backendModel(),
      instructions: backendInstructions({ categories, now, currentFields, currentStep, wizard }),
      tools: backendTools(!!currentStep, wizard),
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
  isExemptFromDailyVoiceLimit,
  buildSessionConfig,
  wizardOf,
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
