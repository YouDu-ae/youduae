/**
 * POST /api/voice/consent — согласие на передачу голоса в OpenAI.
 *
 * Тело: { granted: true } — дать согласие на текущую версию текста,
 * { granted: false } — отозвать. Без действующего согласия /api/voice/session
 * разговор не открывает (PDPL ОАЭ, правило Apple 5.1.2(i)).
 */

const db = require('../db');
const { isVoiceAllowedFor, VOICE_CONSENT_VERSION } = require('../api-util/voiceSession');

module.exports = async (req, res) => {
  const granted = req.body?.granted;
  if (typeof granted !== 'boolean') {
    return res.status(400).json({ error: 'granted must be true or false' });
  }

  const userId = req.authUserId;
  // Withdrawing is always possible; granting only where the pilot is open.
  if (granted && !isVoiceAllowedFor(userId)) {
    return res.status(403).json({ error: 'not_in_pilot' });
  }

  try {
    if (granted) {
      await db.grantVoiceConsent(userId, VOICE_CONSENT_VERSION);
    } else {
      await db.withdrawVoiceConsent(userId);
    }
    return res.status(200).json({ consented: granted, version: VOICE_CONSENT_VERSION });
  } catch (error) {
    console.error('❌ voice-consent failed:', error.message);
    return res.status(500).json({ error: 'consent_not_saved' });
  }
};
