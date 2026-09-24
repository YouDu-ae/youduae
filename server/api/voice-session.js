/**
 * POST /api/voice/session — открывает голосовой разговор пилота.
 *
 * Тело: { sdp } — SDP-предложение браузера. Ответ: { sessionId, sdp } — SDP-ответ
 * OpenAI, который браузер применяет как remote description.
 *
 * Только для вошедших пользователей: создание сессии сразу списывает деньги,
 * а у гостя нет ничего, к чему можно привязать дневной лимит.
 */

const db = require('../db');
const { getSdk } = require('../api-util/sdk');
const { fetchListingCategories } = require('../api-util/listingCategories');
const {
  isVoicePilotEnabled,
  isVoiceAllowedFor,
  dailySessionLimit,
  buildSessionConfig,
  safetyIdentifierFor,
  createLiveSession,
  LiveSessionError,
  VOICE_CONSENT_VERSION,
} = require('../api-util/voiceSession');

// SDP-предложение с одним аудиотреком и data channel весит несколько килобайт.
const MAX_SDP_LENGTH = 32 * 1024;

module.exports = async (req, res) => {
  if (!isVoicePilotEnabled()) {
    return res.status(404).json({ error: 'Not found' });
  }
  if (!isVoiceAllowedFor(req.authUserId)) {
    return res.status(403).json({ error: 'not_in_pilot' });
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ voice-session: OPENAI_API_KEY is not set');
    return res.status(503).json({ error: 'Голосовой помощник временно недоступен.' });
  }

  const sdp = req.body?.sdp;
  if (typeof sdp !== 'string' || !sdp.trim() || sdp.length > MAX_SDP_LENGTH) {
    return res.status(400).json({ error: 'SDP offer is required' });
  }

  const userId = req.authUserId;

  try {
    // Голос уходит в OpenAI только с явного согласия на текущий текст.
    const consented = await db.hasVoiceConsent(userId, VOICE_CONSENT_VERSION);
    if (!consented) {
      return res.status(403).json({ error: 'consent_required' });
    }

    // До обращения к OpenAI: отказ после создания сессии уже стоил бы денег.
    const used = await db.countRecentVoiceSessions(userId);
    if (used >= dailySessionLimit()) {
      return res.status(429).json({
        error: 'daily_limit',
        message: 'На сегодня голосовые разговоры закончились. Заполните задание вручную.',
      });
    }

    const categories = await fetchListingCategories(getSdk(req, res));
    const session = buildSessionConfig({ categories, now: new Date() });

    const created = await createLiveSession({
      sdp,
      session,
      safetyIdentifier: safetyIdentifierFor(userId),
    });

    // Без записи инструменты не признают сессию своей, и разговор всё равно
    // сломается на первом вызове — лучше отказать сразу.
    await db.recordVoiceSession({ sessionId: created.sessionId, userId });

    console.log(`🎙 voice-session: ${created.sessionId} for ${userId} (${used + 1} in 24h)`);
    return res.status(201).json(created);
  } catch (error) {
    if (error instanceof LiveSessionError) {
      console.error('❌ voice-session:', error.message);
      return res.status(error.status).json({ error: 'Не удалось начать разговор. Попробуйте ещё раз.' });
    }
    console.error('❌ voice-session failed:', error.message);
    return res.status(500).json({ error: 'Не удалось начать разговор. Попробуйте ещё раз.' });
  }
};
