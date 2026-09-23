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
const { TOOL_DEFINITIONS, DEADLINES } = require('./voiceTools');

const LIVE_SESSIONS_URL = 'https://api.openai.com/v1/live/sessions';

// Heroku обрывает запрос на 30-й секунде; ответ OpenAI должен успеть раньше.
const CREATE_TIMEOUT_MS = 15 * 1000;

// Разговор о задании укладывается в несколько минут. Инструменты по сессии,
// открытой раньше, отвергаются: это не даёт бесконечно пользоваться старым id.
const SESSION_MAX_AGE_MS = 30 * 60 * 1000;

const DEFAULT_DAILY_LIMIT = 5;

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

const LIVE_INSTRUCTIONS = [
  'Ты голосовой помощник YouDu — сервиса, где жители Дубая находят мастеров для любых задач.',
  'В этом разговоре ты помогаешь человеку составить задание. Ничем другим не занимаешься: если просят о постороннем, вежливо скажи, что сейчас помогаешь только с заданием.',
  'Говори по-русски, коротко, одним-двумя предложениями. Задавай по одному вопросу за раз.',
  'Узнай, что нужно сделать, где, когда и какой бюджет в дирхамах. Способ оплаты спроси, только если человек сам заговорит о нём.',
  'Адреса, число мастеров и черновик задания получай от бэкенда. Сам ничего из этого не придумывай и не обещай конкретных мастеров, сроков или цен.',
  'Задание не публикуется в разговоре. Когда черновик готов, кратко перескажи его и попроси проверить на экране и нажать «Опубликовать».',
].join('\n');

const backendInstructions = ({ categories, now }) =>
  [
    'Ты бэкенд голосового помощника YouDu. Твоя цель — собрать данные для prepare_task_draft и вызвать его.',
    `Сегодня ${dubaiToday(now)} (время Дубая).`,
    '',
    'Правила:',
    '- Адрес: всякий раз вызывай resolve_location со словами пользователя. Если вариантов несколько, перечисли их и спроси, какой верный. place_id бери только из ответа resolve_location.',
    `- Срок — одно из значений: ${Object.entries(DEADLINES)
      .map(([id, label]) => `${id} (${label})`)
      .join(', ')}. «На этой неделе», «в ближайшие дни», «в пятницу» — это week. «Не срочно» — long-term.`,
    '- Время суток, этаж, доступ в здание, материалы и прочие подробности пиши в описание: отдельных полей для них нет.',
    '- Бюджет — целое число дирхамов. «До 400» — это 400. Если бюджет не назван, спроси его.',
    '- Категорию и подкатегорию выбирай строго из списка ниже по id. Если ничего не подходит точно, выбери ближайшую категорию без подкатегории.',
    '- Когда категория ясна, можно вызвать count_specialists и честно сказать, сколько мастеров в категории. Задание видят все специалисты, откликнуться может любой.',
    '- Если prepare_task_draft вернул ошибки, переспроси только о полях с ошибками.',
    '- Никогда не говори, что задание опубликовано: это черновик, публикует человек.',
    '',
    'Категории (id — название: подкатегории):',
    formatCategories(categories),
  ].join('\n');

/**
 * @param {{categories: Array, now: Date}} params
 * @returns {Object} Поле `session` запроса POST /v1/live/sessions.
 */
const buildSessionConfig = ({ categories, now }) => ({
  model: liveModel(),
  instructions: LIVE_INSTRUCTIONS,
  delegation: {
    type: 'responses',
    responses: {
      model: backendModel(),
      instructions: backendInstructions({ categories, now }),
      tools: TOOL_DEFINITIONS,
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
  safetyIdentifierFor,
  createLiveSession,
  LiveSessionError,
  SESSION_MAX_AGE_MS,
};
