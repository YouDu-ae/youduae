import { apiBaseUrl } from '../../util/api';
import { storableError } from '../../util/errors';

// ================ Action types ================ //

export const FETCH_ARTICLE_REQUEST = 'app/BlogArticlePage/FETCH_ARTICLE_REQUEST';
export const FETCH_ARTICLE_SUCCESS = 'app/BlogArticlePage/FETCH_ARTICLE_SUCCESS';
export const FETCH_ARTICLE_ERROR = 'app/BlogArticlePage/FETCH_ARTICLE_ERROR';
export const FETCH_ARTICLE_NOT_FOUND = 'app/BlogArticlePage/FETCH_ARTICLE_NOT_FOUND';

// ================ Reducer ================ //

const initialState = {
  article: null,
  categories: [],
  fetchInProgress: false,
  fetchArticleError: null,
  articleNotFound: false,
};

export default function blogArticlePageReducer(state = initialState, action = {}) {
  const { type, payload } = action;
  switch (type) {
    case FETCH_ARTICLE_REQUEST:
      return { ...initialState, fetchInProgress: true };
    case FETCH_ARTICLE_SUCCESS:
      return {
        ...state,
        fetchInProgress: false,
        article: payload,
        categories: payload.categories || [],
      };
    case FETCH_ARTICLE_NOT_FOUND:
      return { ...state, fetchInProgress: false, articleNotFound: true };
    case FETCH_ARTICLE_ERROR:
      return { ...state, fetchInProgress: false, fetchArticleError: payload };
    default:
      return state;
  }
}

// ================ Action creators ================ //

export const fetchArticleRequest = () => ({ type: FETCH_ARTICLE_REQUEST });
export const fetchArticleSuccess = article => ({ type: FETCH_ARTICLE_SUCCESS, payload: article });
export const fetchArticleNotFound = () => ({ type: FETCH_ARTICLE_NOT_FOUND });
export const fetchArticleError = e => ({
  type: FETCH_ARTICLE_ERROR,
  payload: e,
  error: true,
});

// ================ Thunks ================ //

/**
 * Загружает статью на сервере, чтобы заголовок, описание, обложка и Schema.org
 * попали в серверный HTML. Без этого краулеры мессенджеров и поисковиков видят
 * страницу до загрузки данных и показывают заглушку вместо названия статьи.
 */
export const loadData = (params, search, config) => dispatch => {
  const { slug } = params;
  dispatch(fetchArticleRequest());

  // На сервере window недоступен, поэтому корень берём из конфигурации
  const baseUrl = apiBaseUrl(config?.marketplaceRootURL);

  return fetch(`${baseUrl}/api/blog/articles/${slug}`)
    .then(response => {
      if (response.status === 404) {
        dispatch(fetchArticleNotFound());
        return null;
      }
      if (!response.ok) {
        throw new Error(`Failed to load article: ${response.status}`);
      }
      return response.json().then(data => dispatch(fetchArticleSuccess(data)));
    })
    .catch(e => dispatch(fetchArticleError(storableError(e))));
};
