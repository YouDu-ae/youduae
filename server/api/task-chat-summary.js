/**
 * Compact counts for the task chat: how many *other* specialists still have
 * a pending offer on the same listing.
 *
 * The specialist who sent this offer only gets the number. The task author
 * (the customer of the transaction) also gets the other offers: name, price
 * and the chat id, so the chat can link to them. Comments stay out.
 *
 * Auth: the current user must be the provider or the customer of the given
 * transaction. Integration API is used because a specialist cannot query
 * other people's transactions through the Marketplace API.
 */

const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');

const PENDING_TRANSITION = 'transition/inquire';
const OTHER_OFFERS_PAGE = 20;

const asUuid = idLike => {
  if (!idLike) return null;
  if (typeof idLike === 'string') return idLike;
  return idLike.uuid || null;
};

const userName = user => {
  const profile = user?.attributes?.profile || {};
  return profile.displayName || profile.firstName || null;
};

/**
 * Other pending offers, for the task author only. The current chat is left
 * out. A missing name becomes null and the page shows a fallback.
 */
const otherOffersForAuthor = (transactions, included, currentTransactionId) => {
  const users = new Map(
    (included || []).filter(item => item.type === 'user').map(user => [user.id.uuid, user])
  );

  return transactions
    .filter(tx => asUuid(tx.id) !== currentTransactionId)
    .map(tx => {
      const providerId = asUuid(tx.relationships?.provider?.data?.id);
      const offer = tx.attributes?.protectedData?.offer || {};
      const price = Number(offer.price);
      return {
        transactionId: asUuid(tx.id),
        name: userName(users.get(providerId)),
        price: Number.isFinite(price) ? price : null,
        currency: offer.currency || 'AED',
      };
    });
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

    // Relationships come back only for what is listed in `include`.
    const txResponse = await integrationSdk.transactions.show({
      id: transactionId,
      include: ['provider', 'customer', 'listing'],
    });
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

    const isAuthor = req.authUserId === customerId;
    const pendingResponse = await integrationSdk.transactions.query({
      listingId,
      lastTransitions: [PENDING_TRANSITION],
      ...(isAuthor ? { include: ['provider'], perPage: OTHER_OFFERS_PAGE } : { perPage: 1 }),
    });

    const pendingTotal = pendingResponse.data.meta?.totalItems || 0;
    const thisOfferIsPending = tx.attributes?.lastTransition === PENDING_TRANSITION;
    const otherOfferCount = thisOfferIsPending ? Math.max(0, pendingTotal - 1) : pendingTotal;

    if (!isAuthor) {
      return res.status(200).json({ otherOfferCount });
    }

    return res.status(200).json({
      otherOfferCount,
      otherOffers: otherOffersForAuthor(pendingResponse.data.data || [], pendingResponse.data.included, transactionId),
    });
  } catch (err) {
    console.error('❌ task-chat-summary:', err.message);
    return res.status(500).json({ error: 'Failed to load task summary' });
  }
};

module.exports.otherOffersForAuthor = otherOffersForAuthor;
