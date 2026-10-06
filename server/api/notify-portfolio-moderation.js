/**
 * Sends a specialist's newly saved portfolio photos to the admin chat, each
 * with «Одобрить» / «Отклонить» buttons.
 *
 * The specialist is the signed-in caller. The body only says which of their
 * photos are new; whatever it claims is checked against the stored portfolio.
 */

const { notifyNewPhotos } = require('../api-util/portfolioModeration');

const MAX_IMAGE_IDS = 10;

async function notifyPortfolioModeration(req, res) {
  const { imageIds, photosCount } = req.body || {};
  const ids = Array.isArray(imageIds)
    ? imageIds.filter(id => typeof id === 'string').slice(0, MAX_IMAGE_IDS)
    : undefined;

  try {
    const { sent, total } = await notifyNewPhotos(req.authUserId, { imageIds: ids, photosCount });
    if (sent > 0) {
      console.log(`📸 Sent ${sent} portfolio photo(s) of ${req.authUserId} for moderation`);
    }
    res.json({ success: sent === total, sent });
  } catch (error) {
    console.error(
      'Error sending portfolio moderation notification:',
      error?.status,
      error?.message
    );
    res.status(500).json({ error: 'Failed to send notification' });
  }
}

module.exports = notifyPortfolioModeration;
