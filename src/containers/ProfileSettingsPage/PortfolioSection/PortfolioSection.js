import React, { useState } from 'react';
import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import { H4, SecondaryButton, ResponsiveImage, IconClose } from '../../../components';

import css from './PortfolioSection.module.css';

const PortfolioSection = props => {
  const { currentUser, onUpdateProfile, updateInProgress } = props;
  const intl = useIntl();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadError, setUploadError] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const publicData = currentUser?.attributes?.profile?.publicData || {};
  const portfolioItems = publicData.portfolioItems || [];
  const userImages = currentUser?.images || [];

  const MAX_IMAGES = 6;
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

  const handleFileSelect = event => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        setUploadError(intl.formatMessage({ id: 'PortfolioSection.invalidFileType' }));
        return false;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setUploadError(
          intl.formatMessage(
            { id: 'PortfolioSection.fileTooLarge' },
            { maxSize: '10MB' }
          )
        );
        return false;
      }
      return true;
    });

    if (selectedFiles.length + validFiles.length > MAX_IMAGES) {
      setUploadError(
        intl.formatMessage(
          { id: 'PortfolioSection.tooManyImages' },
          { maxImages: MAX_IMAGES }
        )
      );
      return;
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
    setUploadError(null);
  };

  const handleRemoveFile = index => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemovePortfolioItem = itemId => {
    const updatedPortfolio = portfolioItems.filter(item => item.id !== itemId);
    onUpdateProfile({
      publicData: {
        ...publicData,
        portfolioItems: updatedPortfolio,
      },
    });
  };

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) {
      setUploadError(intl.formatMessage({ id: 'PortfolioSection.noImages' }));
      return;
    }

    // Note: This is a simplified version. Full implementation would:
    // 1. Upload images to Sharetribe using SDK
    // 2. Get image UUIDs
    // 3. Create portfolio item with image references
    // 4. Update user publicData

    // For MVP, we'll store file data URLs (not recommended for production)
    const promises = selectedFiles.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    try {
      const imageDataUrls = await Promise.all(promises);
      
      const newItem = {
        id: `portfolio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        images: imageDataUrls, // In production, these would be Sharetribe image UUIDs
        title: title || intl.formatMessage({ id: 'PortfolioSection.untitledWork' }),
        description: description || '',
        category: null,
        completedAt: new Date().toISOString(),
      };

      const updatedPortfolio = [...portfolioItems, newItem];

      await onUpdateProfile({
        publicData: {
          ...publicData,
          portfolioItems: updatedPortfolio,
        },
      });

      // Reset form
      setSelectedFiles([]);
      setTitle('');
      setDescription('');
      setUploadError(null);
    } catch (error) {
      console.error('Failed to add portfolio item:', error);
      setUploadError(intl.formatMessage({ id: 'PortfolioSection.uploadFailed' }));
    }
  };

  return (
    <div className={css.root}>
      <H4 as="h2" className={css.sectionTitle}>
        <FormattedMessage id="PortfolioSection.title" />
      </H4>
      <p className={css.sectionDescription}>
        <FormattedMessage id="PortfolioSection.description" />
      </p>

      {/* Existing portfolio items */}
      {portfolioItems.length > 0 && (
        <div className={css.existingItems}>
          <h3 className={css.subsectionTitle}>
            <FormattedMessage id="PortfolioSection.yourWorks" values={{ count: portfolioItems.length }} />
          </h3>
          <div className={css.portfolioGrid}>
            {portfolioItems.map(item => (
              <div key={item.id} className={css.portfolioCard}>
                {item.images && item.images[0] && (
                  <div className={css.cardImage}>
                    <img src={item.images[0]} alt={item.title} />
                    {item.images.length > 1 && (
                      <span className={css.imageCount}>+{item.images.length - 1}</span>
                    )}
                  </div>
                )}
                <div className={css.cardContent}>
                  <h4 className={css.cardTitle}>{item.title}</h4>
                  {item.description && <p className={css.cardDescription}>{item.description}</p>}
                  <p className={css.cardDate}>
                    {new Date(item.completedAt).toLocaleDateString(intl.locale)}
                  </p>
                </div>
                <button
                  type="button"
                  className={css.removeButton}
                  onClick={() => handleRemovePortfolioItem(item.id)}
                  disabled={updateInProgress}
                >
                  <IconClose rootClassName={css.removeIcon} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add new work form */}
      <div className={css.addNewSection}>
        <h3 className={css.subsectionTitle}>
          <FormattedMessage id="PortfolioSection.addNew" />
        </h3>

        <div className={css.uploadArea}>
          <input
            type="file"
            id="portfolio-upload"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className={css.fileInput}
            disabled={selectedFiles.length >= MAX_IMAGES || updateInProgress}
          />
          <label htmlFor="portfolio-upload" className={css.uploadLabel}>
            <span className={css.uploadIcon}>📷</span>
            <FormattedMessage id="PortfolioSection.selectPhotos" />
            <span className={css.uploadHint}>
              <FormattedMessage
                id="PortfolioSection.uploadHint"
                values={{ max: MAX_IMAGES }}
              />
            </span>
          </label>
        </div>

        {selectedFiles.length > 0 && (
          <div className={css.previewGrid}>
            {selectedFiles.map((file, index) => (
              <div key={index} className={css.previewItem}>
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Preview ${index + 1}`}
                  className={css.previewImage}
                />
                <button
                  type="button"
                  className={css.removePreviewButton}
                  onClick={() => handleRemoveFile(index)}
                >
                  <IconClose rootClassName={css.removePreviewIcon} />
                </button>
              </div>
            ))}
          </div>
        )}

        {selectedFiles.length > 0 && (
          <div className={css.formFields}>
            <div className={css.formField}>
              <label className={css.label}>
                <FormattedMessage id="PortfolioSection.titleLabel" />
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={intl.formatMessage({ id: 'PortfolioSection.titlePlaceholder' })}
                className={css.input}
                maxLength={100}
              />
            </div>

            <div className={css.formField}>
              <label className={css.label}>
                <FormattedMessage id="PortfolioSection.descriptionLabel" />
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={intl.formatMessage({ id: 'PortfolioSection.descriptionPlaceholder' })}
                className={css.textarea}
                maxLength={500}
                rows={3}
              />
            </div>

            <SecondaryButton
              type="button"
              onClick={handleSubmit}
              disabled={updateInProgress}
              inProgress={updateInProgress}
            >
              <FormattedMessage id="PortfolioSection.addButton" />
            </SecondaryButton>
          </div>
        )}

        {uploadError && <div className={css.error}>{uploadError}</div>}
      </div>
    </div>
  );
};

export default PortfolioSection;

