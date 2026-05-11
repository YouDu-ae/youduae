const sharetribeSdk = require('sharetribe-flex-sdk');
const { typeHandlers } = require('../api-util/sdk');

const CLIENT_ID = process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID;
const BASE_URL = process.env.REACT_APP_SHARETRIBE_SDK_BASE_URL;

/**
 * Register device token for push notifications
 * Stores FCM token in user's privateData
 */
module.exports = async (req, res) => {
  const { token, platform, unregister } = req.body;

  console.log('📱 register-device-token:', { platform, tokenLength: token?.length, unregister: !!unregister });

  if (!token) {
    return res.status(400).json({ error: 'token is required' }).end();
  }

  // Extract Bearer token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' }).end();
  }

  const accessToken = authHeader.substring(7);

  try {
    // Create SDK with user's access token
    const tokenStore = sharetribeSdk.tokenStore.memoryStore();
    tokenStore.setToken({ access_token: accessToken });

    const sdk = sharetribeSdk.createInstance({
      clientId: CLIENT_ID,
      tokenStore,
      typeHandlers,
      ...(BASE_URL ? { baseUrl: BASE_URL } : {}),
    });

    // Get current user to find their existing tokens
    const currentUserRes = await sdk.currentUser.show();
    const currentUser = currentUserRes.data.data;
    const privateData = currentUser.attributes.profile.privateData || {};
    
    // Get existing device tokens or create empty array
    let deviceTokens = privateData.deviceTokens || [];

    if (unregister === true || unregister === 'true') {
      const nextTokens = deviceTokens.filter(t => t.token !== token);
      await sdk.currentUser.updateProfile({
        privateData: {
          ...privateData,
          deviceTokens: nextTokens,
        },
      });
      console.log('✅ Device token unregistered for user:', currentUser.id.uuid);
      return res
        .status(200)
        .json({
          success: true,
          message: 'Device token removed',
        })
        .end();
    }

    // Check if token already exists
    const existingIndex = deviceTokens.findIndex(t => t.token === token);

    if (existingIndex >= 0) {
      // Update existing token
      deviceTokens[existingIndex] = {
        token,
        platform,
        updatedAt: new Date().toISOString(),
      };
    } else {
      // Add new token (limit to 5 devices per user)
      deviceTokens.push({
        token,
        platform,
        createdAt: new Date().toISOString(),
      });

      // Keep only last 5 tokens
      if (deviceTokens.length > 5) {
        deviceTokens = deviceTokens.slice(-5);
      }
    }

    // Update user's privateData
    await sdk.currentUser.updateProfile({
      privateData: {
        ...privateData,
        deviceTokens,
      },
    });

    console.log('✅ Device token registered for user:', currentUser.id.uuid);

    res.status(200).json({
      success: true,
      message: 'Device token registered',
    }).end();

  } catch (error) {
    console.error('❌ register-device-token error:', error.status, error.data || error.message);
    res.status(500).json({ 
      error: 'Failed to register device token',
      message: error.message,
    }).end();
  }
};
