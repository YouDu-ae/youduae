import React, { useState, useEffect } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import {
  Page,
  LayoutSingleColumn,
  PrimaryButton,
  SecondaryButton,
  CategorySpecialistsCard,
  VoiceIntake,
} from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import { useConfiguration } from '../../context/configurationContext';
import {
  saveGuestListingData,
  getGuestListingData,
  saveImagesToStorage,
} from '../../util/guestListingStorage';
import LocationAutocompleteInputImpl from '../../components/LocationAutocompleteInput/LocationAutocompleteInputImpl';
import { parse } from '../../util/urlHelpers';

import css from './GuestListingWizard.module.css';

const STEPS = {
  TITLE: 'title',
  DETAILS: 'details',
  LOCATION: 'location',
  PRICING: 'pricing',
  PHOTOS: 'photos',
};

const STEP_ORDER = [STEPS.TITLE, STEPS.DETAILS, STEPS.LOCATION, STEPS.PRICING, STEPS.PHOTOS];

// Photos travel to the server as base64 inside a single JSON request, so the
// count has to stay within the server's body limit even after compression.
const MAX_PHOTOS = 8;

// Столько символов названия влезает в строку статуса, не переводя её на вторую строку
const MAX_TITLE_IN_STATUS = 30;
const GuestListingWizard = () => {
  const history = useHistory();
  const location = useLocation();
  const config = useConfiguration();
  const intl = useIntl();
  const t = (id, values) => intl.formatMessage({ id: `GuestListingWizard.${id}` }, values);
  
  // Мастер один для всех: гость в конце регистрируется, авторизованный публикует сразу.
  // Раньше зарегистрированных уводило в шаблонный мастер Sharetribe, где не было
  // фотографий и нельзя было пропустить цену.
  const isAuthenticated = !!useSelector(state => state.user.currentUser)?.id;

  // Получаем категории из конфигурации Sharetribe
  const categoryConfiguration = config?.categoryConfiguration || {};
  const categories = categoryConfiguration.categories || [];
  
  const [currentStep, setCurrentStep] = useState(STEPS.TITLE);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    subcategory: '',
    deadline: '',
    paymentMethod: '',
    location: null,
    price: '',
    images: [],
  });
  const [errors, setErrors] = useState({});
  const [availableSubcategories, setAvailableSubcategories] = useState([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState(null);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Загружаем сохраненные данные при монтировании
  useEffect(() => {
    let cancelled = false;

    const applySavedData = savedData => {
      // Get title from URL query parameter
      const queryParams = parse(location.search);
      const titleFromUrl = queryParams.title || '';

      if (savedData) {
        setFormData({
          title: titleFromUrl || savedData.title || '', // URL title has priority
          description: savedData.description || '',
          category: savedData.category || '',
          subcategory: savedData.subcategory || '',
          deadline: savedData.deadline || '',
          paymentMethod: savedData.paymentMethod || '',
          location: savedData.location || null,
          price: savedData.price || '',
          images: savedData.images || [],
          voiceSessionId: savedData.voiceSessionId || '',
        });

        // Если есть сохраненная категория, загружаем подкатегории
        if (savedData.category) {
          const selectedCategory = categories.find(cat => cat.id === savedData.category);
          if (selectedCategory?.subcategories) {
            setAvailableSubcategories(selectedCategory.subcategories);
          }
        }
      } else if (titleFromUrl) {
        // If no saved data but there is title from URL
        setFormData(prev => ({
          ...prev,
          title: titleFromUrl,
        }));
      }

      setDraftLoaded(true);
    };

    getGuestListingData()
      .then(savedData => {
        if (!cancelled) {
          applySavedData(savedData);
        }
      })
      .catch(error => {
        console.error('Не удалось прочитать черновик задания:', error);
        if (!cancelled) {
          applySavedData(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [categories, location.search]);

  // Сохраняем данные при каждом изменении
  useEffect(() => {
    // До окончания чтения писать нельзя: пустая начальная форма затрёт черновик
    if (!draftLoaded) {
      return;
    }

    saveGuestListingData(formData)
      .then(() => setDraftSaveError(null))
      .catch(error => {
        console.error('Не удалось сохранить черновик задания:', error);
        setDraftSaveError(t('draftSaveError'));
      });
  }, [draftLoaded, formData]);

  const getCurrentStepIndex = () => STEP_ORDER.indexOf(currentStep);

  const isFirstStep = () => getCurrentStepIndex() === 0;
  const isLastStep = () => getCurrentStepIndex() === STEP_ORDER.length - 1;

  const handleNext = () => {
    if (validateCurrentStep()) {
      const nextIndex = getCurrentStepIndex() + 1;
      if (nextIndex < STEP_ORDER.length) {
        setCurrentStep(STEP_ORDER[nextIndex]);
      }
    }
  };

  const handlePrevious = () => {
    const prevIndex = getCurrentStepIndex() - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEP_ORDER[prevIndex]);
    }
  };

  const validateCurrentStep = () => {
    const newErrors = {};

    switch (currentStep) {
      case STEPS.TITLE:
        if (!formData.title || formData.title.trim().length < 5) {
          newErrors.title = t('titleTooShort');
        } else if (formData.title.trim().length > 100) {
          newErrors.title = t('titleTooLong');
        }
        if (!formData.description || formData.description.trim().length < 20) {
          newErrors.description = t('descriptionTooShort');
        } else if (formData.description.trim().length > 5000) {
          newErrors.description = t('descriptionTooLong');
        }
        break;

      case STEPS.DETAILS:
        if (!formData.category) {
          newErrors.category = t('categoryRequired');
        }
        // subcategory is optional
        if (!formData.deadline) {
          newErrors.deadline = t('deadlineRequired');
        }
        // paymentMethod is now optional
        break;

      case STEPS.LOCATION:
        if (!formData.location || !formData.location.selectedPlace || !formData.location.selectedPlace.address) {
          newErrors.location = t('locationRequired');
        }
        break;

      case STEPS.PRICING:
        const priceNum = parseFloat(formData.price);
        if (!formData.price || isNaN(priceNum) || priceNum <= 0) {
          newErrors.price = t('priceInvalid');
        } else if (priceNum > 1000000) {
          newErrors.price = t('priceTooHigh');
        }
        break;

      case STEPS.PHOTOS:
        // Photos are optional, but we encourage adding them
        if (!formData.images || formData.images.length === 0) {
          // Don't block, just warn
          console.warn('⚠️ No images provided, but continuing...');
        }
        break;

      default:
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Помощник заполняет поля, но фотографии не трогает: их голосом не добавить,
  // а уже выбранные снимки терять нельзя. Автосохранение запишет черновик само.
  const applyVoiceDraft = (draft, { sessionId }) => {
    setFormData(prev => ({ ...prev, ...draft, images: prev.images, voiceSessionId: sessionId }));
    const selectedCategory = categories.find(cat => cat.id === draft.category);
    setAvailableSubcategories(selectedCategory?.subcategories || []);
    setErrors({});
  };

  const handleFieldChange = (field, value) => {
    setFormData(prev => {
      const updatedData = {
        ...prev,
        [field]: value,
      };
      
      // Если изменилась категория, загружаем подкатегории и сбрасываем subcategory
      if (field === 'category') {
        const selectedCategory = categories.find(cat => cat.id === value);
        const subcats = selectedCategory?.subcategories || [];
        setAvailableSubcategories(subcats);
        updatedData.subcategory = ''; // сбрасываем выбранную подкатегорию
      }
      
      return updatedData;
    });
    
    // Очищаем ошибку для этого поля
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleImagesChange = async (files) => {
    if (!files || files.length === 0) return;

    const currentImages = formData.images || [];
    const freeSlots = MAX_PHOTOS - currentImages.length;

    if (freeSlots <= 0) {
      setErrors(prev => ({ ...prev, images: t('photosLimit', { max: MAX_PHOTOS }) }));
      return;
    }

    const accepted = files.slice(0, freeSlots);

    setIsUploadingImages(true);
    try {
      const imagesData = await saveImagesToStorage(accepted);
      // Добавляем новые фото к существующим
      const updatedImages = [...currentImages, ...imagesData];
      handleFieldChange('images', updatedImages);

      if (files.length > accepted.length) {
        setErrors(prev => ({
          ...prev,
          images: t('photosPartiallyAdded', {
            added: accepted.length,
            total: files.length,
            max: MAX_PHOTOS,
          }),
        }));
      }
    } catch (error) {
      console.error('❌ Error uploading images:', error);
      setErrors(prev => ({ ...prev, images: t('imageUploadError') }));
    } finally {
      setIsUploadingImages(false);
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    const updatedImages = formData.images.filter((_, index) => index !== indexToRemove);
    handleFieldChange('images', updatedImages);
  };

  const handleFinish = async () => {
    if (validateCurrentStep()) {
      // Дожидаемся записи: /post-from-draft читает черновик сразу на монтировании,
      // и уйти туда раньше сохранения — значит опубликовать задание без фотографий
      try {
        await saveGuestListingData(formData);
        setDraftSaveError(null);
      } catch (error) {
        console.error('Не удалось сохранить черновик перед публикацией:', error);
        setDraftSaveError(t('finishSaveError'));
        return;
      }

      if (isAuthenticated) {
        history.push('/post-from-draft');
        return;
      }

      // Гостя сначала на регистрацию заказчиком, оттуда он вернётся к публикации
      history.push({
        pathname: '/signup/provider',
        state: { from: '/post-from-draft' }
      });
    }
  };

  // Название показываем укороченным: иначе строка статуса растёт в высоту прямо
  // во время набора, форма уезжает вниз, и мобильный браузер догоняет курсор.
  const statusTitle = () => {
    const title = formData.title.trim();
    if (!title) {
      return '..........';
    }
    return title.length > MAX_TITLE_IN_STATUS
      ? `${title.slice(0, MAX_TITLE_IN_STATUS).trimEnd()}…`
      : title;
  };

  const getCompletionPercentage = () => {
    let filledFields = 0;
    let totalFields = 8; // title, description, category, deadline, location, price, images (7 + subcategory/paymentMethod optional)
    
    if (formData.title && formData.title.trim()) filledFields++;
    if (formData.description && formData.description.trim()) filledFields++;
    if (formData.category) filledFields++;
    if (formData.subcategory) filledFields++; // optional
    if (formData.deadline) filledFields++;
    if (formData.paymentMethod) filledFields++; // optional
    if (formData.location && formData.location.address) filledFields++;
    if (formData.price) filledFields++;
    if (formData.images && formData.images.length > 0) filledFields++;
    
    return Math.round((filledFields / totalFields) * 100);
  };

  const getStepLabel = (step) => {
    switch (step) {
      case STEPS.TITLE:
        return t('titleStepTitle');
      case STEPS.DETAILS:
        return t('detailsStepTitle');
      case STEPS.LOCATION:
        return t('stepLocation');
      case STEPS.PRICING:
        return t('pricingStepTitle');
      case STEPS.PHOTOS:
        return t('photosStepTitle');
      default:
        return '';
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case STEPS.TITLE:
        return (
          <div className={css.stepContent}>
            <div className={css.stepHeader}>
              <h2 className={css.stepTitle}>{t('titleStepTitle')}</h2>
            </div>

            {/* Голос только для вошедших: у гостя не к чему привязать дневной
                лимит, а каждая сессия оплачивается. Открыт ли пилот этому
                пользователю, VoiceIntake спрашивает у сервера сам. */}
            {isAuthenticated ? <VoiceIntake onDraft={applyVoiceDraft} /> : null}

            <div className={css.field}>
              <label className={css.label}>
                {t('titleLabel')}
              </label>
              <input
                type="text"
                className={css.input}
                value={formData.title || ''}
                onChange={(e) => handleFieldChange('title', e.target.value)}
                placeholder={t('titlePlaceholder')}
              />
              {errors.title && <div className={css.error}>{errors.title}</div>}
            </div>

            <div className={css.field}>
              <label className={css.label}>
                {t('descriptionLabel')}
              </label>
              <textarea
                className={css.textarea}
                value={formData.description || ''}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                placeholder={t('descriptionPlaceholder')}
                rows={2}
              />
              {errors.description && <div className={css.error}>{errors.description}</div>}
            </div>

            <div className={css.actions}>
              {!isFirstStep() && (
                <SecondaryButton onClick={handlePrevious}>
                  {t('back')}
                </SecondaryButton>
              )}
              <PrimaryButton onClick={handleNext}>
                {t('next')}
              </PrimaryButton>
            </div>
          </div>
        );

      case STEPS.DETAILS:
        return (
          <div className={css.stepContent}>
            <div className={css.stepHeader}>
              <h2 className={css.stepTitle}>{t('detailsStepTitle')}</h2>
            </div>

            <div className={css.field}>
              <label className={css.label}>
                {t('categoryLabel')}
              </label>
              <select
                className={css.select}
                value={formData.category || ''}
                onChange={(e) => handleFieldChange('category', e.target.value)}
              >
                <option value="">{t('categoryPlaceholder')}</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {errors.category && <div className={css.error}>{errors.category}</div>}
            </div>

            {availableSubcategories.length > 0 && (
              <div className={css.field}>
                <label className={css.label}>
                  {t('subcategoryLabel')}
                </label>
                <select
                  className={css.select}
                  value={formData.subcategory || ''}
                  onChange={(e) => handleFieldChange('subcategory', e.target.value)}
                >
                  <option value="">{t('subcategoryPlaceholder')}</option>
                  {availableSubcategories.map(subcat => (
                    <option key={subcat.id} value={subcat.id}>
                      {subcat.name}
                    </option>
                  ))}
                </select>
                {errors.subcategory && <div className={css.error}>{errors.subcategory}</div>}
              </div>
            )}

            <div className={css.field}>
              <label className={css.label}>
                {t('deadlineLabel')}
              </label>
              <select
                className={css.select}
                value={formData.deadline || ''}
                onChange={(e) => handleFieldChange('deadline', e.target.value)}
              >
                <option value="">{t('deadlinePlaceholder')}</option>
                {['today', 'tomorrow', 'week', 'long-term'].map(option => (
                  <option key={option} value={option}>
                    {intl.formatMessage({ id: `CustomExtendedDataField.deadline.${option}` })}
                  </option>
                ))}
              </select>
              {errors.deadline && <div className={css.error}>{errors.deadline}</div>}
            </div>

            <div className={css.field}>
              <label className={css.label}>
                {t('paymentMethodLabel')}
              </label>
              <select
                className={css.select}
                value={formData.paymentMethod || ''}
                onChange={(e) => handleFieldChange('paymentMethod', e.target.value)}
              >
                <option value="">{t('paymentMethodPlaceholder')}</option>
                {['cash', 'bank-transfer'].map(option => (
                  <option key={option} value={option}>
                    {intl.formatMessage({ id: `CustomExtendedDataField.paymentMethod.${option}` })}
                  </option>
                ))}
              </select>
              {errors.paymentMethod && <div className={css.error}>{errors.paymentMethod}</div>}
              <div className={css.paymentWarning}>
                <strong>{t('paymentWarningTitle')}</strong><br />
                {t('paymentWarningText')}
              </div>
            </div>

            <div className={css.actions}>
              {!isFirstStep() && (
                <SecondaryButton onClick={handlePrevious}>
                  {t('back')}
                </SecondaryButton>
              )}
              <PrimaryButton onClick={handleNext}>
                {t('next')}
              </PrimaryButton>
            </div>
          </div>
        );

      case STEPS.LOCATION:
        return (
          <div className={css.stepContent}>
            <div className={css.stepHeader}>
              <h2 className={css.stepTitle}>{t('locationStepTitle')}</h2>
            </div>
            
            <div className={css.field}>
              <label className={css.label}>
                {t('locationLabel')}
              </label>
              <LocationAutocompleteInputImpl
                rootClassName={css.locationAddress}
                inputClassName={css.locationAutocompleteInput}
                iconClassName={css.locationAutocompleteInputIcon}
                predictionsClassName={css.predictionsRoot}
                validClassName={css.validLocation}
                useDarkText={true}
                placeholder={t('locationPlaceholder')}
                input={{
                  name: 'location',
                  value: formData.location || { search: '', predictions: [], selectedPlace: null },
                  onChange: (value) => {
                    // Сохраняем полный объект location
                    handleFieldChange('location', value);
                  },
                  onFocus: () => {},
                  onBlur: () => {},
                }}
                meta={{
                  valid: !errors.location,
                  touched: !!formData.location,
                }}
                config={config}
              />
              {errors.location && <div className={css.error}>{errors.location}</div>}
            </div>

            <div className={css.actions}>
              {!isFirstStep() && (
                <SecondaryButton onClick={handlePrevious}>
                  {t('back')}
                </SecondaryButton>
              )}
              <PrimaryButton onClick={handleNext}>
                {t('next')}
              </PrimaryButton>
            </div>
          </div>
        );

      case STEPS.PRICING:
        return (
          <div className={css.stepContent}>
            <div className={css.stepHeader}>
              <h2 className={css.stepTitle}>{t('pricingStepTitle')}</h2>
            </div>
            
            <div className={css.field}>
              <label className={css.label}>
                {t('priceLabel')}
              </label>
              <input
                type="number"
                className={css.input}
                value={formData.price || ''}
                onChange={(e) => handleFieldChange('price', e.target.value)}
                placeholder="1000"
                min="0"
                step="10"
              />
              {errors.price && <div className={css.error}>{errors.price}</div>}
            </div>

            <div className={css.infoBox}>
              💡 {t('pricingInfo')}
            </div>

            <div className={css.actions}>
              {!isFirstStep() && (
                <SecondaryButton onClick={handlePrevious}>
                  {t('back')}
                </SecondaryButton>
              )}
              <PrimaryButton onClick={handleNext}>
                {t('next')}
              </PrimaryButton>
            </div>
          </div>
        );

      case STEPS.PHOTOS:
        return (
          <div className={css.stepContent}>
            <div className={css.stepHeader}>
              <h2 className={css.stepTitle}>{t('photosStepTitle')}</h2>
            </div>
            
            <div className={css.field}>
              <label className={css.label}>
                {formData.images && formData.images.length > 0
                  ? t('photosLabelWithCount', { count: formData.images.length, max: MAX_PHOTOS })
                  : t('photosLabelEmpty', { max: MAX_PHOTOS })}
              </label>
              <div className={css.fileInputWrapper}>
                <input
                  type="file"
                  id="photo-upload"
                  className={css.fileInputHidden}
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    handleImagesChange(Array.from(e.target.files));
                    // Allow re-selecting the same file after a removal.
                    e.target.value = '';
                  }}
                  disabled={isUploadingImages || (formData.images || []).length >= MAX_PHOTOS}
                />
                <label
                  htmlFor="photo-upload"
                  className={`${css.fileInputLabel} ${
                    isUploadingImages || (formData.images || []).length >= MAX_PHOTOS
                      ? css.fileInputLabelDisabled
                      : ''
                  }`}
                >
                  <span className={css.uploadIcon}>
                    {isUploadingImages ? '⏳' : '📷'}
                  </span>
                  <span>
                    {isUploadingImages
                      ? t('photosProcessing')
                      : (formData.images || []).length >= MAX_PHOTOS
                      ? t('photosMaxReached', { max: MAX_PHOTOS })
                      : t('choosePhotos')}
                  </span>
                </label>
              </div>
              {errors.images && <div className={css.error}>{errors.images}</div>}
              {isUploadingImages && (
                <div className={css.uploadingMessage}>
                  {t('imagesProcessingWait')}
                </div>
              )}
            </div>

            {formData.images && formData.images.length > 0 && (
              <div className={css.imagePreviewGrid}>
                {formData.images.map((image, index) => {
                  // Безопасно получаем URL для изображения
                  let imageUrl = '';
                  if (image.base64) {
                    imageUrl = image.base64;
                  } else if (image instanceof File || image instanceof Blob) {
                    // Если это новый File/Blob объект
                    imageUrl = URL.createObjectURL(image);
                  }
                  
                  if (!imageUrl) return null; // Пропускаем, если нет URL
                  
                  return (
                    <div key={index} className={css.imagePreviewItem}>
                      <img 
                        src={imageUrl} 
                        alt={t('photoAlt', { index: index + 1 })}
                        className={css.previewImage}
                      />
                      <button
                        type="button"
                        className={css.removeImageButton}
                        onClick={() => handleRemoveImage(index)}
                        title={t('removePhoto')}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className={css.infoBox}>
              📷 {t('photosInfo')}
            </div>

            <div className={css.actions}>
              {!isFirstStep() && (
                <SecondaryButton onClick={handlePrevious}>
                  {t('back')}
                </SecondaryButton>
              )}
              <PrimaryButton 
                className={css.finishButton}
                onClick={handleFinish}
              >
                {isAuthenticated ? t('publish') : t('signupAndPublish')}
              </PrimaryButton>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const progressPercent = ((getCurrentStepIndex() + 1) / STEP_ORDER.length) * 100;

  return (
    <Page
      title={t('metaTitle')}
      description={t('metaDescription')}
      scrollingDisabled={false}
    >
      <TopbarContainer />
      <LayoutSingleColumn>
        <div className={css.root}>
          {!isAuthenticated && (
            <div className={css.guestBanner}>
              <div className={css.bannerContent}>
                <div className={css.bannerTitle}>
                  <FormattedMessage id="GuestListingWizard.bannerTitle" />
                </div>
                <div className={css.bannerText}>
                  <FormattedMessage id="GuestListingWizard.bannerText" />
                </div>
              </div>
            </div>
          )}

          {/* Строка с названием задания и процентом */}
          <div className={css.completionStatus}>
            {t('completionStatus', { title: statusTitle(), percent: getCompletionPercentage() })}
          </div>

          {draftSaveError && <div className={css.draftSaveError}>{draftSaveError}</div>}

          {/* Детальный прогресс бар */}
          <div className={css.progressContainer}>
            <div className={css.stepsIndicator}>
              {STEP_ORDER.map((step, index) => {
                const isCurrent = index === getCurrentStepIndex();
                const isCompleted = index < getCurrentStepIndex();
                const stepNames = {
                  [STEPS.TITLE]: t('stepTitle'),
                  [STEPS.DETAILS]: t('stepDetails'),
                  [STEPS.LOCATION]: t('stepLocation'),
                  [STEPS.PRICING]: t('pricingStepTitle'),
                  [STEPS.PHOTOS]: t('stepPhotos'),
                };
                
                return (
                  <div 
                    key={step} 
                    className={`${css.stepIndicator} ${isCurrent ? css.current : ''} ${isCompleted ? css.completed : ''}`}
                  >
                    <div className={css.stepNumber}>
                      {isCompleted ? '✓' : index + 1}
                    </div>
                    <div className={css.stepLabel}>{stepNames[step]}</div>
                  </div>
                );
              })}
            </div>
            <div className={css.progressBar}>
              <div className={css.progressFill} style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          {/* Пока категория не выбрана, показываем число специалистов площадки */}
          <CategorySpecialistsCard
            categoryId={formData.category}
            categoryName={categories.find(cat => cat.id === formData.category)?.name}
            location={formData.location}
          />

          {/* Содержимое шага */}
          {renderStepContent()}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default GuestListingWizard;

