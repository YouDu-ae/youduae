/**
 * Reading where a task stands in assignment-flow-v3.
 *
 * Completing is idempotent by design: the app asks for it right before a review
 * is written, so a second request on an already finished task is normal traffic
 * rather than a failure. Telling that apart from a task that never completed is
 * what these helpers are for.
 */

/**
 * Every transition at or past state/completed, mirroring `isCompleted` in
 * src/transactions/transactionProcessAssignment.js.
 *
 * The three expiry transitions matter: a task where nobody got round to leaving
 * a review within the seven-day window is still a task that was carried out,
 * and leaving them out quietly understates how much people have done.
 */
const COMPLETED_OR_BEYOND = [
  'transition/complete',
  'transition/review-1-by-provider',
  'transition/review-1-by-customer',
  'transition/review-2-by-provider',
  'transition/review-2-by-customer',
  'transition/expire-review-period',
  'transition/expire-provider-review-period',
  'transition/expire-customer-review-period',
];

const isCompletedOrBeyond = lastTransition =>
  COMPLETED_OR_BEYOND.includes(String(lastTransition || '').trim());

// Sharetribe reports a transition the current state does not allow with this
// code, which is the one case worth re-reading the transaction over.
const isInvalidTransitionError = error =>
  error?.status === 409 ||
  (error?.data?.errors || []).some(e => e?.code === 'transaction-invalid-transition');

module.exports = { isCompletedOrBeyond, isInvalidTransitionError, COMPLETED_OR_BEYOND };
