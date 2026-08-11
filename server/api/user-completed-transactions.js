const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const { queryAllPages } = require('../api-util/paginate');
const { COMPLETED_TRANSITIONS } = require('../api-util/reputation');

module.exports = (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    res.status(400).json({ error: 'Missing userId parameter' });
    return;
  }

  const integrationClientId = process.env.INTEGRATION_API_CLIENT_ID;
  const integrationClientSecret = process.env.INTEGRATION_API_CLIENT_SECRET;

  if (!integrationClientId || !integrationClientSecret) {
    console.error('❌ Integration API credentials missing');
    res.status(500).json({ error: 'Integration API not configured' });
    return;
  }

  const integrationSdk = sharetribeIntegrationSdk.createInstance({
    clientId: integrationClientId,
    clientSecret: integrationClientSecret,
  });

  // The user can appear on either side of a transaction, so both roles are
  // queried. Sharetribe applies the completed-transition filter itself, which
  // keeps unfinished tasks off the wire entirely.
  const queryRole = filterKey =>
    queryAllPages(({ page, perPage }) =>
      integrationSdk.transactions.query({
        [filterKey]: userId,
        lastTransitions: COMPLETED_TRANSITIONS,
        include: ['listing', 'customer', 'provider'],
        page,
        perPage,
      })
    );

  Promise.all([queryRole('customerId'), queryRole('providerId')])
    .then(([asCustomer, asProvider]) => {
      const filteredTransactions = [...asCustomer.items, ...asProvider.items];
      const included = [...asCustomer.included, ...asProvider.included];

      const completedWorks = filteredTransactions.map(tx => {
        const listingRef = tx.relationships?.listing?.data;
        const listing = listingRef
          ? included.find(item => item.id.uuid === listingRef.id.uuid && item.type === 'listing')
          : null;

        // Extract price from protectedData (for inquiry process)
        const protectedData = tx.attributes.protectedData || {};
        const offerPrice = protectedData.offer?.price;
        const offerCurrency = protectedData.offer?.currency || 'AED';

        return {
          transactionId: tx.id.uuid,
          listingId: listing?.id?.uuid,
          listingTitle: listing?.attributes?.title || 'Unnamed task',
          category: listing?.attributes?.publicData?.category,
          completedAt: tx.attributes.lastTransitionedAt || tx.attributes.createdAt,
          state: tx.attributes.lastTransition,
          price: offerPrice,
          currency: offerCurrency,
        };
      });

      console.log(
        `✅ Completed transactions for ${userId}: ${completedWorks.length} (as specialist ${asCustomer.items.length}, as client ${asProvider.items.length})`
      );

      res.status(200).json({
        completedWorks,
        total: completedWorks.length,
      });
    })
    .catch(err => {
      const status = err?.status || err?.statusCode;
      const data = err?.data || err?.response?.data;
      const apiErrors = data?.errors || data;

      console.error('❌ Query error:', {
        message: err?.message,
        status,
        apiErrors,
      });

      res.status(500).json({
        error: 'Query failed',
        details: err?.message,
        status,
        apiErrors,
      });
    });
};

