/**
 * Compact counts for the task chat: how many *other* specialists still have
 * a pending offer on the same listing. Names and prices of those offers are
 * not returned — the chat participants only need a number.
 *
 * Auth: the current user must be the provider or the customer of the given
 * transaction. Integration API is used because a specialist cannot query
 * other people's transactions through the Marketplace API.
 */

const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');

const PENDING_TRANSITION = 'transition/inquire';

const asUuid = idLike => {
  if (!idLike) return null;
  if (typeof idLike === 'string') return idLike;
  return idLike.uuid || null;
};

module.exports = async (req, res) => {
  const transactionId = asUuid(req.query.transactionId);
  if (!transactionId) {
    return res.status(400).json({ error: 'transactionId is required' });
  }

  const clientId = process.env.INTEGRATION_API_CLIENT_ID;
  const clientSecret = process.env.INTEGRATION_API_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Integration API is not configured' });
  }

  try {
    const integrationSdk = sharetribeIntegrationSdk.createInstance({
      clientId,
      clientSecret,
    });

    const txResponse = await integrationSdk.transactions.show({ id: transactionId });
    const tx = txResponse.data.data;
    const providerId = asUuid(tx.relationships?.provider?.data?.id);
    const customerId = asUuid(tx.relationships?.customer?.data?.id);
    const listingId = asUuid(tx.relationships?.listing?.data?.id);

    if (req.authUserId !== providerId && req.authUserId !== customerId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!listingId) {
      return res.status(200).json({ otherOfferCount: 0 });
    }

    const pendingResponse = await integrationSdk.transactions.query({
      listingId,
      lastTransitions: [PENDING_TRANSITION],
      perPage: 1,
    });

    const pendingTotal = pendingResponse.data.meta?.totalItems || 0;
    const thisOfferIsPending = tx.attributes?.lastTransition === PENDING_TRANSITION;
    const otherOfferCount = thisOfferIsPending ? Math.max(0, pendingTotal - 1) : pendingTotal;

    return res.status(200).json({ otherOfferCount });
  } catch (err) {
    console.error('❌ task-chat-summary:', err.message);
    return res.status(500).json({ error: 'Failed to load task summary' });
  }
};
