const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const { trustedSdkFromBearer, BearerAuthError } = require('../api-util/mobileSdk');
const { notifyOfferDeclined } = require('./telegram-bot');

/**
 * Decline an offer — mobile API endpoint.
 *
 * The web reaches transition/decline-offer through transition-privileged, which
 * authenticates with a session cookie. The app carries a Bearer token instead,
 * so it needs its own door into the same transition.
 *
 * No ownership check is done here on purpose: decline-offer names the provider
 * as its actor, so Sharetribe rejects anyone who is not the task author.
 */
module.exports = async (req, res) => {
  const { transactionId } = req.body;

  console.log('📱 decline-offer: Starting for transaction:', transactionId);

  if (!transactionId) {
    return res.status(400).json({ error: 'transactionId is required' }).end();
  }

  try {
    const trustedSdk = await trustedSdkFromBearer(req);

    const transitionResponse = await trustedSdk.transactions.transition({
      id: transactionId,
      transition: 'transition/decline-offer',
      params: {},
    });

    console.log('✅ decline-offer: Transition successful');

    // Telling the specialist is the whole point of declining, but a silent
    // Telegram failure must not make the decline look like it did not happen.
    try {
      const integrationClientId = process.env.INTEGRATION_API_CLIENT_ID;
      const integrationClientSecret = process.env.INTEGRATION_API_CLIENT_SECRET;

      if (integrationClientId && integrationClientSecret) {
        const integrationSdk = sharetribeIntegrationSdk.createInstance({
          clientId: integrationClientId,
          clientSecret: integrationClientSecret,
        });

        const txRes = await integrationSdk.transactions.show({
          id: transactionId,
          include: ['customer', 'listing'],
        });

        const tx = txRes.data.data;
        const executorId = tx.relationships?.customer?.data?.id?.uuid;
        const listingId = tx.relationships?.listing?.data?.id?.uuid;

        const listing = txRes.data.included?.find(
          inc => inc.type === 'listing' && inc.id.uuid === listingId
        );
        const listingTitle = listing?.attributes?.title || 'Задание';

        if (executorId) {
          await notifyOfferDeclined(executorId, { listingTitle });
          console.log('📱 Telegram: Decline notification sent to:', executorId);
        }
      }
    } catch (notifyError) {
      console.error('⚠️ decline-offer: notification failed:', notifyError.message);
    }

    res
      .status(200)
      .json({
        success: true,
        data: transitionResponse.data,
      })
      .end();
  } catch (error) {
    if (error instanceof BearerAuthError) {
      console.log('❌ decline-offer:', error.message);
      return res.status(401).json({ error: 'Authorization required', message: error.message }).end();
    }

    console.error('❌ decline-offer error:', error.status, error.statusText, error.data || error.message);

    if (error.status && error.data) {
      return res
        .status(error.status)
        .json({
          error: 'Transaction failed',
          status: error.status,
          statusText: error.statusText,
          data: error.data,
        })
        .end();
    }

    res.status(500).json({ error: 'Internal server error', message: error.message }).end();
  }
};
