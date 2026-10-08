/**
 * POST /api/voice/session — открывает голосовой разговор пилота.
 *
 * Тело: { sdp, currentFields?, mode?, wizard?, currentStep? } — SDP-предложение
 * и что уже в форме. mode: 'steps' присылают мастера, которые помощник заполняет
 * по шагам, начиная с currentStep: сайт и, с wizard: 'app', приложение. Без mode
 * (старые сборки приложения) помощник собирает черновик целиком. Ответ:
 * { sessionId, sdp, ... } — SDP-ответ OpenAI, который клиент применяет как
 * remote description.
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
  isExemptFromDailyVoiceLimit,
  buildSessionConfig,
  wizardOf,
  wizardStepIdOf,
  farewellFor,
  PHOTO_TIP_INSTRUCTIONS,
  sanitizeCurrentFields,
  greetingFor,
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
    // A named tester can go past the cap; everyone else still stops at it.
    const exempt = isExemptFromDailyVoiceLimit(userId);
    const used = exempt ? null : await db.countRecentVoiceSessions(userId);
    if (!exempt && used >= dailySessionLimit()) {
      return res.status(429).json({
        error: 'daily_limit',
        message: 'На сегодня голосовые разговоры закончились. Заполните задание вручную.',
      });
    }

    const categories = await fetchListingCategories(getSdk(req, res));
    const currentFields = sanitizeCurrentFields(req.body?.currentFields);
    const stepMode = req.body?.mode === 'steps';
    const wizard = wizardOf(req.body?.wizard);
    const currentStep = stepMode ? wizardStepIdOf(req.body?.currentStep, wizard) : null;
    const session = buildSessionConfig({
      categories,
      now: new Date(),
      currentFields,
      currentStep,
      wizard,
    });

    const created = await createLiveSession({
      sdp,
      session,
      safetyIdentifier: safetyIdentifierFor(userId),
    });

    // Без записи инструменты не признают сессию своей, и разговор всё равно
    // сломается на первом вызове — лучше отказать сразу.
    // voice-tool reads the mode back to fill the right wizard.
    const mode = !stepMode ? 'draft' : wizard === 'app' ? 'app-steps' : 'steps';
    await db.recordVoiceSession({ sessionId: created.sessionId, userId, mode });

    console.log(
      `🎙 voice-session: ${created.sessionId} for ${userId} (${
        exempt ? 'no daily cap' : `${used + 1} in 24h`
      }${stepMode ? `, ${wizard} steps from ${currentStep}` : ''})`
    );
    return res.status(201).json({
      ...created,
      greeting: greetingFor(currentFields),
      farewell: farewellFor(stepMode, wizard),
      // В пошаговом режиме про фото говорит сам бэкенд, когда открывается шаг «Фото».
      ...(stepMode ? {} : { photoTip: PHOTO_TIP_INSTRUCTIONS }),
    });
  } catch (error) {
    if (error instanceof LiveSessionError) {
      console.error('❌ voice-session:', error.message);
      return res.status(error.status).json({ error: 'Не удалось начать разговор. Попробуйте ещё раз.' });
    }
    console.error('❌ voice-session failed:', error.message);
    return res.status(500).json({ error: 'Не удалось начать разговор. Попробуйте ещё раз.' });
  }
};
