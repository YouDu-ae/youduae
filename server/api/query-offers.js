const { getSdk, handleError, serialize } = require('../api-util/sdk');

/**
 * Query offers (transactions) for a specific listing
 * This endpoint allows the listing owner to see all offers for their listing
 */
module.exports = (req, res) => {
  const { listingId } = req.query;

  if (!listingId) {
    return res.status(400).json({ error: 'listingId is required' }).end();
  }

  const sdk = getSdk(req, res);

  console.log('🔍 query-offers: loading offers for listing', listingId);

  sdk.transactions
    .query({
      listingId,
      lastTransitions: ['transition/inquire', 'transition/accept-offer'],
      include: ['provider', 'customer', 'customer.profileImage', 'listing'],
      'fields.user': [
        'profile.displayName',
        'profile.abbreviatedName',
        'profile.publicData',
        'profile.metadata',
      ],
      'fields.image': [
        'variants.square-xsmall',
        'variants.square-xsmall2x',
        'variants.square-small',
        'variants.square-small2x',
      ],
      perPage: 100,
    })
    .then(apiResponse => {
      const { status, statusText, data } = apiResponse;
      console.log('✅ query-offers: loaded', data.data.length, 'offers');
      
      res
        .status(status)
        .set('Content-Type', 'application/transit+json')
        .send(
          serialize({
            status,
            statusText,
            data,
          })
        )
        .end();
    })
    .catch(e => {
      console.error('❌ query-offers error:', e?.status, e?.statusText);
      handleError(res, e);
    });
};

