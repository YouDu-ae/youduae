/**
 * Single place where a user's public reputation is derived.
 *
 * ROLE MAPPING. YouDu inverts the usual Sharetribe vocabulary: the client who
 * posts a task owns the listing and is therefore the Sharetribe *provider*,
 * while the specialist who does the work is the Sharetribe *customer*. Getting
 * this backwards silently mixes up whose reviews are counted, so the exported
 * constants below should be used instead of raw strings.
 */

const { queryAllPages, queryTotalItems } = require('./paginate');

// Which side of a transaction the user is being rated on.
const ROLE = {
  SPECIALIST: 'specialist', // Sharetribe customer — performs the work
  CLIENT: 'client', // Sharetribe provider — posts the task
};

// `ofCustomer` reviews are written by providers about the customer, so on YouDu
// they are the reviews a specialist earns. `ofProvider` reviews run the other
// way and belong to the client who posted the task.
const REVIEW_TYPE_BY_ROLE = {
  [ROLE.SPECIALIST]: 'ofCustomer',
  [ROLE.CLIENT]: 'ofProvider',
};

const TRANSACTION_FILTER_BY_ROLE = {
  [ROLE.SPECIALIST]: 'customerId',
  [ROLE.CLIENT]: 'providerId',
};

/**
 * Transitions that mean the work was finished, mirroring `isCompleted` in
 * src/transactions/transactionProcessAssignment.js.
 *
 * The three expiry transitions matter: a task where nobody got round to leaving
 * a review within the window is still a task that was carried out, and leaving
 * them out quietly understates how much people have done.
 */
const COMPLETED_TRANSITIONS = [
  'transition/complete',
  'transition/review-1-by-customer',
  'transition/review-1-by-provider',
  'transition/review-2-by-customer',
  'transition/review-2-by-provider',
  'transition/expire-review-period',
  'transition/expire-customer-review-period',
  'transition/expire-provider-review-period',
];

/** Maps an incoming `role` query parameter onto a ROLE, defaulting to specialist. */
const parseRole = value => (value === ROLE.CLIENT ? ROLE.CLIENT : ROLE.SPECIALIST);

/**
 * Reads the verification flag from a user profile.
 *
 * `publicData` is the documented location (see VERIFICATION_GUIDE.md) and the
 * only one the web UI reads. Two other shapes exist in live data: an early
 * nested `{ isVerified: true }` object, and `metadata` written by older server
 * code. Both are accepted so that already-verified specialists keep their badge.
 */
const resolveIsVerified = profile => {
  const publicValue = profile?.publicData?.isVerified;

  if (publicValue === true) return true;
  if (typeof publicValue === 'object' && publicValue?.isVerified === true) return true;

  return profile?.metadata?.isVerified === true;
};

/**
 * Average rating and review count for one user in one role.
 *
 * Filtering by type at the API level matters for people who both post tasks and
 * work on them: without it, praise earned as a client inflates their standing as
 * a specialist.
 */
const fetchReviewStats = async (sdk, { subjectId, role }) => {
  const type = REVIEW_TYPE_BY_ROLE[parseRole(role)];

  try {
    const { items } = await queryAllPages(({ page, perPage }) =>
      sdk.reviews.query({ subjectId, type, state: 'public', page, perPage })
    );

    const rated = items.filter(review => review.attributes?.rating);
    const total = rated.reduce((sum, review) => sum + review.attributes.rating, 0);

    return {
      count: rated.length,
      averageRating: rated.length > 0 ? Math.round((total / rated.length) * 10) / 10 : 0,
    };
  } catch (err) {
    console.error(`❌ Reviews lookup failed for ${subjectId} (${role}):`, err.message);
    return { count: 0, averageRating: 0 };
  }
};

/**
 * Number of transactions the user finished in the given role.
 *
 * Both the role filter and the transition filter are applied by the API, so the
 * count comes back exact in `meta.totalItems` and no transaction bodies are
 * transferred.
 */
const fetchCompletedCount = async (integrationSdk, { userId, role }) => {
  const filterKey = TRANSACTION_FILTER_BY_ROLE[parseRole(role)];

  try {
    return await queryTotalItems(({ page, perPage }) =>
      integrationSdk.transactions.query({
        [filterKey]: userId,
        lastTransitions: COMPLETED_TRANSITIONS,
        page,
        perPage,
      })
    );
  } catch (err) {
    console.error(`❌ Completed count lookup failed for ${userId} (${role}):`, err.message);
    return 0;
  }
};

module.exports = {
  ROLE,
  REVIEW_TYPE_BY_ROLE,
  COMPLETED_TRANSITIONS,
  parseRole,
  resolveIsVerified,
  fetchReviewStats,
  fetchCompletedCount,
};
