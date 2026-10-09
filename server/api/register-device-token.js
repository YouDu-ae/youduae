const db = require('../db');

const MAX_TOKEN_LENGTH = 4096;

/**
 * POST /api/register-device-token — binds the app's FCM token to the account
 * signed in on the phone; with `unregister` it drops the token on sign-out.
 *
 * Dropping needs no valid session. The app signs out with an access token that
 * has often expired, and only the phone and this server know the FCM token,
 * so knowing it is proof enough to stop pushes to that phone.
 */
module.exports = async (req, res) => {
  const { token, platform, unregister } = req.body || {};

  if (typeof token !== 'string' || !token || token.length > MAX_TOKEN_LENGTH) {
    return res.status(400).json({ error: 'token is required' }).end();
  }

  try {
    if (unregister === true || unregister === 'true') {
      await db.unregisterDeviceToken(token);
      console.log('✅ Device token unregistered');
      return res
        .status(200)
        .json({ success: true, message: 'Device token removed' })
        .end();
    }

    if (!req.authUserId) {
      return res.status(401).json({ error: 'Authorization required' }).end();
    }

    await db.registerDeviceToken({
      userId: req.authUserId,
      token,
      platform: String(platform || 'unknown').slice(0, 20),
    });
    console.log('✅ Device token registered for user:', req.authUserId);
    return res
      .status(200)
      .json({ success: true, message: 'Device token registered' })
      .end();
  } catch (error) {
    console.error('❌ register-device-token error:', error.message);
    return res.status(500).json({ error: 'Failed to register device token' }).end();
  }
};
