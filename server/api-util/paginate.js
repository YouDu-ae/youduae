/**
 * Helpers for Sharetribe queries that can return more results than one page.
 *
 * Passing `perPage: 100` without ever reading `meta.totalPages` silently drops
 * everything past the first hundred rows, which looks like working code until
 * the marketplace outgrows that number.
 */

const MAX_PER_PAGE = 100;

// Sharetribe allows 10 concurrent requests per IP for the whole dyno, so pages
// are fetched one at a time. The cap keeps a runaway dataset from monopolising
// the request while still covering far more than the marketplace holds today.
const DEFAULT_MAX_PAGES = 20;

/**
 * Fetches every page of a Sharetribe query and concatenates the results.
 *
 * @param {(params: {page: number, perPage: number}) => Promise} queryFn
 *   Runs one page of the query. Receives `page` and `perPage` to spread into
 *   the SDK call.
 * @returns {Promise<{items: Array, included: Array, totalItems: number, truncated: boolean}>}
 *   `truncated` is true when `maxPages` cut the result short.
 */
const queryAllPages = async (queryFn, options = {}) => {
  const { perPage = MAX_PER_PAGE, maxPages = DEFAULT_MAX_PAGES } = options;

  const firstResponse = await queryFn({ page: 1, perPage });
  const items = [...(firstResponse.data.data || [])];
  const included = [...(firstResponse.data.included || [])];

  const meta = firstResponse.data.meta || {};
  const totalPages = meta.totalPages || 1;
  const lastPage = Math.min(totalPages, maxPages);

  for (let page = 2; page <= lastPage; page++) {
    const response = await queryFn({ page, perPage });
    items.push(...(response.data.data || []));
    included.push(...(response.data.included || []));
  }

  if (totalPages > maxPages) {
    console.warn(
      `⚠️ Query truncated at ${maxPages} pages of ${totalPages}; ${meta.totalItems} items available.`
    );
  }

  return {
    items,
    included,
    totalItems: typeof meta.totalItems === 'number' ? meta.totalItems : items.length,
    truncated: totalPages > maxPages,
  };
};

/**
 * Returns how many rows a query matches without downloading them.
 *
 * Sharetribe reports `meta.totalItems` on every page, so asking for a single
 * row is enough to read the count.
 */
const queryTotalItems = async queryFn => {
  const response = await queryFn({ page: 1, perPage: 1 });
  return response.data.meta?.totalItems || 0;
};

module.exports = { queryAllPages, queryTotalItems, MAX_PER_PAGE };
