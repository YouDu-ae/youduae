/**
 * GET /api/voice/access — показывать ли вошедшему пользователю голосовой ввод.
 *
 * Выключенный пилот отвечает { allowed: false }, а не 404: кнопка спрашивает
 * при каждом открытии мастера, и ошибки в консоли у всех посетителей были бы шумом.
 */

const { isVoiceAllowedFor } = require('../api-util/voiceSession');

module.exports = (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.status(200).json({ allowed: isVoiceAllowedFor(req.authUserId) });
};
