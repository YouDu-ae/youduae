const { getSdk } = require('../api-util/sdk');
const { notifyExecutorsAboutListing } = require('../api-util/notifyListingPublished');

/**
 * Triggered by the client after a listing draft is published, so executors with
 * Telegram linked get the "new task in your category" alert. Guest listings are
 * covered by create-guest-listing, which runs the same notifier server-side.
 */
module.exports = async (req, res) => {
  const { listingId } = req.body || {};

  if (!listingId) {
    return res.status(400).json({ error: 'listingId is required' }).end();
  }

  try {
    const sdk = getSdk(req, res);

    // ownListings shows the author every state, pendingApproval included, and
    // answers 404 for anyone else's listing, so it is the authorship check too.
    // The public listings endpoint used here before also answered 404 for a task
    // still in moderation, which stopped the admin alert from ever going out.
    try {
      await sdk.ownListings.show({ id: listingId });
    } catch (error) {
      if (error.status === 404) {
        return res.status(403).json({ error: 'Only the listing author can notify executors' }).end();
      }
      throw error;
    }

    // Fan-out over Telegram can take several seconds, so it runs detached.
    notifyExecutorsAboutListing(listingId)
      .then(result => {
        console.log('📱 notify-new-listing:', listingId, JSON.stringify(result));
      })
      .catch(error => {
        console.error('⚠️ notify-new-listing failed:', listingId, error.message);
      });

    return res.status(202).json({ success: true, queued: true }).end();
  } catch (error) {
    const status = error.status === 401 || error.status === 403 ? error.status : 500;
    console.error('❌ notify-new-listing error:', error.status, error.message);
    return res.status(status).json({ error: 'Failed to notify executors' }).end();
  }
};
