const { notifyOfferDeclined } = require('../api/telegram-bot');

/**
 * Declines the offers that lost once an executor is hired.
 *
 * Hiring closes the task for everyone else, but assignment-flow-v3 has no timed
 * way out of state/inquiry — the only transitions leaving it are accept-offer
 * and decline-offer. Without this sweep the losing offers stay pending forever
 * and the specialists never hear back.
 */

// Same spacing the reminder sweeps use to stay under Telegram's rate limit.
const TELEGRAM_SEND_DELAY_MS = 50;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const uuidOf = ref => ref?.id?.uuid || ref?.uuid || ref || null;

const resolveListingId = async (trustedSdk, transactionId) => {
  const response = await trustedSdk.transactions.show({ id: transactionId });
  return uuidOf(response?.data?.data?.relationships?.listing?.data?.id);
};

/**
 * @param {Object} params
 * @param {Object} params.trustedSdk    SDK of the task author, who is the only
 *                                      actor allowed to decline.
 * @param {string} params.acceptedTransactionId  The winning offer, left alone.
 * @param {string} [params.listingId]   Saves a lookup when the caller has it.
 * @returns {Promise<{declined: number, failed: number}>}
 */
const declineCompetingOffers = async ({ trustedSdk, acceptedTransactionId, listingId }) => {
  const result = { declined: 0, failed: 0 };

  const taskId = listingId || (await resolveListingId(trustedSdk, acceptedTransactionId));
  if (!taskId) {
    console.warn('⚠️ decline-competing: no listing on transaction', acceptedTransactionId);
    return result;
  }

  // state/inquiry is the only state decline-offer can leave, so anything that
  // has moved on is none of our business.
  const response = await trustedSdk.transactions.query({
    listingId: taskId,
    lastTransitions: ['transition/inquire'],
    include: ['customer', 'listing'],
    perPage: 100,
  });

  const transactions = response?.data?.data || [];
  const included = response?.data?.included || [];

  const listing = included.find(inc => inc.type === 'listing' && uuidOf(inc.id) === taskId);
  const listingTitle = listing?.attributes?.title || 'Задание';

  const losers = transactions.filter(tx => uuidOf(tx.id) !== acceptedTransactionId);

  console.log(`🧹 decline-competing: ${losers.length} offer(s) to close on listing ${taskId}`);

  for (const tx of losers) {
    const transactionId = uuidOf(tx.id);

    try {
      await trustedSdk.transactions.transition({
        id: transactionId,
        transition: 'transition/decline-offer',
        params: {},
      });
      result.declined += 1;

      // A failed notification must not leave the offer looking undeclined.
      try {
        const executorId = uuidOf(tx.relationships?.customer?.data?.id);
        if (executorId) {
          await notifyOfferDeclined(executorId, { listingTitle, executorChosen: true });
          await sleep(TELEGRAM_SEND_DELAY_MS);
        }
      } catch (notifyError) {
        console.error('⚠️ decline-competing: notify failed:', notifyError.message);
      }
    } catch (error) {
      result.failed += 1;
      console.error(
        `⚠️ decline-competing: could not decline ${transactionId}:`,
        error?.data || error.message
      );
    }
  }

  console.log('🧹 decline-competing: done', JSON.stringify(result));
  return result;
};

module.exports = { declineCompetingOffers };
