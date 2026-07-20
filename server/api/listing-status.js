const { getSdk } = require('../api-util/sdk');

module.exports = async (req, res) => {
  const { listingId } = req.query;

  if (!listingId) {
    return res.status(400).json({ error: 'listingId is required' });
  }

  try {
    const sdk = getSdk(req, res);

    const listingUUID =
      typeof listingId === 'string'
        ? { _sdkType: 'UUID', uuid: listingId }
        : listingId;

    // publicData — источник правды после смены исполнителя
    let publicData = {};
    try {
      const listingResponse = await sdk.listings.show({ id: listingUUID });
      publicData = listingResponse?.data?.data?.attributes?.publicData || {};
    } catch (listingError) {
      console.warn('⚠️ listing-status: could not load listing publicData:', listingError?.message);
    }

    if (publicData.status === 'open' && !publicData.hired) {
      return res.status(200).json({ status: 'available' });
    }

    if (publicData.hired === true || publicData.status === 'in-progress') {
      return res.status(200).json({ status: 'in-progress' });
    }

    if (publicData.status === 'cancelled' || publicData.cancelled === true) {
      return res.status(200).json({ status: 'closed' });
    }

    // Загружаем транзакции для листинга
    const response = await sdk.transactions.query({
      listingId,
      only: 'order',
      perPage: 100,
    });

    const transactions = response.data.data;

    if (transactions.length === 0) {
      return res.status(200).json({ status: 'available' });
    }

    // Берем последнюю транзакцию
    const lastTransaction = transactions[0];
    const lastTransition = lastTransaction.attributes.lastTransition;

    // Определяем статус на основе последнего перехода
    if (lastTransition === 'transition/accept-offer') {
      return res.status(200).json({ status: 'in-progress' });
    }

    if (
      lastTransition === 'transition/complete' ||
      lastTransition === 'transition/review-1-by-customer' ||
      lastTransition === 'transition/review-1-by-provider' ||
      lastTransition === 'transition/review-2-by-customer' ||
      lastTransition === 'transition/review-2-by-provider'
    ) {
      return res.status(200).json({ status: 'closed' });
    }

    // По умолчанию - доступен
    return res.status(200).json({ status: 'available' });
  } catch (error) {
    console.error('❌ listing-status error:', error);
    return res.status(500).json({ error: 'Failed to check listing status' });
  }
};

