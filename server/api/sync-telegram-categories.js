const { getSdk } = require('../api-util/sdk');
const db = require('../db');

/**
 * Keeps the subscriber's categories in step with their profile.
 *
 * Broadcast targeting reads categories from the database, so a specialist who
 * edits their services would otherwise keep receiving the old set. Categories
 * are read from the account's own profile rather than the request body so the
 * client cannot subscribe itself to arbitrary categories.
 */
module.exports = async (req, res) => {
  let user;
  try {
    const sdk = getSdk(req, res);
    const response = await sdk.currentUser.show();
    user = response.data.data;
  } catch (authError) {
    // Sharetribe answers an anonymous currentUser.show with 403, so any
    // failure here means there is no usable session.
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const userId = user.id.uuid;
    const publicData = user.attributes.profile.publicData || {};
    const categories = Array.isArray(publicData.serviceCategories)
      ? publicData.serviceCategories
      : [];

    const updated = await db.updateTelegramSubscriberCategories(userId, categories);

    // No row means the user never linked Telegram, which is not an error.
    return res.status(200).json({
      success: true,
      synced: !!updated,
      categories: updated ? categories : [],
    });
  } catch (error) {
    console.error('⚠️ sync-telegram-categories failed:', error.message);
    return res.status(500).json({ error: 'Failed to sync categories' });
  }
};
