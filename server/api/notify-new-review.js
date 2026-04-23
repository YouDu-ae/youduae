const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const { sendNewReviewNotification } = require('./send-notification');

/**
 * Notify user about a new review
 * Called after submitting a review to trigger push notification
 */
module.exports = async (req, res) => {
  const { recipientId, reviewerName, rating } = req.body;

  if (!recipientId || !reviewerName || rating === undefined) {
    return res.status(400).json({ 
      error: 'recipientId, reviewerName, and rating are required' 
    }).end();
  }

  // Extract Bearer token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' }).end();
  }

  try {
    const result = await sendNewReviewNotification(recipientId, reviewerName, rating);
    
    console.log('📤 Review notification sent:', result);

    res.status(200).json({ 
      success: true,
      ...result,
    }).end();

  } catch (error) {
    console.error('❌ notify-new-review error:', error.message);
    res.status(500).json({ 
      error: 'Failed to send notification',
      message: error.message,
    }).end();
  }
};
