const sharetribeSdk = require('sharetribe-flex-sdk');
const { getSdk, handleError, serialize, typeHandlers } = require('../api-util/sdk');
const { notifyExecutorsAboutReopenedListing } = require('../api-util/notifyListingPublished');
const db = require('../db');

const CLIENT_ID = process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID;
const BASE_URL = process.env.REACT_APP_SHARETRIBE_SDK_BASE_URL;

/**
 * After «Сменить исполнителя»: keep a record of who was taken off the task and
 * tell executors in its category that it is looking for someone again. The
 * record is also what stops a retried request from announcing the task twice.
 * Neither may fail the reopening, which has already happened.
 */
const afterReopen = async ({
  listingId,
  removedUserId,
  authorId,
  transactionId,
  excludeUserIds,
}) => {
  let firstTime = true;
  if (removedUserId) {
    try {
      firstTime = await db.recordExecutorChange({
        listingId,
        removedUserId,
        authorId,
        transactionId,
      });
    } catch (error) {
      console.error('⚠️ update-listing-status: executor change not recorded:', error.message);
    }
  }
  if (!firstTime) {
    console.log('  → Executor change already recorded, task not announced again');
    return;
  }

  try {
    const outcome = await notifyExecutorsAboutReopenedListing(listingId, { excludeUserIds });
    console.log('  → Reopened task announced:', JSON.stringify(outcome));
  } catch (error) {
    console.error('⚠️ update-listing-status: reopened task not announced:', error.message);
  }
};

/**
 * Обновляет publicData листинга (например, status и assignedTo).
 * Используется после accept-offer чтобы пометить листинг как "в работе".
 * Поддерживает как cookie auth (web), так и Bearer token auth (mobile).
 */
module.exports = async (req, res) => {
  const { listingId, assignedTo, status, transactionId, executorName, reviewSubmitted, removedCustomerId } = req.body;
  
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

  // Объект вида { _sdkType: 'UUID' } SDK принимает только в теле POST, а GET
  // (ownListings.show) с ним падает: нужен настоящий UUID.
  const listingUUID =
    typeof listingId === 'string' ? new sharetribeSdk.types.UUID(listingId) : listingId;

  // Filled in while reopening, for afterReopen.
  let reopening = null;

  const buildUpdateAndApply = (existingPublicData = {}) => {
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
      const prevExcluded = Array.isArray(existingPublicData.excludedOfferCustomerIds)
        ? existingPublicData.excludedOfferCustomerIds
        : [];
      const toExclude = removedCustomerId || existingPublicData.assignedTo;
      if (toExclude) {
        updateParams.publicData.excludedOfferCustomerIds = Array.from(
          new Set([...prevExcluded, toExclude].filter(Boolean))
        );
      }
      reopening = {
        ...reopening,
        removedUserId: toExclude || null,
        transactionId: existingPublicData.transactionId || null,
        excluded: updateParams.publicData.excludedOfferCustomerIds || prevExcluded,
      };
      console.log('  → Clearing executor assignment');
    }
  }
  if (reviewSubmitted !== undefined) {
    updateParams.publicData.reviewSubmitted = reviewSubmitted;
    console.log('  → Setting reviewSubmitted:', reviewSubmitted);
  }

  // Сначала обновляем publicData
  // expand: the listing's state decides below whether it can be closed.
  return sdk.ownListings
    .update(updateParams, { expand: true })
    .then(apiResponse => {
      console.log('✅ update-listing-status: publicData updated');

      // Only a published listing can be closed. A task cancelled while
      // pendingApproval is already invisible to specialists; it stays in the
      // moderation queue marked cancelled, and approving it closes it
      // (reminders/listingApprovals).
      const state = apiResponse?.data?.data?.attributes?.state;
      if (status === 'cancelled' && state !== 'published') {
        console.log(`  → Not closing: listing is ${state}`);
        return apiResponse;
      }

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
    });
  };

  // Ошибка самого обновления не должна повторять его с пустыми данными:
  // повтор перезаписал бы excludedOfferCustomerIds без прежних исполнителей.
  const run =
    status === 'open'
      ? sdk.ownListings
          .show({ id: listingUUID, include: ['author'] })
          .then(
            showRes => {
              const listing = showRes?.data?.data;
              reopening = { authorId: listing?.relationships?.author?.data?.id?.uuid || null };
              return listing?.attributes?.publicData || {};
            },
            err => {
              console.warn('⚠️ Could not load listing before open; proceeding:', err?.message);
              return {};
            }
          )
          .then(buildUpdateAndApply)
      : buildUpdateAndApply({});

  run
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

      if (reopening) {
        const { authorId, removedUserId, transactionId, excluded } = reopening;
        return afterReopen({
          listingId: listingUUID.uuid,
          removedUserId,
          authorId,
          transactionId,
          excludeUserIds: [...(excluded || []), authorId].filter(Boolean),
        });
      }
    })
    .catch(e => {
      console.error('❌ update-listing-status error:', e?.status, e?.statusText, e?.data);
      handleError(res, e);
    });
};

