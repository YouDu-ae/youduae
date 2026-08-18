const { transactionLineItems } = require('../api-util/lineItems');
const {
  getSdk,
  getTrustedSdk,
  handleError,
  serialize,
  fetchCommission,
} = require('../api-util/sdk');
const { notifyNewOffer } = require('./telegram-bot');

module.exports = (req, res) => {
  const { isSpeculative, orderData, bodyParams, queryParams } = req.body;

  const sdk = getSdk(req, res);
  let lineItems = null;

  const listingPromise = () => sdk.listings.show({ id: bodyParams?.params?.listingId });

  Promise.all([listingPromise(), fetchCommission(sdk)])
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

      console.log('🔍 initiate-privileged: calling SDK with body:', JSON.stringify(body, null, 2));

      if (isSpeculative) {
        return trustedSdk.transactions.initiateSpeculative(body, queryParams);
      }
      return trustedSdk.transactions.initiate(body, queryParams);
    })
    .then(async apiResponse => {
      const { status, statusText, data } = apiResponse;
      console.log('✅ initiate-privileged: success, status =', status);

      const transition = req.body?.bodyParams?.transition;
      const tx = data?.data;
      const offerComment = (
        tx?.attributes?.protectedData?.offer?.comment ||
        req.body?.bodyParams?.params?.protectedData?.offer?.comment ||
        ''
      ).trim();

      // Copy the offer comment into the transaction chat so both parties see
      // it in История, not only on the listing card.
      const SHARETRIBE_MESSAGE_MAX = 1000;
      if (transition === 'transition/inquire' && offerComment && tx?.id) {
        try {
          const userSdk = getSdk(req, res);
          await userSdk.messages.send({
            transactionId: tx.id,
            content: offerComment.slice(0, SHARETRIBE_MESSAGE_MAX),
          });
        } catch (messageError) {
          console.error('⚠️ Could not copy offer comment into chat:', messageError.message);
        }
      }
      
      // Send Telegram notification for new offer (inquire transition)
      if (transition === 'transition/inquire' && data?.data) {
        try {
          const tx = data.data;
          const providerId = tx.relationships?.provider?.data?.id?.uuid;
          const listingId = tx.relationships?.listing?.data?.id?.uuid;
          const listing = data.included?.find(inc => inc.type === 'listing' && inc.id?.uuid === listingId);
          const customer = data.included?.find(inc => inc.type === 'user' && inc.id?.uuid === tx.relationships?.customer?.data?.id?.uuid);
          
          const listingTitle = listing?.attributes?.title || 'Задание';
          const executorName = customer?.attributes?.profile?.displayName || 'Исполнитель';
          const offerPrice = tx.attributes?.protectedData?.offer?.price;
          const rootUrl = process.env.REACT_APP_MARKETPLACE_ROOT_URL || 'https://youdu.ae';
          const listingUrl = `${rootUrl}/l/${listingId}`;
          
          if (providerId) {
            await notifyNewOffer(providerId, {
              listingTitle,
              executorName,
              offerPrice: offerPrice ? `${offerPrice} AED` : null,
              listingUrl,
            });
            console.log('📱 Telegram: New offer notification sent to provider:', providerId);
          }
        } catch (notifyError) {
          console.error('⚠️ Telegram notification error:', notifyError.message);
        }
      }
      
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
      console.error('❌ initiate-privileged error:', e);
      handleError(res, e);
    });
};
