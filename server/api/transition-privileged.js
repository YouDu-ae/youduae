const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const {
  getTrustedSdk,
  handleError,
  serialize,
} = require('../api-util/sdk');
const { notifyOfferDeclined, notifyOfferAccepted } = require('./telegram-bot');
const { sendExecutorSelectedNotification } = require('./send-notification');

module.exports = (req, res) => {
  const { isSpeculative, orderData, bodyParams, queryParams } = req.body;

  console.log('🔍 transition-privileged: transition =', bodyParams?.transition);
  console.log('🔍 transition-privileged: tx id =', bodyParams?.id?.uuid);

  // Для inquiry процесса (assignment-flow-v3) lineItems не нужны
  // Просто используем пустой массив
  const lineItems = [];

  getTrustedSdk(req)
    .then(trustedSdk => {
      // Omit listingId from params (transitions don't need it, transaction already has it)
      const { listingId, ...restParams } = bodyParams?.params || {};

      // Add lineItems to the body params
      const body = {
        ...bodyParams,
        params: {
          ...restParams,
          lineItems,
        },
      };

      console.log('🔍 transition-privileged: calling SDK with body:', JSON.stringify({
        id: body.id?.uuid,
        transition: body.transition,
        paramsKeys: Object.keys(body.params || {}),
      }));

      if (isSpeculative) {
        return trustedSdk.transactions.transitionSpeculative(body, queryParams);
      }
      return trustedSdk.transactions.transition(body, queryParams);
    })
    .then(async apiResponse => {
      const { status, statusText, data } = apiResponse;
      console.log('✅ transition-privileged: success, status =', status);
      
      // Notify the executor (transaction customer) when their offer is accepted or declined.
      const transition = req.body?.bodyParams?.transition;
      const isAccept = transition === 'transition/accept-offer';
      const isDecline = transition === 'transition/decline-offer';

      if ((isAccept || isDecline) && data?.data) {
        try {
          const integrationClientId = process.env.INTEGRATION_API_CLIENT_ID;
          const integrationClientSecret = process.env.INTEGRATION_API_CLIENT_SECRET;
          
          if (integrationClientId && integrationClientSecret) {
            const integrationSdk = sharetribeIntegrationSdk.createInstance({
              clientId: integrationClientId,
              clientSecret: integrationClientSecret,
            });
            
            const tx = data.data;
            const transactionId = tx.id?.uuid;
            
            // Get full transaction details
            const txRes = await integrationSdk.transactions.show({
              id: transactionId,
              include: ['customer', 'provider', 'listing'],
            });
            
            const txData = txRes.data.data;
            const customerId = txData.relationships?.customer?.data?.id?.uuid;
            const providerId = txData.relationships?.provider?.data?.id?.uuid;
            const listingId = txData.relationships?.listing?.data?.id?.uuid;
            
            const listing = txRes.data.included?.find(
              inc => inc.type === 'listing' && inc.id.uuid === listingId
            );
            const listingTitle = listing?.attributes?.title || 'Задание';
            
            if (customerId && isDecline) {
              await notifyOfferDeclined(customerId, { listingTitle });
              console.log('📱 Telegram: Decline notification sent to:', customerId);
            }

            if (customerId && isAccept) {
              const author = txRes.data.included?.find(
                inc => inc.type === 'user' && inc.id.uuid === providerId
              );
              const customerName = author?.attributes?.profile?.displayName || 'Заказчик';
              const rootUrl = process.env.REACT_APP_MARKETPLACE_ROOT_URL || 'https://youdu.ae';

              await notifyOfferAccepted(customerId, {
                listingTitle,
                customerName,
                listingUrl: `${rootUrl}/l/${listingId}`,
              });
              console.log('📱 Telegram: Accept notification sent to:', customerId);

              await sendExecutorSelectedNotification(customerId, listingTitle, listingId);
            }
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
      console.error('❌ transition-privileged error:', e);
      handleError(res, e);
    });
};
