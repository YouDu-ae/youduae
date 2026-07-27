/**
 * API endpoint to notify admin about new portfolio photos pending moderation
 */

const { notifyAdminPortfolioModeration } = require('./telegram-bot');

async function notifyPortfolioModeration(req, res) {
  try {
    const { userId, userName, photosCount } = req.body;
    
    if (!userId || !userName || !photosCount) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, userName, photosCount' 
      });
    }
    
    const profileUrl = `https://youdu.ae/u/${userId}`;
    const consoleUrl = `https://console.sharetribe.com/a/users/${userId}`;
    
    const result = await notifyAdminPortfolioModeration({
      userId,
      userName,
      photosCount,
      profileUrl,
      consoleUrl,
    });
    
    if (result) {
      console.log(`📸 Admin notified about portfolio moderation for user ${userId}`);
      res.json({ success: true });
    } else {
      console.log(`⚠️ Failed to notify admin (TELEGRAM_ADMIN_CHAT_ID not set or error)`);
      res.json({ success: false, reason: 'Admin chat ID not configured' });
    }
  } catch (error) {
    console.error('Error sending portfolio moderation notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
}

module.exports = notifyPortfolioModeration;
