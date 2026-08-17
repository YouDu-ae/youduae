const { getSdk } = require('../api-util/sdk');
const { notifyExecutorsAboutListing } = require('../api-util/notifyListingPublished');
const { resolveCommunity } = require('../api-util/communities');

module.exports = async (req, res) => {
  const { 
    title, 
    description, 
    category, 
    subcategory,
    deadline,
    paymentMethod,
    location, 
    price, 
    images 
  } = req.body;

  console.log('📥 create-guest-listing: received request', {
    title,
    category,
    subcategory,
    deadline,
    paymentMethod,
    price,
    hasLocation: !!location,
    imageCount: images?.length || 0,
  });

  try {
    // Get SDK instance with current user's auth
    const sdk = getSdk(req, res);
    
    // Prepare listing data with proper category mapping
    // unitType обязан совпадать с configListing.js: EditListingDetailsPanel сверяет
    // listingType и unitType задания с конфигом, и при расхождении вместо формы
    // редактирования показывает «Outdated listing!». Процесс assignment-flow-v3
    // поддерживает только inquiry (см. PROCESSES в src/transactions/transaction.js).
    const publicData = {
      listingType: 'free-listing',
      transactionProcessAlias: 'assignment-flow-v3/release-1',
      unitType: 'inquiry',
    };
    
    // Map category and subcategory to categoryLevel1 and categoryLevel2
    if (category) {
      publicData.categoryLevel1 = category;
    }
    if (subcategory) {
      publicData.categoryLevel2 = subcategory;
    }
    
    // Add deadline and paymentMethod if provided
    if (deadline) {
      publicData.deadline = deadline;
    }
    if (paymentMethod) {
      publicData.paymentMethod = paymentMethod;
    }
    
    const listingData = {
      title: title.trim(),
      description: description || 'Описание задания',
      publicData,
    };

    // Add geolocation if available
    // LocationAutocompleteInputImpl saves location as { selectedPlace: { origin: LatLng } }
    if (location?.selectedPlace?.origin?.lat && location?.selectedPlace?.origin?.lng) {
      const { types } = require('sharetribe-flex-sdk');
      listingData.geolocation = new types.LatLng(
        parseFloat(location.selectedPlace.origin.lat),
        parseFloat(location.selectedPlace.origin.lng)
      );

      // Stored so listings can later be filtered by district in search. District
      // statistics do not read it — they derive the community from geolocation,
      // so a stale value here cannot skew the numbers.
      const community = resolveCommunity(
        location.selectedPlace.origin.lat,
        location.selectedPlace.origin.lng
      );
      if (community) {
        publicData.communityId = community.id;
      }

      console.log('📍 create-guest-listing: geolocation added', {
        lat: location.selectedPlace.origin.lat,
        lng: location.selectedPlace.origin.lng,
        communityId: community?.id || null,
      });
    } else {
      console.warn('⚠️ create-guest-listing: location data incomplete', {
        hasLocation: !!location,
        hasSelectedPlace: !!location?.selectedPlace,
        hasOrigin: !!location?.selectedPlace?.origin,
      });
    }

    // Add price if available
    if (price && parseFloat(price) > 0) {
      const { types } = require('sharetribe-flex-sdk');
      listingData.price = new types.Money(
        Math.round(parseFloat(price) * 100),
        'AED'
      );
    }

    console.log('📤 create-guest-listing: creating listing with SDK');

    // Create draft listing
    const createResponse = await sdk.ownListings.create(listingData);
    const listingId = createResponse.data.data.id;

    console.log('✅ create-guest-listing: listing created', listingId.uuid);

    // Upload images if provided
    if (images && images.length > 0) {
      console.log(`📸 create-guest-listing: uploading ${images.length} images`);
      
      for (let i = 0; i < images.length; i++) {
        const imageData = images[i];
        
        try {
          // Convert base64 to Buffer
          const base64Data = imageData.base64.includes(',') 
            ? imageData.base64.split(',')[1] 
            : imageData.base64;
          
          const buffer = Buffer.from(base64Data, 'base64');
          
          // Create File-like object for upload
          const file = {
            data: buffer,
            name: imageData.name || `image-${i}.jpg`,
            type: imageData.type || 'image/jpeg',
          };

          // Upload image
          const uploadResponse = await sdk.images.upload({ image: file });
          const imageId = uploadResponse.data.data.id;

          // Add image to listing
          await sdk.ownListings.update({
            id: listingId,
            imageId,
          });

          console.log(`✅ create-guest-listing: image ${i + 1} uploaded`);
        } catch (imgError) {
          console.error(`❌ create-guest-listing: failed to upload image ${i + 1}:`, imgError.message);
          // Continue with other images
        }
      }
    }

    // Publish the listing
    console.log('📤 create-guest-listing: publishing listing');
    const publishResponse = await sdk.ownListings.publishDraft({ id: listingId });
    
    const listing = publishResponse.data.data;
    const listingState = listing.attributes.state;

    console.log('✅ create-guest-listing: listing published with state:', listingState);

    // Telegram: executors when the task is live, admin when it went to moderation.
    // The notifier picks the right branch itself, so state isn't filtered here —
    // a task stuck in pendingApproval used to leave everyone in the dark.
    // Don't await - send notifications in background
    notifyExecutorsAboutListing(listingId.uuid)
      .then(result => {
        console.log('📱 Telegram: new listing notification result:', JSON.stringify(result));
      })
      .catch(err => {
        console.error('📱 Telegram notification error:', err.message);
      });

    res.status(200).json({
      success: true,
      listingId: listingId.uuid,
      state: listingState,
      listing,
    });

  } catch (error) {
    console.error('❌ create-guest-listing: error:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      data: error.data,
    });

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to create listing',
      details: error.data,
    });
  }
};

