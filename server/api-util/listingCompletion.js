/**
 * Marks a task as finished on the listing itself.
 *
 * publicData.status === 'completed' is the only listing-level sign of finished
 * work that the app and the site read: a closed listing only means it left
 * search when an executor was chosen. Written through the Integration API so it
 * works whoever completed the deal — the app, the site or an operator.
 *
 * publicData is merged key by key, so the rest of it is left untouched. A
 * cancelled task is never turned into a completed one.
 */

const listingIdFromTransaction = transaction => {
  const id = transaction?.relationships?.listing?.data?.id;
  return id?.uuid || id || null;
};

/**
 * @returns {Promise<'marked' | 'already' | 'cancelled' | 'missing'>}
 */
const markListingCompleted = async (integrationSdk, listingId) => {
  if (!listingId) return 'missing';

  const response = await integrationSdk.listings.show({ id: listingId });
  const publicData = response?.data?.data?.attributes?.publicData || {};

  if (publicData.status === 'completed') return 'already';
  if (publicData.cancelled === true || publicData.status === 'cancelled') return 'cancelled';

  await integrationSdk.listings.update({ id: listingId, publicData: { status: 'completed' } });
  return 'marked';
};

module.exports = { markListingCompleted, listingIdFromTransaction };
