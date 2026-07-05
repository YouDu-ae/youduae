const { getSdk } = require('../api-util/sdk');
const { notifyNewListingToCategory } = require('./telegram-bot');

// Category labels for notifications
const CATEGORY_LABELS = {
  'repairs_main': 'Ремонт и строительство',
  'Delivery': 'Курьерские услуги',
  'Help_home': 'Уборка и помощь в доме',
  'Cargo_transportation': 'Грузоперевозки',
  'Installation_mashines': 'Установка бытовой техники',
  'Beauty_health': 'Красота и здоровье',
  'Photo': 'Фото, видео, аудио',
  'Repair_digital': 'Ремонт цифровой техники',
  'Legal_assistance': 'Юридическая и бухгалтерская помощь',
  'training': 'Репетиторы и обучение',
  'Automotive_services': 'Автомобильные услуги',
  'Interior_designer': 'Дизайн интерьеров',
  'Tourist_services': 'Туристические услуги',
  'Web_design': 'Веб Дизайн/SEO',
};

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
    const publicData = {
      listingType: 'free-listing',
      transactionProcessAlias: 'assignment-flow-v3/release-1',
      unitType: 'item',
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
      console.log('📍 create-guest-listing: geolocation added', {
        lat: location.selectedPlace.origin.lat,
        lng: location.selectedPlace.origin.lng,
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

    // Send Telegram notifications to executors in this category
    if (category && listingState === 'published') {
      try {
        const rootUrl = process.env.REACT_APP_MARKETPLACE_ROOT_URL || 'https://youdu.ae';
        const listingUrl = `${rootUrl}/l/${listingId.uuid}`;
        const categoryName = CATEGORY_LABELS[category] || category;
        const priceText = price ? `${price} AED` : null;
        
        // Don't await - send notifications in background
        notifyNewListingToCategory({
          categoryId: category,
          categoryName,
          listingTitle: title,
          price: priceText,
          listingUrl,
          listingId: listingId.uuid,
        }).then(result => {
          console.log(`📱 Telegram: Notified ${result.sent}/${result.total} executors about new listing`);
        }).catch(err => {
          console.error('📱 Telegram notification error:', err.message);
        });
      } catch (notifyError) {
        console.error('⚠️ Failed to send category notifications:', notifyError.message);
      }
    }

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

