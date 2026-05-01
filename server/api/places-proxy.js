/**
 * Прокси Places API для мобильного приложения.
 * Ключ с referrer-ограничением работает в браузере, но не из RN fetch (пустой referer).
 * Запросы идут с Heroku → Google принимает ключ с теми же ограничениями, что и для бэкенда / без referer.
 */

const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

/** Серверный ключ без referrer (или IP Heroku). Если в GCP только referrer-ключ для сайта — задайте GOOGLE_MAPS_SERVER_KEY. */
function getMapsKey() {
  return (
    process.env.GOOGLE_MAPS_SERVER_KEY ||
    process.env.REACT_APP_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    ''
  );
}

function badRequest(res, message) {
  res.status(400).json({ status: 'REQUEST_DENIED', error_message: message });
}

/**
 * GET /api/places/autocomplete?input=...&sessiontoken=...
 */
async function autocomplete(req, res) {
  const key = getMapsKey();
  if (!key) {
    res.status(503).json({
      status: 'REQUEST_DENIED',
      error_message: 'Сервер: не задан REACT_APP_GOOGLE_MAPS_API_KEY',
    });
    return;
  }

  const input = String(req.query.input || '').trim();
  if (!input || input.length > 280) {
    badRequest(res, 'Некорректный параметр input');
    return;
  }

  const sessiontoken = String(req.query.sessiontoken || '').slice(0, 120);

  const params = new URLSearchParams({
    input,
    key,
    components: 'country:ae',
    language: 'ru',
  });
  if (sessiontoken) params.set('sessiontoken', sessiontoken);

  try {
    const url = `${AUTOCOMPLETE_URL}?${params.toString()}`;
    const r = await fetch(url);
    const json = await r.json();
    res.status(200).json(json);
  } catch (e) {
    console.error('places-proxy autocomplete:', e);
    res.status(502).json({
      status: 'REQUEST_DENIED',
      error_message: 'Не удалось связаться с Google Places',
    });
  }
}

/**
 * GET /api/places/details?place_id=...&sessiontoken=...
 */
async function details(req, res) {
  const key = getMapsKey();
  if (!key) {
    res.status(503).json({
      status: 'REQUEST_DENIED',
      error_message: 'Сервер: не задан REACT_APP_GOOGLE_MAPS_API_KEY',
    });
    return;
  }

  const placeId = String(req.query.place_id || '').trim();
  if (!placeId || placeId.length > 256) {
    badRequest(res, 'Некорректный place_id');
    return;
  }

  const sessiontoken = String(req.query.sessiontoken || '').slice(0, 120);

  const params = new URLSearchParams({
    place_id: placeId,
    key,
    fields: 'formatted_address,geometry/location',
    language: 'ru',
  });
  if (sessiontoken) params.set('sessiontoken', sessiontoken);

  try {
    const url = `${DETAILS_URL}?${params.toString()}`;
    const r = await fetch(url);
    const json = await r.json();
    res.status(200).json(json);
  } catch (e) {
    console.error('places-proxy details:', e);
    res.status(502).json({
      status: 'REQUEST_DENIED',
      error_message: 'Не удалось связаться с Google Places',
    });
  }
}

module.exports = { autocomplete, details };
