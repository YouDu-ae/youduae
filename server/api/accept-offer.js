const sharetribeSdk = require('sharetribe-flex-sdk');
const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const { handleError, serialize, typeHandlers } = require('../api-util/sdk');
const { sendExecutorSelectedNotification } = require('./send-notification');

const CLIENT_ID = process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID;
const CLIENT_SECRET = process.env.SHARETRIBE_SDK_CLIENT_SECRET;
const BASE_URL = process.env.REACT_APP_SHARETRIBE_SDK_BASE_URL;

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

  // Extract Bearer token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('❌ accept-offer: No Bearer token in Authorization header');
    return res.status(401).json({ 
      error: 'Authorization required',
      message: 'Bearer token is missing'
    }).end();
  }

  const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  if (!accessToken || accessToken === 'null' || accessToken === 'undefined') {
    console.log('❌ accept-offer: Invalid access token');
    return res.status(401).json({ error: 'Invalid access token' }).end();
  }
  
  console.log('🔑 accept-offer: Got access token');

  try {
    // Create SDK with the user's access token
    const tokenStore = sharetribeSdk.tokenStore.memoryStore();
    tokenStore.setToken({ 
      access_token: accessToken,
      token_type: 'bearer'
    });

    const sdk = sharetribeSdk.createInstance({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      tokenStore,
      typeHandlers,
      ...(BASE_URL ? { baseUrl: BASE_URL } : {}),
    });

    // Exchange token to get trusted token
    console.log('🔄 accept-offer: Exchanging token...');
    const exchangeResponse = await sdk.exchangeToken();
    const trustedToken = exchangeResponse.data;

    // Create trusted SDK with the exchanged token
    const trustedTokenStore = sharetribeSdk.tokenStore.memoryStore();
    trustedTokenStore.setToken(trustedToken);

    const trustedSdk = sharetribeSdk.createInstance({
      clientId: CLIENT_ID,
      tokenStore: trustedTokenStore,
      typeHandlers,
      ...(BASE_URL ? { baseUrl: BASE_URL } : {}),
    });

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
          await sendExecutorSelectedNotification(customerId, listingTitle, listingId);
          console.log('📤 Notification sent to executor:', customerId);
        }
      }
    } catch (notifError) {
      console.error('⚠️ Failed to send notification:', notifError.message);
      // Don't fail the request if notification fails
    }

    res.status(200).json({
      success: true,
      data: transitionResponse.data,
    }).end();

  } catch (error) {
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
