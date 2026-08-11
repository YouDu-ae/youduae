/**
 * Get responses (offers) for a listing with customer details, reviews, and verification
 * Sorted by: 1) Verified + Reviews, 2) Verified only, 3) Reviews only, 4) Others
 */

const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const sharetribeSdk = require('sharetribe-flex-sdk');
const {
  ROLE,
  resolveIsVerified,
  fetchReviewStats,
  fetchCompletedCount,
} = require('../api-util/reputation');

module.exports = async (req, res) => {
  const { listingId } = req.query;

  if (!listingId) {
    return res.status(400).json({ error: 'listingId parameter is required' });
  }

  console.log('🔍 listing-responses: Loading responses for listing:', listingId);

  const integrationClientId = process.env.INTEGRATION_API_CLIENT_ID;
  const integrationClientSecret = process.env.INTEGRATION_API_CLIENT_SECRET;
  const marketplaceClientId = process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID;
  const marketplaceClientSecret = process.env.SHARETRIBE_SDK_CLIENT_SECRET;

  if (!integrationClientId || !integrationClientSecret) {
    return res.status(500).json({ error: 'Integration API credentials not configured' });
  }

  try {
    // SECURITY: Require authentication and verify requester is listing author (provider).
    // This endpoint returns all responses for a listing and must not be publicly accessible.
    const authHeader = req.headers.authorization;
    const hasBearerToken = authHeader && authHeader.startsWith('Bearer ');
    const hasCookieAuth = req.cookies && (req.cookies.st || req.cookies['st-token']);

    if (!hasBearerToken && !hasCookieAuth) {
      return res.status(401).json({ error: 'Authorization required' }).end();
    }

    let userSdk;
    if (hasBearerToken) {
      const accessToken = authHeader.substring(7);
      if (!accessToken || accessToken === 'null' || accessToken === 'undefined') {
        return res.status(401).json({ error: 'Invalid access token' }).end();
      }

      const tokenStore = sharetribeSdk.tokenStore.memoryStore();
      tokenStore.setToken({
        access_token: accessToken,
        token_type: 'bearer',
      });

      userSdk = sharetribeSdk.createInstance({
        clientId: marketplaceClientId,
        clientSecret: marketplaceClientSecret,
        tokenStore,
      });
    } else {
      // Cookie auth (web). Use request object so sdk picks up cookies.
      userSdk = sharetribeSdk.createInstance({
        clientId: marketplaceClientId,
        clientSecret: marketplaceClientSecret,
        req,
      });
    }

    const currentUserRes = await userSdk.currentUser.show();
    const currentUserId = currentUserRes?.data?.data?.id?.uuid;
    if (!currentUserId) {
      return res.status(401).json({ error: 'Unable to identify current user' }).end();
    }

    // Verify the current user is the listing author
    const listingRes = await userSdk.listings.show({ id: listingId, include: ['author'] });
    const authorId = listingRes?.data?.data?.relationships?.author?.data?.id?.uuid;
    if (!authorId) {
      return res.status(404).json({ error: 'Listing not found' }).end();
    }
    if (authorId !== currentUserId) {
      return res.status(403).json({ error: 'Forbidden' }).end();
    }

    const integrationSdk = sharetribeIntegrationSdk.createInstance({
      clientId: integrationClientId,
      clientSecret: integrationClientSecret,
    });

    const marketplaceSdk = sharetribeSdk.createInstance({
      clientId: marketplaceClientId,
      clientSecret: marketplaceClientSecret,
    });

    // Get all transactions for this listing
    const transactionsResponse = await integrationSdk.transactions.query({
      listingId,
      include: ['customer', 'customer.profileImage', 'listing', 'messages'],
      'fields.transaction': ['payinTotal', 'payoutTotal', 'lineItems', 'protectedData', 'lastTransition', 'createdAt'],
      'fields.user': ['profile.displayName', 'profile.abbreviatedName', 'profile.publicData', 'profile.metadata', 'profile.bio'],
      'fields.image': ['variants.square-small', 'variants.square-small2x'],
      'fields.message': ['content', 'createdAt'],
      perPage: 100,
    });

    const transactions = transactionsResponse.data.data || [];
    const included = transactionsResponse.data.included || [];

    console.log(`📊 Found ${transactions.length} transactions for listing ${listingId}`);

    // Process each transaction to get customer details with reviews
    const responsePromises = transactions.map(async (tx) => {
      const customerRef = tx.relationships?.customer?.data;
      if (!customerRef) return null;

      // Find customer in included
      const customer = included.find(
        item => item.type === 'user' && item.id.uuid === customerRef.id.uuid
      );
      if (!customer) return null;

      // Find customer profile image
      const profileImageRef = customer.relationships?.profileImage?.data;
      const profileImage = profileImageRef
        ? included.find(
            item => item.type === 'image' && item.id.uuid === profileImageRef.id.uuid
          )
        : null;

      // Get avatar URL
      let avatarUrl = null;
      if (profileImage?.attributes?.variants) {
        avatarUrl = 
          profileImage.attributes.variants['square-small2x']?.url ||
          profileImage.attributes.variants['square-small']?.url;
      }

      const isVerified = resolveIsVerified(customer.attributes?.profile);

      // Last message as preview (matches chat UX — newest activity)
      let messagePreview = '';
      let lastMessageAt = null;
      const messagesRef = tx.relationships?.messages?.data;
      if (messagesRef && messagesRef.length > 0) {
        const lastRef = messagesRef[messagesRef.length - 1];
        const lastMessage = included.find(
          item => item.type === 'message' && item.id.uuid === lastRef.id.uuid
        );
        if (lastMessage?.attributes?.content) {
          messagePreview = lastMessage.attributes.content.substring(0, 100);
          if (lastMessage.attributes.content.length > 100) {
            messagePreview += '...';
          }
        }
        if (lastMessage?.attributes?.createdAt) {
          lastMessageAt = lastMessage.attributes.createdAt;
        }
      }

      // Get offer price from protectedData.offer.price (this is where YouDu stores the offer price)
      let offerPrice = 0;
      const offerData = tx.attributes?.protectedData?.offer || {};
      
      console.log(`💰 Transaction ${tx.id.uuid} offer data:`, offerData);
      
      if (offerData.price !== undefined && offerData.price !== null) {
        offerPrice = offerData.price;
        console.log(`  → Using protectedData.offer.price: ${offerPrice}`);
      } else if (tx.attributes?.payinTotal?.amount) {
        offerPrice = tx.attributes.payinTotal.amount / 100;
        console.log(`  → Using payinTotal: ${offerPrice}`);
      }

      // Everyone responding to a task is rated as a specialist, which is the
      // customer side of the transaction in Sharetribe terms.
      const [reviews, completedTasks] = await Promise.all([
        fetchReviewStats(marketplaceSdk, {
          subjectId: customer.id.uuid,
          role: ROLE.SPECIALIST,
        }),
        fetchCompletedCount(integrationSdk, {
          userId: customer.id.uuid,
          role: ROLE.SPECIALIST,
        }),
      ]);
      const { count: reviewCount, averageRating } = reviews;

      // Get transaction status
      const lastTransition = tx.attributes?.lastTransition || '';
      let status = 'pending';
      let statusLabel = 'Новый отклик';

      if (lastTransition.includes('accept') || lastTransition.includes('operator-accept')) {
        status = 'accepted';
        statusLabel = 'Выбран';
      } else if (lastTransition.includes('decline') || lastTransition.includes('cancel')) {
        status = 'declined';
        statusLabel = 'Отклонён';
      } else if (lastTransition.includes('complete') || lastTransition.includes('review')) {
        status = 'completed';
        statusLabel = 'Завершён';
      }

      return {
        transactionId: tx.id.uuid,
        customerId: customer.id.uuid,
        displayName: customer.attributes?.profile?.displayName || 'Исполнитель',
        abbreviatedName: customer.attributes?.profile?.abbreviatedName || '',
        bio: customer.attributes?.profile?.bio || '',
        avatarUrl,
        isVerified,
        reviewCount,
        averageRating,
        completedTasks,
        offerPrice,
        messagePreview,
        lastMessageAt,
        status,
        statusLabel,
        createdAt: tx.attributes?.createdAt,
        lastTransition,
      };
    });

    const responses = (await Promise.all(responsePromises)).filter(r => r !== null);

    /** Newest chat activity first (last message time), else transaction createdAt */
    const dialogFreshnessMs = (r) => {
      if (r.lastMessageAt) return new Date(r.lastMessageAt).getTime();
      return new Date(r.createdAt).getTime();
    };

    // Sort responses by priority:
    // 1. Verified + Reviews (by rating, then review count, then dialog freshness)
    // 2. Verified only
    // 3. Reviews only (by rating, then review count, then dialog freshness)
    // 4. Others (by dialog freshness, then createdAt)
    const sortedResponses = responses.sort((a, b) => {
      const aVerified = a.isVerified;
      const bVerified = b.isVerified;
      const aHasReviews = a.reviewCount > 0;
      const bHasReviews = b.reviewCount > 0;

      // Group 1: Verified + Reviews
      const aBoth = aVerified && aHasReviews;
      const bBoth = bVerified && bHasReviews;
      
      if (aBoth && !bBoth) return -1;
      if (!aBoth && bBoth) return 1;
      
      if (aBoth && bBoth) {
        if (b.averageRating !== a.averageRating) {
          return b.averageRating - a.averageRating;
        }
        if (b.reviewCount !== a.reviewCount) {
          return b.reviewCount - a.reviewCount;
        }
        return dialogFreshnessMs(b) - dialogFreshnessMs(a);
      }

      // Group 2: Verified only
      const aVerifiedOnly = aVerified && !aHasReviews;
      const bVerifiedOnly = bVerified && !bHasReviews;
      
      if (aVerifiedOnly && !bVerifiedOnly) return -1;
      if (!aVerifiedOnly && bVerifiedOnly) return 1;

      if (aVerifiedOnly && bVerifiedOnly) {
        return dialogFreshnessMs(b) - dialogFreshnessMs(a);
      }

      // Group 3: Reviews only
      const aReviewsOnly = !aVerified && aHasReviews;
      const bReviewsOnly = !bVerified && bHasReviews;
      
      if (aReviewsOnly && !bReviewsOnly) return -1;
      if (!aReviewsOnly && bReviewsOnly) return 1;
      
      if (aReviewsOnly && bReviewsOnly) {
        if (b.averageRating !== a.averageRating) {
          return b.averageRating - a.averageRating;
        }
        if (b.reviewCount !== a.reviewCount) {
          return b.reviewCount - a.reviewCount;
        }
        return dialogFreshnessMs(b) - dialogFreshnessMs(a);
      }

      // Group 4: By dialog freshness, then createdAt
      const f = dialogFreshnessMs(b) - dialogFreshnessMs(a);
      if (f !== 0) return f;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Log for debugging
    console.log(`📤 Sending ${sortedResponses.length} responses:`);
    sortedResponses.forEach((r, i) => {
      const verified = r.isVerified ? '✅' : '❌';
      const rating = r.reviewCount > 0 ? `⭐${r.averageRating} (${r.reviewCount})` : 'нет отзывов';
      console.log(`  ${i + 1}. ${verified} ${r.displayName} - ${rating} - ${r.offerPrice} AED`);
    });

    res.status(200).json({
      data: sortedResponses,
      meta: {
        totalCount: sortedResponses.length,
        listingId,
      },
    });

  } catch (err) {
    console.error('❌ listing-responses error:', err.message);
    res.status(500).json({
      error: 'Failed to fetch responses',
      details: err.message,
    });
  }
};
