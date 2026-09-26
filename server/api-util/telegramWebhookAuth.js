/**
 * Проверка, что запрос на webhook действительно пришёл от Telegram.
 *
 * Адрес webhook публичен, а обработчик выполняет админские команды (/pending,
 * /tickets) для любого апдейта с chat.id админ-чата. Telegram присылает с
 * каждым апдейтом заголовок X-Telegram-Bot-Api-Secret-Token со значением,
 * переданным в setWebhook как secret_token; без совпадения апдейт отклоняется.
 *
 * Без TELEGRAM_WEBHOOK_SECRET отклоняется всё: молчащий бот лучше открытого.
 * Telegram повторяет неподтверждённые апдейты, так что при смене секрета
 * сообщения не теряются.
 */

const crypto = require('crypto');

const HEADER = 'x-telegram-bot-api-secret-token';

const secretsMatch = (received, expected) => {
  const a = Buffer.from(String(received));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const requireTelegramSecret = (req, res, next) => {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) {
    console.error('Telegram webhook rejected: TELEGRAM_WEBHOOK_SECRET is not set');
    return res.sendStatus(401);
  }

  const received = req.get(HEADER);
  if (!received || !secretsMatch(received, expected)) {
    console.warn(`Telegram webhook rejected: bad secret from ${req.ip}`);
    return res.sendStatus(401);
  }

  return next();
};

module.exports = { requireTelegramSecret };
