import { apiBaseUrl } from '../../util/api';
import { storableError } from '../../util/errors';
import { SERVICE_CATEGORIES } from '../../config/serviceCategories';

// Медленный ответ на сервере задержал бы весь HTML: дольше этого ждём, а потом
// отдаём страницу с загрузкой, и список подтянет браузер.
const SERVER_FETCH_TIMEOUT_MS = 5000;

// ================ Action types ================ //

export const FETCH_EXECUTORS_REQUEST = 'app/CategoryExecutorsPage/FETCH_EXECUTORS_REQUEST';
export const FETCH_EXECUTORS_SUCCESS = 'app/CategoryExecutorsPage/FETCH_EXECUTORS_SUCCESS';
export const FETCH_EXECUTORS_ERROR = 'app/CategoryExecutorsPage/FETCH_EXECUTORS_ERROR';
export const SERVER_DATA_REUSED = 'app/CategoryExecutorsPage/SERVER_DATA_REUSED';

// ================ Reducer ================ //

const initialState = {
  categoryId: null,
  executors: [],
  executorsLoaded: false,
  fetchInProgress: false,
  fetchExecutorsError: null,
  loadedOnServer: false,
};

export default function categoryExecutorsPageReducer(state = initialState, action = {}) {
  const { type, payload } = action;
  switch (type) {
    case FETCH_EXECUTORS_REQUEST: {
      // Повторная загрузка той же категории не прячет уже показанный список
      const isSameCategory = payload.categoryId === state.categoryId;
      return {
        ...state,
        categoryId: payload.categoryId,
        executors: isSameCategory ? state.executors : [],
        executorsLoaded: isSameCategory && state.executorsLoaded,
        fetchInProgress: true,
        fetchExecutorsError: null,
        loadedOnServer: false,
      };
    }
    case FETCH_EXECUTORS_SUCCESS:
      if (payload.categoryId !== state.categoryId) {
        return state;
      }
      return {
        ...state,
        executors: payload.executors,
        executorsLoaded: true,
        fetchInProgress: false,
        loadedOnServer: payload.onServer,
      };
    case FETCH_EXECUTORS_ERROR:
      if (payload.categoryId !== state.categoryId) {
        return state;
      }
      return { ...state, fetchInProgress: false, fetchExecutorsError: payload.error };
    case SERVER_DATA_REUSED:
      return { ...state, loadedOnServer: false };
    default:
      return state;
  }
}

// ================ Action creators ================ //

export const fetchExecutorsRequest = categoryId => ({
  type: FETCH_EXECUTORS_REQUEST,
  payload: { categoryId },
});
export const fetchExecutorsSuccess = (categoryId, executors, onServer) => ({
  type: FETCH_EXECUTORS_SUCCESS,
  payload: { categoryId, executors, onServer },
});
export const fetchExecutorsError = (categoryId, error) => ({
  type: FETCH_EXECUTORS_ERROR,
  payload: { categoryId, error },
  error: true,
});
export const serverDataReused = () => ({ type: SERVER_DATA_REUSED });

// ================ Thunks ================ //

/**
 * Загружает исполнителей категории и на сервере, и при переходах в браузере.
 * Без серверной загрузки страница уходит со словом «Загрузка...», и поисковики
 * и AI-ассистенты, которые не выполняют JavaScript, не видят ни одного мастера.
 */
export const loadData = (params, search, config) => (dispatch, getState) => {
  const { categoryId } = params;
  if (!SERVICE_CATEGORIES.some(category => category.id === categoryId)) {
    return Promise.resolve();
  }

  const isServer = typeof window === 'undefined';
  const state = getState().CategoryExecutorsPage;

  // Сразу после серверного рендера браузер вызывает loadData ещё раз: список уже
  // в разметке, второй запрос ничего не добавит.
  if (!isServer && state.loadedOnServer && state.categoryId === categoryId) {
    dispatch(serverDataReused());
    return Promise.resolve();
  }

  dispatch(fetchExecutorsRequest(categoryId));

  // На сервере window недоступен, поэтому корень берём из конфигурации
  const baseUrl = isServer ? apiBaseUrl(config?.marketplaceRootURL) : apiBaseUrl();
  const signalMaybe = isServer ? { signal: AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS) } : {};

  return fetch(
    `${baseUrl}/api/search-executors?category=${encodeURIComponent(categoryId)}`,
    signalMaybe
  )
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load executors: ${response.status}`);
      }
      return response.json();
    })
    .then(data => dispatch(fetchExecutorsSuccess(categoryId, data.data || [], isServer)))
    .catch(e => {
      // Ошибку на сервере не показываем: страница уйдёт с загрузкой, и браузер
      // повторит запрос сам, а не останется с сообщением «не удалось загрузить».
      if (!isServer) {
        dispatch(fetchExecutorsError(categoryId, storableError(e)));
      }
    });
};
