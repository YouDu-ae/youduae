/**
 * Прокси Places API для мобильного приложения.
 * Ключ с referrer-ограничением работает в браузере, но не из RN fetch (пустой referer).
 * Запросы идут с Heroku → Google принимает ключ с теми же ограничениями, что и для бэкенда / без referer.
 *
 * Запросы к Google вынесены в fetchAutocomplete / fetchPlaceDetails, чтобы
 * голосовой помощник искал адреса тем же путём, что и приложение.
 */

const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

const MAX_INPUT_LENGTH = 280;
const MAX_PLACE_ID_LENGTH = 256;

/** Серверный ключ без referrer (или IP Heroku). Если в GCP только referrer-ключ для сайта — задайте GOOGLE_MAPS_SERVER_KEY. */
function getMapsKey() {
  return (
    process.env.GOOGLE_MAPS_SERVER_KEY ||
    process.env.REACT_APP_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    ''
  );
}

class PlacesError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'PlacesError';
    this.status = status;
  }
}

/**
 * Подсказки адресов в ОАЭ. Возвращает ответ Google как есть.
 * @throws {PlacesError}
 */
async function fetchAutocomplete({ input, sessiontoken = '' }) {
  const key = getMapsKey();
  if (!key) {
    throw new PlacesError(503, 'Сервер: не задан REACT_APP_GOOGLE_MAPS_API_KEY');
  }

  const query = String(input || '').trim();
  if (!query || query.length > MAX_INPUT_LENGTH) {
    throw new PlacesError(400, 'Некорректный параметр input');
  }

  const params = new URLSearchParams({
    input: query,
    key,
    components: 'country:ae',
    language: 'ru',
  });
  const token = String(sessiontoken || '').slice(0, 120);
  if (token) params.set('sessiontoken', token);

  try {
    const r = await fetch(`${AUTOCOMPLETE_URL}?${params.toString()}`);
    return await r.json();
  } catch (e) {
    console.error('places-proxy autocomplete:', e);
    throw new PlacesError(502, 'Не удалось связаться с Google Places');
  }
}

/**
 * Адрес и координаты места. Возвращает ответ Google как есть.
 * @throws {PlacesError}
 */
async function fetchPlaceDetails({ placeId, sessiontoken = '' }) {
  const key = getMapsKey();
  if (!key) {
    throw new PlacesError(503, 'Сервер: не задан REACT_APP_GOOGLE_MAPS_API_KEY');
  }

  const id = String(placeId || '').trim();
  if (!id || id.length > MAX_PLACE_ID_LENGTH) {
    throw new PlacesError(400, 'Некорректный place_id');
  }

  const params = new URLSearchParams({
    place_id: id,
    key,
    fields: 'formatted_address,geometry/location',
    language: 'ru',
  });
  const token = String(sessiontoken || '').slice(0, 120);
  if (token) params.set('sessiontoken', token);

  try {
    const r = await fetch(`${DETAILS_URL}?${params.toString()}`);
    return await r.json();
  } catch (e) {
    console.error('places-proxy details:', e);
    throw new PlacesError(502, 'Не удалось связаться с Google Places');
  }
}

const sendPlacesError = (res, error) => {
  if (!(error instanceof PlacesError)) throw error;
  res.status(error.status).json({ status: 'REQUEST_DENIED', error_message: error.message });
};

/**
 * GET /api/places/autocomplete?input=...&sessiontoken=...
 */
async function autocomplete(req, res) {
  try {
    const json = await fetchAutocomplete({
      input: req.query.input,
      sessiontoken: req.query.sessiontoken,
    });
    res.status(200).json(json);
  } catch (error) {
    sendPlacesError(res, error);
  }
}

/**
 * GET /api/places/details?place_id=...&sessiontoken=...
 */
async function details(req, res) {
  try {
    const json = await fetchPlaceDetails({
      placeId: req.query.place_id,
      sessiontoken: req.query.sessiontoken,
    });
    res.status(200).json(json);
  } catch (error) {
    sendPlacesError(res, error);
  }
}

module.exports = { autocomplete, details, fetchAutocomplete, fetchPlaceDetails, PlacesError };
