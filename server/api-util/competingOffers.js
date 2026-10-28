const { notifyOtherExecutorChosen } = require('../api/telegram-bot');

/**
 * The other offers on a task, once its executor is hired and once the work is
 * done.
 *
 * Hiring leaves them pending. A declined offer is final in assignment-flow-v3,
 * and «Сменить исполнителя» sends the author back to the offers they already
 * had, so those have to outlive the hire; the specialists only hear that
 * someone else was chosen. Completing the work is what ends them: the only
 * transitions out of state/inquiry are accept-offer and decline-offer, so
 * without the decline they would stay pending forever.
 */

// Same spacing the reminder sweeps use to stay under Telegram's rate limit.
const TELEGRAM_SEND_DELAY_MS = 50;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const uuidOf = ref => ref?.id?.uuid || ref?.uuid || ref || null;

/**
 * Offers on the task still waiting for an answer, except the executor's own:
 * another offer by the hired specialist did not lose. state/inquiry is the only
 * state decline-offer can leave, so anything that has moved on is none of our
 * business.
 */
const waitingOffers = async ({ trustedSdk, listingId, executorId, transactionId }) => {
  const response = await trustedSdk.transactions.query({
    listingId,
    lastTransitions: ['transition/inquire'],
    include: ['customer', 'listing'],
    perPage: 100,
  });

  const included = response?.data?.included || [];
  const listing = included.find(inc => inc.type === 'listing' && uuidOf(inc.id) === listingId);

  return {
    listingTitle: listing?.attributes?.title || 'Задание',
    offers: (response?.data?.data || []).filter(
      tx =>
        uuidOf(tx.id) !== transactionId &&
        uuidOf(tx.relationships?.customer?.data?.id) !== executorId
    ),
  };
};

/**
 * Tells the specialists still waiting on a task that the author hired someone
 * else.
 *
 * @param {Object} params
 * @param {Object} params.trustedSdk     SDK of the task author.
 * @param {string} params.listingId
 * @param {string} params.executorId     The hired specialist.
 * @param {string} params.transactionId  The hired offer.
 * @returns {Promise<{notified: number, failed: number}>}
 */
const notifyCompetingOffers = async params => {
  const result = { notified: 0, failed: 0 };
  if (!params.listingId) {
    console.warn('⚠️ competing-offers: no listing on transaction', params.transactionId);
    return result;
  }

  const { offers, listingTitle } = await waitingOffers(params);

  for (const tx of offers) {
    const specialistId = uuidOf(tx.relationships?.customer?.data?.id);
    if (!specialistId) continue;

    try {
      if (await notifyOtherExecutorChosen(specialistId, { listingTitle })) {
        result.notified += 1;
        await sleep(TELEGRAM_SEND_DELAY_MS);
      }
    } catch (error) {
      result.failed += 1;
      console.error('⚠️ competing-offers: notify failed:', error.message);
    }
  }

  console.log(`📨 competing-offers: listing ${params.listingId}`, JSON.stringify(result));
  return result;
};

/**
 * Declines the offers still waiting once the work on the task is completed.
 * The specialists get the usual "offer not accepted" letter for it
 * (reminders/messageNotifications); Telegram already told them at the hire.
 *
 * @param {Object} params  As for notifyCompetingOffers, with `transactionId`
 *                         the completed deal.
 * @returns {Promise<{declined: number, failed: number}>}
 */
const declineRemainingOffers = async params => {
  const result = { declined: 0, failed: 0 };
  if (!params.listingId) {
    console.warn('⚠️ competing-offers: no listing on transaction', params.transactionId);
    return result;
  }

  const { offers } = await waitingOffers(params);

  for (const tx of offers) {
    const transactionId = uuidOf(tx.id);

    try {
      await params.trustedSdk.transactions.transition({
        id: transactionId,
        transition: 'transition/decline-offer',
        params: {},
      });
      result.declined += 1;
    } catch (error) {
      result.failed += 1;
      console.error(
        `⚠️ competing-offers: could not decline ${transactionId}:`,
        error?.data || error.message
      );
    }
  }

  console.log(`🧹 competing-offers: listing ${params.listingId}`, JSON.stringify(result));
  return result;
};

module.exports = { notifyCompetingOffers, declineRemainingOffers };
