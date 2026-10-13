const { transactionLineItems } = require('../api-util/lineItems');
const {
  getSdk,
  getTrustedSdk,
  handleError,
  serialize,
  fetchCommission,
} = require('../api-util/sdk');

class OfferAlreadySent extends Error {
  constructor(transactionId) {
    super('The specialist has already made an offer on this task');
    this.transactionId = transactionId;
  }
}

// In memory, so it covers a single web dyno.
const offersInProgress = new Map();

/**
 * Offers to one task go one at a time, so a second click or tab cannot slip in
 * between the check for an earlier offer and the new one.
 */
const oneAtATime = (listingId, task) => {
  const previous = offersInProgress.get(listingId) || Promise.resolve();
  const run = previous.then(task);
  const done = run.then(() => {}, () => {});
  offersInProgress.set(listingId, done);
  done.then(() => {
    if (offersInProgress.get(listingId) === done) {
      offersInProgress.delete(listingId);
    }
  });
  return run;
};

module.exports = (req, res) => {
  const { isSpeculative, orderData, bodyParams, queryParams } = req.body;
  const listingId = bodyParams?.params?.listingId;

  const sdk = getSdk(req, res);
  let lineItems = null;

  const listingPromise = () => sdk.listings.show({ id: listingId });

  const initiate = () => Promise.all([listingPromise(), fetchCommission(sdk)])
    .then(([showListingResponse, fetchAssetsResponse]) => {
      const listing = showListingResponse.data.data;
      const commissionAsset = fetchAssetsResponse.data.data[0];

      const { providerCommission, customerCommission } =
        commissionAsset?.type === 'jsonAsset' ? commissionAsset.attributes.data : {};

      // 🔍 Проверяем unitType и transition - для inquiry и отклика не нужны lineItems
      const publicData = listing.attributes.publicData;
      const unitType = publicData?.unitType;
      const transition = bodyParams?.transition;
      const isInquiryProcess = unitType === 'inquiry';
      const isInquireTransition = transition === 'transition/inquire';

      console.log('🔍 initiate-privileged: unitType =', unitType, ', transition =', transition, ', isInquiry =', isInquiryProcess, ', isInquireTransition =', isInquireTransition);

      // Для inquiry процесса или transition/inquire (отклик) lineItems не нужны
      if (!isInquiryProcess && !isInquireTransition) {
        lineItems = transactionLineItems(
          listing,
          { ...orderData, ...bodyParams.params },
          providerCommission,
          customerCommission
        );
      } else {
        // Для inquiry/inquire используем пустой массив lineItems
        lineItems = [];
        console.log('✅ initiate-privileged: using empty lineItems for inquiry/inquire transition');
      }

      return getTrustedSdk(req);
    })
    .then(trustedSdk => {
      const { params } = bodyParams;

      // Add lineItems to the body params
      const body = {
        ...bodyParams,
        params: {
          ...params,
          lineItems,
        },
      };

      // Only the shape: params carry the offer comment and price, which must
      // not end up in production logs.
      console.log('🔍 initiate-privileged: calling SDK with body:', JSON.stringify({
        transition: body.transition,
        processAlias: body.processAlias,
        paramsKeys: Object.keys(body.params || {}),
      }));

      if (isSpeculative) {
        return trustedSdk.transactions.initiateSpeculative(body, queryParams);
      }
      return trustedSdk.transactions.initiate(body, queryParams);
    });

  // One offer per specialist and task, as check-my-offer reports it to the form.
  const isOffer = bodyParams?.transition === 'transition/inquire' && !isSpeculative && !!listingId;
  const initiateFirstOffer = () =>
    oneAtATime(listingId, () =>
      sdk.transactions.query({ listingId, only: 'order', perPage: 1 }).then(response => {
        const earlier = response?.data?.data?.[0];
        if (earlier) {
          throw new OfferAlreadySent(earlier.id.uuid);
        }
        return initiate();
      })
    );

  return (isOffer ? initiateFirstOffer() : initiate())
    .then(apiResponse => {
      const { status, statusText, data } = apiResponse;
      console.log('✅ initiate-privileged: success, status =', status);

      // The offer comment stays in protectedData.offer and is not copied into
      // the chat: a chat message makes Sharetribe send a "new message" letter
      // on top of the offer letter, which already quotes the comment. Both
      // chats show it as the first line from the offer (ActivityFeed
      // messagesWithOfferComment, the app's utils/offerComment).
      //
      // Nor is the author notified from here: the app makes offers without
      // this endpoint, so reminders/messageNotifications tells the author
      // about every offer.

      res
        .status(status)
        .set('Content-Type', 'application/transit+json')
        .send(
          serialize({
            status,
            statusText,
            data,
          })
        )
        .end();
    })
    .catch(e => {
      if (e instanceof OfferAlreadySent) {
        console.log(
          `🛑 initiate-privileged: second offer to ${listingId} refused, earlier is ${e.transactionId}`
        );
        return res
          .status(409)
          .json({ error: 'offer_already_sent', transactionId: e.transactionId })
          .end();
      }
      console.error('❌ initiate-privileged error:', e);
      handleError(res, e);
    });
};
