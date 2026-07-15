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
  const { listingId, assignedTo, status, transactionId, executorName, reviewSubmitted } = req.body;
  
  if (!listingId) {
    return res.status(400).json({ error: 'listingId is required' }).end();
  }

  // Check for Bearer token (mobile) or use cookie-based SDK (web)
  const authHeader = req.headers.authorization;
  let sdk;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const accessToken = authHeader.substring(7);
    
    if (!accessToken || accessToken === 'null' || accessToken === 'undefined') {
      console.log('❌ update-listing-status: Invalid access token');
      return res.status(401).json({ error: 'Invalid access token' }).end();
    }
    
    console.log('📱 update-listing-status: Using Bearer token auth');
    
    const tokenStore = sharetribeSdk.tokenStore.memoryStore();
    tokenStore.setToken({ 
      access_token: accessToken,
      token_type: 'bearer'
    });
    
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

  // Ensure listingId is in correct format for SDK
  const listingUUID = typeof listingId === 'string' 
    ? { _sdkType: 'UUID', uuid: listingId }
    : listingId;

  // Обновляем publicData листинга
  const updateParams = {
    id: listingUUID,
    publicData: {}
  };

  if (assignedTo) {
    updateParams.publicData.assignedTo = assignedTo;
  }
  if (transactionId) {
    updateParams.publicData.transactionId = transactionId;
  }
  if (executorName) {
    updateParams.publicData.executorName = executorName;
  }
  if (status) {
    updateParams.publicData.status = status;
    // Если статус "in-progress", устанавливаем hired=true
    if (status === 'in-progress') {
      updateParams.publicData.hired = true;
      updateParams.publicData.cancelled = false;
      updateParams.publicData.reviewSubmitted = false; // Track if review was submitted
      console.log('  → Setting hired=true for in-progress status');
    }
    if (status === 'cancelled') {
      updateParams.publicData.cancelled = true;
      updateParams.publicData.hired = false;
      console.log('  → Marking listing as cancelled');
    }
    // Reopen for new offers (change executor)
    if (status === 'open') {
      updateParams.publicData.hired = false;
      updateParams.publicData.cancelled = false;
      updateParams.publicData.assignedTo = null;
      updateParams.publicData.executorName = null;
      updateParams.publicData.transactionId = null;
      updateParams.publicData.reviewSubmitted = false;
      console.log('  → Clearing executor assignment');
    }
  }
  if (reviewSubmitted !== undefined) {
    updateParams.publicData.reviewSubmitted = reviewSubmitted;
    console.log('  → Setting reviewSubmitted:', reviewSubmitted);
  }

  // Сначала обновляем publicData
  sdk.ownListings
    .update(updateParams)
    .then(apiResponse => {
      console.log('✅ update-listing-status: publicData updated');
      
      // Закрыть листинг (скрыть из поиска)
      if (status === 'in-progress' || status === 'cancelled') {
        console.log('  → Closing listing...');
        return sdk.ownListings.close({ id: listingUUID });
      }
      // Снова открыть для откликов
      if (status === 'open') {
        console.log('  → Opening listing for new offers...');
        return sdk.ownListings.open({ id: listingUUID });
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

