import { storableError } from '../../util/errors';
import { parse, getValidInboxSort } from '../../util/urlHelpers';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { transitions as assignmentTransitions } from '../../transactions/transactionProcessAssignment';

// ================ Action types ================ //

export const FETCH_ORDERS_OR_SALES_REQUEST = 'app/InboxPage/FETCH_ORDERS_OR_SALES_REQUEST';
export const FETCH_ORDERS_OR_SALES_SUCCESS = 'app/InboxPage/FETCH_ORDERS_OR_SALES_SUCCESS';
export const FETCH_ORDERS_OR_SALES_ERROR = 'app/InboxPage/FETCH_ORDERS_OR_SALES_ERROR';

// ================ Reducer ================ //

const entityRefs = entities =>
  entities.map(entity => ({
    id: entity.id,
    type: entity.type,
  }));

const initialState = {
  fetchInProgress: false,
  fetchOrdersOrSalesError: null,
  pagination: null,
  transactionRefs: [],
};

export default function inboxPageReducer(state = initialState, action = {}) {
  const { type, payload } = action;
  switch (type) {
    case FETCH_ORDERS_OR_SALES_REQUEST:
      return { ...state, fetchInProgress: true, fetchOrdersOrSalesError: null };
    case FETCH_ORDERS_OR_SALES_SUCCESS: {
      const transactions = payload.data.data;
      return {
        ...state,
        fetchInProgress: false,
        transactionRefs: entityRefs(transactions),
        pagination: payload.data.meta,
      };
    }
    case FETCH_ORDERS_OR_SALES_ERROR:
      console.error(payload); // eslint-disable-line
      return { ...state, fetchInProgress: false, fetchOrdersOrSalesError: payload };

    default:
      return state;
  }
}

// ================ Action creators ================ //

const fetchOrdersOrSalesRequest = () => ({ type: FETCH_ORDERS_OR_SALES_REQUEST });
const fetchOrdersOrSalesSuccess = response => ({
  type: FETCH_ORDERS_OR_SALES_SUCCESS,
  payload: response,
});
const fetchOrdersOrSalesError = e => ({
  type: FETCH_ORDERS_OR_SALES_ERROR,
  error: true,
  payload: e,
});

// ================ Helper functions ================ //

/**
 * Get transitions to filter by based on subtab
 * @param {string} subtab - 'active', 'need-review', or 'completed'
 * @returns {array} - array of transition names to filter by
 */
const getTransitionsBySubtab = (subtab) => {
  switch (subtab) {
    case 'active':
      // Общие заявки исполнителей: только отправленные отклики
      return [
        assignmentTransitions.INQUIRE,
      ];
    case 'need-review':
      // Одобренные исполнители: работа в процессе
      return [
        assignmentTransitions.ACCEPT_OFFER,
      ];
    case 'completed':
      // Завершены (ожидают отзыва): работа завершена, отзывы или период истек
      return [
        assignmentTransitions.COMPLETE,
        assignmentTransitions.REVIEW_1_BY_CUSTOMER,
        assignmentTransitions.REVIEW_1_BY_PROVIDER,
        assignmentTransitions.REVIEW_2_BY_CUSTOMER,
        assignmentTransitions.REVIEW_2_BY_PROVIDER,
        assignmentTransitions.EXPIRE_REVIEW_PERIOD,
        assignmentTransitions.EXPIRE_CUSTOMER_REVIEW_PERIOD,
        assignmentTransitions.EXPIRE_PROVIDER_REVIEW_PERIOD,
      ];
    default:
      // По умолчанию возвращаем transitions для assignment-flow-v3
      return Object.values(assignmentTransitions);
  }
};

// ================ Thunks ================ //

const INBOX_PAGE_SIZE = 10;

export const loadData = (params, search) => (dispatch, getState, sdk) => {
  const { tab } = params;

  const onlyFilterValues = {
    orders: 'order',
    sales: 'sale',
  };

  const onlyFilter = onlyFilterValues[tab];
  if (!onlyFilter) {
    return Promise.reject(new Error(`Invalid tab for InboxPage: ${tab}`));
  }

  dispatch(fetchOrdersOrSalesRequest());

  const { page = 1, sort, subtab } = parse(search);

  // Определяем transitions для фильтрации на основе subtab
  // Используем только transitions для assignment-flow-v3
  const transitionsToFilter = subtab 
    ? getTransitionsBySubtab(subtab)
    : Object.values(assignmentTransitions);

  const apiQueryParams = {
    only: onlyFilter,
    lastTransitions: transitionsToFilter,
    include: [
      'listing',
      'provider',
      'provider.profileImage',
      'customer',
      'customer.profileImage',
      'booking',
    ],
    'fields.transaction': [
      'processName',
      'lastTransition',
      'lastTransitionedAt',
      'transitions',
      'payinTotal',
      'payoutTotal',
      'lineItems',
    ],
    'fields.listing': ['title', 'availabilityPlan', 'publicData.listingType'],
    'fields.user': ['profile.displayName', 'profile.abbreviatedName', 'profile.publicData', 'deleted', 'banned'],
    'fields.image': ['variants.square-small', 'variants.square-small2x'],
    page,
    perPage: INBOX_PAGE_SIZE,
    ...getValidInboxSort(sort),
  };

  return sdk.transactions
    .query(apiQueryParams)
    .then(response => {
      dispatch(addMarketplaceEntities(response));
      dispatch(fetchOrdersOrSalesSuccess(response));
      return response;
    })
    .catch(e => {
      dispatch(fetchOrdersOrSalesError(storableError(e)));
      throw e;
    });
};
