import { apiBaseUrl } from '../../util/api';

// Блок необязательный: дольше этого сервер страницу не держит, задание
// месяца тогда подтянет браузер.
const SERVER_FETCH_TIMEOUT_MS = 5000;

// ================ Action types ================ //

export const FETCH_TASK_OF_THE_MONTH_SUCCESS =
  'app/CooperationPage/FETCH_TASK_OF_THE_MONTH_SUCCESS';
export const SERVER_DATA_REUSED = 'app/CooperationPage/SERVER_DATA_REUSED';

// ================ Reducer ================ //

const initialState = {
  month: null,
  taskOfTheMonth: null,
  loadedOnServer: false,
};

export default function cooperationPageReducer(state = initialState, action = {}) {
  const { type, payload } = action;
  switch (type) {
    case FETCH_TASK_OF_THE_MONTH_SUCCESS:
      return {
        ...state,
        month: payload.month,
        taskOfTheMonth: payload.task,
        loadedOnServer: payload.onServer,
      };
    case SERVER_DATA_REUSED:
      return { ...state, loadedOnServer: false };
    default:
      return state;
  }
}

// ================ Action creators ================ //

export const fetchTaskOfTheMonthSuccess = (month, task, onServer) => ({
  type: FETCH_TASK_OF_THE_MONTH_SUCCESS,
  payload: { month, task, onServer },
});
export const serverDataReused = () => ({ type: SERVER_DATA_REUSED });

// ================ Thunks ================ //

/**
 * Задание месяца грузится и на сервере: иначе поисковики и AI-ассистенты,
 * которые не выполняют JavaScript, не увидят ни задания, ни мастера.
 */
export const loadData = (params, search, config) => (dispatch, getState) => {
  const isServer = typeof window === 'undefined';

  // Сразу после серверного рендера браузер вызывает loadData ещё раз
  if (!isServer && getState().CooperationPage.loadedOnServer) {
    dispatch(serverDataReused());
    return Promise.resolve();
  }

  const baseUrl = isServer ? apiBaseUrl(config?.marketplaceRootURL) : apiBaseUrl();
  const signalMaybe = isServer ? { signal: AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS) } : {};

  return fetch(`${baseUrl}/api/task-of-the-month`, signalMaybe)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load the task of the month: ${response.status}`);
      }
      return response.json();
    })
    .then(data => dispatch(fetchTaskOfTheMonthSuccess(data.month, data.task || null, isServer)))
    .catch(() => {
      // Без данных блока просто нет на странице, а на сервере запрос повторит браузер
    });
};
