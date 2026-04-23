/**
 * Get responses (offers) for a listing with customer details, reviews, and verification
 * Sorted by: 1) Verified + Reviews, 2) Verified only, 3) Reviews only, 4) Others
 */

const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const sharetribeSdk = require('sharetribe-flex-sdk');

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

      // Get verification status from metadata
      const metadata = customer.attributes?.profile?.metadata || {};
      const isVerified = metadata.isVerified === true;

      // Get first message as preview
      let messagePreview = '';
      const messagesRef = tx.relationships?.messages?.data;
      if (messagesRef && messagesRef.length > 0) {
        const firstMessage = included.find(
          item => item.type === 'message' && item.id.uuid === messagesRef[0].id.uuid
        );
        if (firstMessage?.attributes?.content) {
          messagePreview = firstMessage.attributes.content.substring(0, 100);
          if (firstMessage.attributes.content.length > 100) {
            messagePreview += '...';
          }
        }
      }

      // Get offer price from protectedData or lineItems
      let offerPrice = 0;
      const protectedData = tx.attributes?.protectedData || {};
      if (protectedData.offerPrice) {
        offerPrice = protectedData.offerPrice;
      } else if (tx.attributes?.lineItems) {
        const lineItem = tx.attributes.lineItems.find(li => 
          li.code === 'line-item/offer-price' || li.code === 'line-item/units'
        );
        if (lineItem?.unitPrice?.amount) {
          offerPrice = lineItem.unitPrice.amount / 100;
        }
      }

      // Get customer reviews
      let reviewCount = 0;
      let averageRating = 0;
      try {
        const reviewsResponse = await marketplaceSdk.reviews.query({
          subjectId: customer.id.uuid,
          state: 'public',
          perPage: 100,
        });
        const reviews = reviewsResponse.data.data || [];
        reviewCount = reviews.length;
        if (reviewCount > 0) {
          const totalRating = reviews.reduce((sum, review) => {
            return sum + (review.attributes.rating || 0);
          }, 0);
          averageRating = Math.round((totalRating / reviewCount) * 10) / 10;
        }
      } catch (err) {
        console.error('❌ Error fetching reviews for customer:', customer.id.uuid, err.message);
      }

      // Get completed tasks count
      let completedTasks = 0;
      try {
        const completedTxResponse = await integrationSdk.transactions.query({
          customerId: customer.id.uuid,
          perPage: 100,
        });
        const completedTransitions = [
          'transition/complete',
          'transition/review-1-by-customer',
          'transition/review-2-by-customer',
          'transition/review-1-by-provider',
          'transition/review-2-by-provider',
        ];
        const allTx = completedTxResponse.data.data || [];
        completedTasks = allTx.filter(t => 
          completedTransitions.includes(t.attributes.lastTransition)
        ).length;
      } catch (err) {
        console.error('❌ Error fetching completed tasks:', err.message);
      }

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
        status,
        statusLabel,
        createdAt: tx.attributes?.createdAt,
        lastTransition,
      };
    });

    const responses = (await Promise.all(responsePromises)).filter(r => r !== null);

    // Sort responses by priority:
    // 1. Verified + Reviews (by rating, then review count)
    // 2. Verified only
    // 3. Reviews only (by rating, then review count)
    // 4. Others (by date)
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
        return b.reviewCount - a.reviewCount;
      }

      // Group 2: Verified only
      const aVerifiedOnly = aVerified && !aHasReviews;
      const bVerifiedOnly = bVerified && !bHasReviews;
      
      if (aVerifiedOnly && !bVerifiedOnly) return -1;
      if (!aVerifiedOnly && bVerifiedOnly) return 1;

      // Group 3: Reviews only
      const aReviewsOnly = !aVerified && aHasReviews;
      const bReviewsOnly = !bVerified && bHasReviews;
      
      if (aReviewsOnly && !bReviewsOnly) return -1;
      if (!aReviewsOnly && bReviewsOnly) return 1;
      
      if (aReviewsOnly && bReviewsOnly) {
        if (b.averageRating !== a.averageRating) {
          return b.averageRating - a.averageRating;
        }
        return b.reviewCount - a.reviewCount;
      }

      // Group 4: By date (newest first)
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
