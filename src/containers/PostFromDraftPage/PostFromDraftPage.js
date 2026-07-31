import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { types as sdkTypes } from '../../util/sdkLoader';
import { getGuestListingData, clearGuestListingData } from '../../util/guestListingStorage';
import { Page, LayoutSingleColumn, IconSpinner } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './PostFromDraftPage.module.css';

const { Money } = sdkTypes;

const PostFromDraftPage = ({ onCreateListing, onPublishListing, onUpdateListing, onImageUpload }) => {
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState('Загрузка данных...');
  const history = useHistory();

  useEffect(() => {
    const createAndPublishListing = async () => {
      try {
        // 1. Получаем данные черновика из localStorage
        const draft = getGuestListingData();
        
        console.log('📥 Draft data retrieved:', draft);
        
        if (!draft || !draft.title) {
          throw new Error('Черновик пуст или неполный. Пожалуйста, заполните форму заново.');
        }

        const { title, description, category, deadline, paymentMethod, location, price, images } = draft;

        // 2. Создаем черновик листинга
        setProgress('Создаем задание...');
        console.log('📝 Creating listing:', { 
          title, 
          category,
          deadline,
          paymentMethod,
          price,
          location,
          hasImages: images?.length || 0,
        });

        // Prepare geolocation (optional for free-listing)
        const geolocationMaybe = {};
        // Check multiple possible locations for lat/lng (different API formats)
        const origin = location?.selectedPlace?.origin || location?.origin || location?.latlng;
        const lat = origin?.lat;
        const lng = origin?.lng;
        
        console.log('📍 Location data:', { location, origin, lat, lng });
        
        if (lat && lng) {
          try {
            geolocationMaybe.geolocation = new sdkTypes.LatLng(
              parseFloat(lat), 
              parseFloat(lng)
            );
            console.log('✅ Geolocation created:', geolocationMaybe.geolocation);
          } catch (e) {
            console.warn('⚠️ Failed to create geolocation, continuing without it:', e);
          }
        } else {
          console.warn('⚠️ No geolocation data found in location object');
        }

        // Prepare price (optional for free-listing)
        const priceMaybe = {};
        if (price && parseFloat(price) > 0) {
          try {
            // AED has no minor units (no cents), so we just use the value as-is
            priceMaybe.price = new Money(Math.round(parseFloat(price) * 100), 'AED');
            console.log('✅ Price created:', priceMaybe.price);
          } catch (e) {
            console.warn('⚠️ Failed to create price, continuing without it:', e);
          }
        }

        // Prepare location data for publicData
        const address = location?.selectedPlace?.address || location?.address || '';
        const locationPublicData = address ? { location: { address } } : {};

        const createParams = {
          title,
          description: description || 'Описание задания',
          publicData: {
            category,
            deadline: deadline || 'week',
            paymentMethod: paymentMethod || 'cash',
            listingType: 'free-listing',
            transactionProcessAlias: 'assignment-flow-v3/release-1',
            unitType: 'item',
            ...locationPublicData,
          },
          ...geolocationMaybe,
          ...priceMaybe,
        };

        console.log('📤 Sending create request with params:', createParams);

        const createResponse = await onCreateListing(createParams);
        const listingId = createResponse.data.data.id;
        
        console.log('✅ Draft listing created:', listingId.uuid);

        // 3. Загружаем изображения (если есть)
        if (images && images.length > 0) {
          setProgress(`Загружаем изображения (0/${images.length})...`);
          console.log(`📸 Uploading ${images.length} images...`);
          
          for (let i = 0; i < images.length; i++) {
            const imageData = images[i];
            setProgress(`Загружаем изображения (${i + 1}/${images.length})...`);
            
            try {
              console.log(`📸 Processing image ${i + 1}:`, {
                hasBase64: !!imageData.base64,
                name: imageData.name,
                type: imageData.type,
                size: imageData.size,
              });

              // Convert base64 to Blob
              const base64String = imageData.base64 || '';
              if (!base64String) {
                console.warn(`⚠️ Skipping image ${i + 1}: no base64 data`);
                continue;
              }

              const base64Data = base64String.includes(',') 
                ? base64String.split(',')[1] 
                : base64String;
              
              // Validate base64
              if (!base64Data || base64Data.length < 100) {
                console.warn(`⚠️ Skipping image ${i + 1}: invalid base64 data`);
                continue;
              }

              const byteCharacters = atob(base64Data);
              const byteNumbers = new Array(byteCharacters.length);
              for (let j = 0; j < byteCharacters.length; j++) {
                byteNumbers[j] = byteCharacters.charCodeAt(j);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const imageType = imageData.type || 'image/jpeg';
              const blob = new Blob([byteArray], { type: imageType });
              const file = new File([blob], imageData.name || `image-${i}.jpg`, { 
                type: imageType 
              });

              console.log(`📤 Uploading image ${i + 1}:`, {
                size: file.size,
                type: file.type,
                name: file.name,
              });

              // Upload image
              const uploadResponse = await onImageUpload({ image: file });
              const imageId = uploadResponse.data.data.id;

              console.log(`✅ Image ${i + 1} uploaded, adding to listing...`);

              // Add image to listing
              await onUpdateListing({
                id: listingId,
                imageId,
                published: false,
              });
              
              console.log(`✅ Image ${i + 1} added to listing:`, imageId.uuid);
            } catch (imageError) {
              console.error(`❌ Error uploading image ${i + 1}:`, imageError);
              console.error('Image error details:', {
                message: imageError.message,
                status: imageError.status,
                statusText: imageError.statusText,
                data: imageError.data,
                errors: imageError.data?.errors,
              });
              
              // Log detailed error messages
              if (imageError.data?.errors && Array.isArray(imageError.data.errors)) {
                imageError.data.errors.forEach((err, idx) => {
                  console.error(`Error ${idx + 1}:`, {
                    status: err.status,
                    code: err.code,
                    title: err.title,
                    detail: err.detail,
                    meta: err.meta,
                  });
                });
              }
              
              // Continue with other images even if one fails
            }
          }
          
          console.log('✅ All images uploaded');
        }

        // 4. Публикуем листинг (переводим из draft в published/pendingApproval)
        setProgress('Публикуем задание...');
        const publishResponse = await onPublishListing({ id: listingId });
        
        const listing = publishResponse.data.data;
        const listingState = listing.attributes.state;
        
        console.log('✅ Listing published with state:', listingState);

        // 5. Очищаем черновик
        clearGuestListingData();
        
        // 6. Редирект в зависимости от состояния листинга
        if (listingState === 'pendingApproval') {
          // Листинг требует модерации - редиректим на страницу успеха
          console.log('⏳ Listing pending approval - redirecting to ListingCreatedPage');
          setProgress('Задание успешно создано! Перенаправление...');
          
          setTimeout(() => {
            history.replace('/listing-created');
          }, 1500);
        } else if (listingState === 'published') {
          // Листинг опубликован - редиректим на страницу листинга
          const slug = (listing.attributes.title || title || 'listing')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
          
          console.log('✅ Listing is published - redirecting to listing page:', `/l/${slug}/${listingId.uuid}`);
          history.replace(`/l/${slug}/${listingId.uuid}`);
        } else {
          // Неизвестное состояние - редиректим на страницу успеха
          console.log('⚠️ Unexpected listing state:', listingState, '- redirecting to ListingCreatedPage');
          history.replace('/listing-created');
        }
        
      } catch (e) {
        console.error('❌ Error creating listing:', e);
        console.error('Error details:', {
          message: e.message,
          status: e.status,
          statusText: e.statusText,
          data: e.data,
          response: e.response?.data,
        });
        
        // Extract more detailed error message
        let errorMessage = 'Не удалось создать задание';
        
        if (e.data?.errors && e.data.errors.length > 0) {
          const firstError = e.data.errors[0];
          errorMessage = `${errorMessage}: ${firstError.title || firstError.detail || firstError.code || 'Unknown error'}`;
        } else if (e.message) {
          errorMessage = `${errorMessage}: ${e.message}`;
        }
        
        setError(errorMessage);
        
        // Clear intent on error
        if (typeof window !== 'undefined') {
          localStorage.removeItem('pendingListingIntent');
        }
      }
    };

    createAndPublishListing();
  }, [history, onCreateListing, onPublishListing, onUpdateListing, onImageUpload]);

  const title = 'Создание задания';

  if (error) {
    return (
      <Page title={title} scrollingDisabled={false}>
        <LayoutSingleColumn
          topbar={<TopbarContainer />}
          footer={<FooterContainer />}
        >
          <div className={css.root}>
            <div className={css.error}>
              <h1>Ошибка</h1>
              <p>{error}</p>
              <button 
                className={css.retryButton}
                onClick={() => history.push('/l/new-draft/draft/new/details')}
              >
                Создать задание вручную
              </button>
            </div>
          </div>
        </LayoutSingleColumn>
      </Page>
    );
  }

  return (
    <Page title={title} scrollingDisabled={false}>
      <LayoutSingleColumn
        topbar={<TopbarContainer />}
        footer={<FooterContainer />}
      >
        <div className={css.root}>
          <div className={css.content}>
            <IconSpinner className={css.spinner} />
            <h2 className={css.title}>{progress}</h2>
            <p className={css.description}>
              Пожалуйста, не закрывайте страницу...
            </p>
          </div>
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default PostFromDraftPage;

