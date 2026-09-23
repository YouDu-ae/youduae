/**
 * POST /api/voice/tool — исполняет инструмент, который выбрала backend-модель.
 *
 * Тело: { sessionId, name, arguments } — поля вызова функции, как их прислал
 * GPT-Live по data channel; arguments — JSON-строка. Ответ: { output } — объект,
 * который браузер возвращает в сессию как function_call_output.
 *
 * Ошибки данных (неверная категория, адрес не найден) уходят в output как
 * { ok: false }, чтобы помощник мог переспросить. HTTP-ошибки — только когда
 * вызов не имеет права выполниться или сломалась инфраструктура.
 */

const db = require('../db');
const { getSdk } = require('../api-util/sdk');
const { fetchListingCategories } = require('../api-util/listingCategories');
const { executeTool, TOOL_NAMES } = require('../api-util/voiceTools');
const {
  isVoicePilotEnabled,
  isVoiceAllowedFor,
  SESSION_MAX_AGE_MS,
} = require('../api-util/voiceSession');

// Аргументы — короткий JSON от модели; длинное тело здесь означает мусор.
const MAX_ARGUMENTS_LENGTH = 8 * 1024;

const parseArguments = raw => {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string' || raw.length > MAX_ARGUMENTS_LENGTH) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
};

module.exports = async (req, res) => {
  if (!isVoicePilotEnabled()) {
    return res.status(404).json({ error: 'Not found' });
  }
  // Убранный из пилота не должен продолжать уже открытый разговор.
  if (!isVoiceAllowedFor(req.authUserId)) {
    return res.status(403).json({ error: 'not_in_pilot' });
  }

  const { sessionId, name } = req.body || {};
  if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 100) {
    return res.status(400).json({ error: 'sessionId is required' });
  }
  if (!TOOL_NAMES.includes(name)) {
    return res.status(400).json({ error: 'Unknown tool' });
  }

  try {
    // Без этой проверки эндпоинт стал бы бесплатным прокси к Google Places для
    // любого вошедшего: сессию нужно было открыть самому и недавно.
    const session = await db.getVoiceSession(sessionId);
    const startedAt = session ? new Date(session.started_at).getTime() : 0;
    if (!session || session.user_id !== req.authUserId) {
      return res.status(403).json({ error: 'Session does not belong to this user' });
    }
    if (Date.now() - startedAt > SESSION_MAX_AGE_MS) {
      return res.status(403).json({ error: 'Session has expired' });
    }

    const args = parseArguments(req.body.arguments);
    if (!args) {
      return res.status(200).json({ output: { ok: false, error: 'Аргументы вызова не разобраны.' } });
    }

    const categories = await fetchListingCategories(getSdk(req, res));
    const output = await executeTool(name, args, { categories });

    if (name === 'prepare_task_draft' && output.ok) {
      await db.markVoiceDraftReady(sessionId);
    }

    return res.status(200).json({ output });
  } catch (error) {
    console.error(`❌ voice-tool ${name} failed:`, error.message);
    return res.status(500).json({ error: 'Tool failed' });
  }
};
