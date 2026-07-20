const sharetribeSdk = require('sharetribe-flex-sdk');
const { typeHandlers } = require('../api-util/sdk');

const CLIENT_ID = process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID;
const BASE_URL = process.env.REACT_APP_SHARETRIBE_SDK_BASE_URL;

/**
 * Register device token for push notifications
 * Stores FCM token in user's privateData.deviceTokens
 */
module.exports = async (req, res) => {
  const { token, platform, unregister } = req.body;

  console.log('📱 register-device-token:', {
    platform,
    tokenLength: token?.length,
    unregister: !!unregister,
  });

  if (!token) {
    return res.status(400).json({ error: 'token is required' }).end();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' }).end();
  }

  const accessToken = authHeader.substring(7);
  if (!accessToken || accessToken === 'null' || accessToken === 'undefined') {
    return res.status(401).json({ error: 'Invalid access token' }).end();
  }

  try {
    const tokenStore = sharetribeSdk.tokenStore.memoryStore();
    tokenStore.setToken({
      access_token: accessToken,
      token_type: 'bearer',
    });

    const sdk = sharetribeSdk.createInstance({
      clientId: CLIENT_ID,
      tokenStore,
      typeHandlers,
      ...(BASE_URL ? { baseUrl: BASE_URL } : {}),
    });

    const currentUserRes = await sdk.currentUser.show();
    const currentUser = currentUserRes.data.data;
    const privateData = currentUser.attributes.profile.privateData || {};
    let deviceTokens = Array.isArray(privateData.deviceTokens)
      ? [...privateData.deviceTokens]
      : [];

    if (unregister === true || unregister === 'true') {
      const nextTokens = deviceTokens.filter(t => t?.token !== token);
      // Top-level merge only — do not re-send the whole privateData object
      await sdk.currentUser.updateProfile({
        privateData: { deviceTokens: nextTokens },
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

    const existingIndex = deviceTokens.findIndex(t => t?.token === token);
    const entry = {
      token,
      platform: platform || 'unknown',
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      deviceTokens[existingIndex] = {
        ...deviceTokens[existingIndex],
        ...entry,
      };
    } else {
      deviceTokens.push({
        ...entry,
        createdAt: new Date().toISOString(),
      });
      if (deviceTokens.length > 5) {
        deviceTokens = deviceTokens.slice(-5);
      }
    }

    await sdk.currentUser.updateProfile({
      privateData: { deviceTokens },
    });

    console.log('✅ Device token registered for user:', currentUser.id.uuid);

    return res
      .status(200)
      .json({
        success: true,
        message: 'Device token registered',
      })
      .end();
  } catch (error) {
    const status = error?.status || error?.response?.status || 500;
    const data = error?.data || error?.response?.data || null;
    const sharetribeMessage =
      data?.errors?.[0]?.title || error?.message || 'Unknown error';

    console.error('❌ register-device-token error:', status, sharetribeMessage, data);

    return res
      .status(status >= 400 && status < 600 ? status : 500)
      .json({
        error: 'Failed to register device token',
        message: sharetribeMessage,
        details: data,
      })
      .end();
  }
};
