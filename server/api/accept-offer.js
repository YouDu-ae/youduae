const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const { trustedSdkFromBearer, BearerAuthError } = require('../api-util/mobileSdk');
const { sendExecutorSelectedNotification } = require('./send-notification');
const { notifyOfferAccepted } = require('./telegram-bot');
const { declineCompetingOffers } = require('../api-util/declineCompetingOffers');

/**
 * Accept an offer (select executor) - Mobile API endpoint
 * Supports Bearer token authentication for mobile apps
 */
module.exports = async (req, res) => {
  const { transactionId } = req.body;

  console.log('📱 accept-offer: Starting for transaction:', transactionId);

  if (!transactionId) {
    return res.status(400).json({ error: 'transactionId is required' }).end();
  }

  try {
    const trustedSdk = await trustedSdkFromBearer(req);

    // Perform the accept-offer transition
    console.log('✅ accept-offer: Performing transition...');
    const transitionResponse = await trustedSdk.transactions.transition({
      id: transactionId,
      transition: 'transition/accept-offer',
      params: {},
    });

    console.log('✅ accept-offer: Transition successful');

    // Send push notification to the executor
    try {
      const integrationClientId = process.env.INTEGRATION_API_CLIENT_ID;
      const integrationClientSecret = process.env.INTEGRATION_API_CLIENT_SECRET;
      
      if (integrationClientId && integrationClientSecret) {
        const integrationSdk = sharetribeIntegrationSdk.createInstance({
          clientId: integrationClientId,
          clientSecret: integrationClientSecret,
        });

        // Get transaction details to find customer (executor) and listing
        const txRes = await integrationSdk.transactions.show({
          id: transactionId,
          include: ['customer', 'listing'],
        });
        
        const tx = txRes.data.data;
        const customerId = tx.relationships?.customer?.data?.id?.uuid;
        const listingId = tx.relationships?.listing?.data?.id?.uuid;
        
        const listing = txRes.data.included?.find(
          inc => inc.type === 'listing' && inc.id.uuid === listingId
        );
        const listingTitle = listing?.attributes?.title || 'Задание';

        if (customerId) {
          // Push notification (FCM)
          await sendExecutorSelectedNotification(customerId, listingTitle, listingId);
          console.log('📤 Push notification sent to executor:', customerId);
          
          // Telegram notification
          const provider = txRes.data.included?.find(
            inc => inc.type === 'user' && inc.id.uuid === tx.relationships?.provider?.data?.id?.uuid
          );
          const customerName = provider?.attributes?.profile?.displayName || 'Заказчик';
          const rootUrl = process.env.REACT_APP_MARKETPLACE_ROOT_URL || 'https://youdu.ae';
          const listingUrl = `${rootUrl}/l/${listingId}`;
          
          await notifyOfferAccepted(customerId, {
            listingTitle,
            customerName,
            listingUrl,
          });
          console.log('📱 Telegram notification sent to executor:', customerId);
        }
      }
    } catch (notifError) {
      console.error('⚠️ Failed to send notification:', notifError.message);
      // Don't fail the request if notification fails
    }

    // The executor is hired, so every other offer on this task has lost.
    try {
      await declineCompetingOffers({ trustedSdk, acceptedTransactionId: transactionId });
    } catch (declineError) {
      // The hire itself went through; a failed sweep must not report otherwise.
      console.error('⚠️ accept-offer: decline sweep failed:', declineError.message);
    }

    res.status(200).json({
      success: true,
      data: transitionResponse.data,
    }).end();

  } catch (error) {
    if (error instanceof BearerAuthError) {
      console.log('❌ accept-offer:', error.message);
      return res.status(401).json({ error: 'Authorization required', message: error.message }).end();
    }

    console.error('❌ accept-offer error:', error.status, error.statusText, error.data || error.message);
    
    if (error.status && error.data) {
      return res.status(error.status).json({
        error: 'Transaction failed',
        status: error.status,
        statusText: error.statusText,
        data: error.data,
      }).end();
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    }).end();
  }
};
