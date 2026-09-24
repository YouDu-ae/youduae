/**
 * GET /api/voice/access — показывать ли вошедшему пользователю голосовой ввод
 * и дал ли он согласие на передачу голоса в OpenAI.
 *
 * Выключенный пилот отвечает { allowed: false }, а не 404: кнопка спрашивает
 * при каждом открытии мастера, и ошибки в консоли у всех посетителей были бы шумом.
 */

const db = require('../db');
const { isVoiceAllowedFor, VOICE_CONSENT_VERSION } = require('../api-util/voiceSession');

module.exports = async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const allowed = isVoiceAllowedFor(req.authUserId);
  if (!allowed) {
    return res.status(200).json({ allowed: false, consented: false });
  }

  try {
    const consented = await db.hasVoiceConsent(req.authUserId, VOICE_CONSENT_VERSION);
    return res.status(200).json({ allowed: true, consented });
  } catch (error) {
    // Unknown consent is treated as none: the person is simply asked again.
    console.error('❌ voice-access: consent lookup failed:', error.message);
    return res.status(200).json({ allowed: true, consented: false });
  }
};
