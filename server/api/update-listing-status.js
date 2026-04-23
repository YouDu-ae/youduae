const sharetribeSdk = require('sharetribe-flex-sdk');
const { getSdk, handleError, serialize, typeHandlers } = require('../api-util/sdk');

const CLIENT_ID = process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID;
const BASE_URL = process.env.REACT_APP_SHARETRIBE_SDK_BASE_URL;

/**
 * Обновляет publicData листинга (например, status и assignedTo).
 * Используется после accept-offer чтобы пометить листинг как "в работе".
 * Поддерживает как cookie auth (web), так и Bearer token auth (mobile).
 */
module.exports = async (req, res) => {
  const { listingId, assignedTo, status } = req.body;
  
  if (!listingId) {
    return res.status(400).json({ error: 'listingId is required' }).end();
  }

  // Check for Bearer token (mobile) or use cookie-based SDK (web)
  const authHeader = req.headers.authorization;
  let sdk;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const accessToken = authHeader.substring(7);
    console.log('📱 update-listing-status: Using Bearer token auth');
    
    const tokenStore = sharetribeSdk.tokenStore.memoryStore();
    tokenStore.setToken({ access_token: accessToken });
    
    sdk = sharetribeSdk.createInstance({
      clientId: CLIENT_ID,
      tokenStore,
      typeHandlers,
      ...(BASE_URL ? { baseUrl: BASE_URL } : {}),
    });
  } else {
    console.log('🌐 update-listing-status: Using cookie auth');
    sdk = getSdk(req, res);
  }

  console.log('🔄 update-listing-status:', { listingId, assignedTo, status });

  // Обновляем publicData листинга
  const updateParams = {
    id: listingId,
    publicData: {}
  };

  if (assignedTo) {
    updateParams.publicData.assignedTo = assignedTo;
  }
  if (status) {
    updateParams.publicData.status = status;
    // Если статус "in-progress", устанавливаем hired=true
    if (status === 'in-progress') {
      updateParams.publicData.hired = true;
      console.log('  → Setting hired=true for in-progress status');
    }
  }

  // Сначала обновляем publicData
  sdk.ownListings
    .update(updateParams)
    .then(apiResponse => {
      console.log('✅ update-listing-status: publicData updated');
      
      // Если нужно закрыть листинг (при in-progress), делаем отдельный вызов
      if (status === 'in-progress') {
        console.log('  → Closing listing to hide from search...');
        return sdk.ownListings.close({ id: listingId });
      }
      
      return apiResponse;
    })
    .then(apiResponse => {
      const { status: httpStatus, statusText, data } = apiResponse;
      console.log('✅ update-listing-status: complete (listing closed if needed)');

      res
        .status(httpStatus)
        .set('Content-Type', 'application/transit+json')
        .send(
          serialize({
            status: httpStatus,
            statusText,
            data,
          })
        )
        .end();
    })
    .catch(e => {
      console.error('❌ update-listing-status error:', e?.status, e?.statusText, e?.data);
      handleError(res, e);
    });
};

