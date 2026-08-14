/**
 * Общая авторизация для серверных маршрутов.
 *
 * Личность пользователя берётся из cookie-сессии Sharetribe, а не из тела или
 * query-параметров запроса: идентификаторы пользователей публичны (они стоят в
 * адресах профилей /u/:id), поэтому любое доверие к переданному клиентом userId
 * равносильно отсутствию проверки.
 */

const { getSdk } = require('./sdk');

const getAuthenticatedUserId = async (req, res) => {
  const sdk = getSdk(req, res);
  const response = await sdk.currentUser.show();
  return response.data.data.id.uuid;
};

// Кладёт id пользователя в req.authUserId; без валидной сессии — 401.
const requireUser = async (req, res, next) => {
  try {
    req.authUserId = await getAuthenticatedUserId(req, res);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Authentication required' });
  }
};

// Для маршрутов, открытых и гостям: заполняет req.authUserId, если сессия есть,
// и молча пропускает дальше, если её нет.
const attachUser = async (req, res, next) => {
  try {
    req.authUserId = await getAuthenticatedUserId(req, res);
  } catch (e) {
    req.authUserId = null;
  }
  next();
};

module.exports = {
  getAuthenticatedUserId,
  requireUser,
  attachUser,
};
