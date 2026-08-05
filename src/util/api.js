// These helpers are calling this template's own server-side routes
// so, they are not directly calling Marketplace API or Integration API.
// You can find these api endpoints from 'server/api/...' directory

import appSettings from '../config/settings';
import { types as sdkTypes, transit, createInstance, tokenStore } from './sdkLoader';
import Decimal from 'decimal.js';

export const apiBaseUrl = marketplaceRootURL => {
  const port = process.env.REACT_APP_DEV_API_SERVER_PORT;
  const useDevApiServer = process.env.NODE_ENV === 'development' && !!port;

  // In development, the dev API server is running in a different port
  if (useDevApiServer) {
    return `http://localhost:${port}`;
  }

  // Otherwise, use the given marketplaceRootURL parameter or the same domain and port as the frontend
  return marketplaceRootURL ? marketplaceRootURL.replace(/\/$/, '') : `${window.location.origin}`;
};

// Application type handlers for JS SDK.
//
// NOTE: keep in sync with `typeHandlers` in `server/api-util/sdk.js`
export const typeHandlers = [
  // Use Decimal type instead of SDK's BigDecimal.
  {
    type: sdkTypes.BigDecimal,
    customType: Decimal,
    writer: v => new sdkTypes.BigDecimal(v.toString()),
    reader: v => new Decimal(v.value),
  },
];

// Create SDK instance for direct client-side calls
// Using lazy initialization to avoid issues with appSettings not being ready
let sdkInstance = null;

const getSdk = () => {
  if (typeof window === 'undefined') {
    // На сервере не создаём SDK
    return null;
  }

  if (sdkInstance) {
    return sdkInstance;
  }

  // Отладка: проверяем appSettings
  console.log('getSdk: appSettings.sdk =', appSettings.sdk);
  console.log('getSdk: clientId =', appSettings.sdk?.clientId);
  console.log('getSdk: createInstance =', typeof createInstance);
  console.log('getSdk: tokenStore =', typeof tokenStore);

  const clientId = appSettings.sdk?.clientId;
  if (!clientId) {
    console.error('getSdk: missing appSettings.sdk.clientId');
    return null;
  }

  // Always proxy Marketplace API through same origin in the browser.
  const baseUrlConfig = { baseUrl: `${window.location.origin}/api/st` };
  const assetCdnBaseUrl = appSettings.sdk?.assetCdnBaseUrl
    ? { assetCdnBaseUrl: appSettings.sdk.assetCdnBaseUrl }
    : {};

  const sdkConfig = {
    transitVerbose: appSettings.sdk?.transitVerbose || false,
    clientId,
    secure: appSettings.usingSSL,
    typeHandlers,
    tokenStore: tokenStore.browserCookieStore({
      clientId,
      secure: appSettings.usingSSL,
    }),
    ...baseUrlConfig,
    ...assetCdnBaseUrl,
  };

  console.log('getSdk: sdkConfig =', { ...sdkConfig, tokenStore: '[CookieStore]' });

  sdkInstance = createInstance(sdkConfig);

  return sdkInstance;
};

// Export getter function instead of direct instance
// NOTE: We export getSdk so components can get SDK when needed
// Prefer using server API endpoints for privileged operations
export { getSdk };
const serialize = data => {
  return transit.write(data, { typeHandlers, verbose: appSettings.sdk.transitVerbose });
};

const deserialize = str => {
  return transit.read(str, { typeHandlers });
};

const methods = {
  POST: 'POST',
  GET: 'GET',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
};

// If server/api returns data from SDK, you should set Content-Type to 'application/transit+json'
const request = (path, options = {}) => {
  const url = `${apiBaseUrl()}${path}`;
  const { credentials, headers, body, ...rest } = options;

  // Determine body serialization based on Content-Type
  const contentType = headers?.['Content-Type'] || 'application/transit+json';
  const isTransit = contentType === 'application/transit+json';
  const isJson = contentType === 'application/json';

  let bodyMaybe = {};
  if (body) {
    if (isTransit) {
      bodyMaybe = { body: serialize(body) };
    } else if (isJson) {
      bodyMaybe = { body: JSON.stringify(body) };
    } else {
      bodyMaybe = { body };
    }
  }

  const fetchOptions = {
    credentials: credentials || 'include',
    headers: headers || { 'Content-Type': 'application/transit+json' },
    ...bodyMaybe,
    ...rest,
  };

  return window.fetch(url, fetchOptions).then(res => {
    const contentTypeHeader = res.headers.get('Content-Type');
    const contentType = contentTypeHeader ? contentTypeHeader.split(';')[0] : null;

    if (res.status >= 400) {
      return res.json().then(data => {
        let e = new Error();
        e = Object.assign(e, data);

        throw e;
      });
    }
    if (contentType === 'application/transit+json') {
      return res.text().then(deserialize);
    } else if (contentType === 'application/json') {
      return res.json();
    }
    return res.text();
  });
};

// Keep the previous parameter order for the post method.
// For now, only POST has own specific function, but you can create more or use request directly.
const post = (path, body, options = {}) => {
  const requestOptions = {
    ...options,
    method: methods.POST,
    body,
  };

  return request(path, requestOptions);
};

const get = (path, options = {}) => {
  const requestOptions = {
    ...options,
    method: methods.GET,
  };

  return request(path, requestOptions);
};

// Fetch transaction line items from the local API endpoint.
//
// See `server/api/transaction-line-items.js` to see what data should
// be sent in the body.
export const transactionLineItems = body => {
  return post('/api/transaction-line-items', body);
};

// Initiate a privileged transaction.
//
// With privileged transitions, the transactions need to be created
// from the backend. This endpoint enables sending the order data to
// the local backend, and passing that to the Marketplace API.
//
// See `server/api/initiate-privileged.js` to see what data should be
// sent in the body.
export const initiatePrivileged = body => {
  return post('/api/initiate-privileged', body);
};

// Transition a transaction with a privileged transition.
//
// This is similar to the `initiatePrivileged` above. It will use the
// backend for the transition. The backend endpoint will add the
// payment line items to the transition params.
//
// See `server/api/transition-privileged.js` to see what data should
// be sent in the body.
export const transitionPrivileged = body => {
  return post('/api/transition-privileged', body);
};

// Search executors by service category
//
// This endpoint returns a list of Customer users (executors) who provide
// services in the specified category. The response includes user info,
// reviews count, and average rating.
//
// Soft-gate for guests is enforced in CategoryExecutorsPage (UI only).
// See `server/api/search-executors.js` for implementation details.
export const searchExecutors = category => {
  return get(`/api/search-executors?category=${encodeURIComponent(category)}`, {
    headers: { 'Content-Type': 'application/json' },
  });
};

// Query offers (transactions) for a specific listing
// This uses the backend to query transactions, avoiding auth issues on client
export const queryOffers = listingId => {
  return get(`/api/query-offers?listingId=${listingId}`);
};

// Check if current user has already sent an offer for this listing
export const checkMyOffer = listingId => {
  return get(`/api/check-my-offer?listingId=${listingId}`);
};

// Update listing publicData status (accept-offer, reopen, change executor, etc.)
export const updateListingStatus = ({
  listingId,
  assignedTo,
  status,
  transactionId,
  executorName,
  reviewSubmitted,
  removedCustomerId,
}) => {
  return post('/api/update-listing-status', {
    listingId,
    assignedTo,
    status,
    transactionId,
    executorName,
    reviewSubmitted,
    removedCustomerId,
  });
};

// Get user review statistics (average rating and count)
// Returns { userId, reviewCount, averageRating }
export const getUserReviewsStats = userId => {
  return get(`/api/user-reviews-stats?userId=${userId}`);
};

// Get listing status based on transactions
// Returns { status: 'available' | 'in-progress' | 'closed' }
export const getListingStatus = listingId => {
  return get(`/api/listing-status?listingId=${listingId}`);
};

// Create listing from guest data after authentication
export const createGuestListing = listingData => {
  return post('/api/create-guest-listing', listingData);
};

// Notify executors with Telegram linked about a freshly published task.
// The server keeps this idempotent, so retries cannot produce duplicate alerts.
export const notifyNewListing = listingId => {
  return post('/api/notify-new-listing', { listingId }, {
    headers: { 'Content-Type': 'application/json' },
  });
};

// Create user with identity provider (e.g. Facebook or Google)
//
// If loginWithIdp api call fails and user can't authenticate to Marketplace API with idp
// we will show option to create a new user with idp.
// For that user needs to confirm data fetched from the idp.
// After the confirmation, this endpoint is called to create a new user with confirmed data.
//
// See `server/api/auth/createUserWithIdp.js` to see what data should
// be sent in the body.
export const createUserWithIdp = body => {
  return post('/api/auth/create-user-with-idp', body);
};

export const createUser = body => {
  return post('/api/auth/create-user', body);
};

export const loginWithPassword = body => {
  return post('/api/auth/login', body);
};

// Email OTP verification endpoints
export const sendEmailOtp = ({ email, locale }) => {
  return post('/api/otp/email/send', { email, locale }, {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const verifyEmailOtp = ({ challengeToken, code }) => {
  return post('/api/otp/email/verify', { challengeToken, code }, {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const assertEmailVerified = ({ verifiedToken }) => {
  return post('/api/otp/email/assert', { verifiedToken }, {
    headers: { 'Content-Type': 'application/json' },
  });
};

// Get completed transactions for a Customer user
export const getUserCompletedTransactions = userId => {
  return get(`/api/user-completed-transactions?userId=${userId}`, {
    headers: { 'Content-Type': 'application/json' },
  });
};

// Get platform-wide statistics (total completed tasks and total sum in AED)
export const getPlatformStats = () => {
  return get('/api/platform-stats', {
    headers: { 'Content-Type': 'application/json' },
  });
};

