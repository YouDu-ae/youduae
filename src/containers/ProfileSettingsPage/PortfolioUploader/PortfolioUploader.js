import React, { useRef } from 'react';
import { FormattedMessage } from '../../../util/reactIntl';
import { IconSpinner, Button } from '../../../components';

import css from './PortfolioUploader.module.css';

const MAX_PORTFOLIO_IMAGES = 5;
const ACCEPT_IMAGES = 'image/*';

const PortfolioUploader = props => {
  const {
    portfolioImages = [],
    existingPortfolio = [],
    onUpload,
    onRemove,
    onRemoveExisting,
    uploadInProgress,
    uploadError,
    onSave,
    saveInProgress,
    saveDisabled,
  } = props;

  const fileInputRef = useRef(null);

  const allImages = [
    ...existingPortfolio.map(img => ({ ...img, isExisting: true })),
    ...portfolioImages.map(img => ({ ...img, isExisting: false })),
  ];
  
  const canAddMore = allImages.length < MAX_PORTFOLIO_IMAGES;
  const remainingSlots = MAX_PORTFOLIO_IMAGES - allImages.length;

  const handleFileChange = e => {
    const files = Array.from(e.target.files);
    const filesToUpload = files.slice(0, remainingSlots);
    
    filesToUpload.forEach(file => {
      if (file && onUpload) {
        onUpload(file);
      }
    });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = (imageId, isExisting) => {
    if (isExisting && onRemoveExisting) {
      onRemoveExisting(imageId);
    } else if (onRemove) {
      onRemove(imageId);
    }
  };

  return (
    <div className={css.root}>
      <h4 className={css.title}>
        <FormattedMessage id="ProfileSettingsForm.portfolioTitle" />
      </h4>
      <p className={css.description}>
        <FormattedMessage 
          id="ProfileSettingsForm.portfolioDescription" 
          values={{ max: MAX_PORTFOLIO_IMAGES }}
        />
      </p>
      <p className={css.moderationNote}>
        <FormattedMessage id="ProfileSettingsForm.portfolioModerationNote" />
      </p>

      <div className={css.imagesGrid}>
        {allImages.map((image, index) => {
          const isPending = image.status === 'pending';
          return (
            <div key={image.imageId || index} className={css.imageWrapper}>
              {image.imageUrl ? (
                <img 
                  src={image.imageUrl} 
                  alt={`Portfolio ${index + 1}`}
                  className={css.image}
                />
              ) : (
                <div className={css.imagePlaceholder}>
                  <IconSpinner />
                </div>
              )}
              {isPending && (
                <div className={css.pendingBadge}>
                  <FormattedMessage id="ProfileSettingsForm.portfolioPending" />
                </div>
              )}
              <button
                type="button"
                className={css.removeButton}
                onClick={() => handleRemove(image.imageId, image.isExisting)}
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          );
        })}

        {canAddMore && (
          <label className={css.addButton}>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_IMAGES}
              onChange={handleFileChange}
              className={css.fileInput}
              disabled={uploadInProgress}
              multiple
            />
            {uploadInProgress ? (
              <IconSpinner />
            ) : (
              <>
                <span className={css.addIcon}>+</span>
                <span className={css.addText}>
                  <FormattedMessage id="ProfileSettingsForm.portfolioAddPhoto" />
                </span>
              </>
            )}
          </label>
        )}
      </div>

      {uploadError && (
        <p className={css.error}>
          <FormattedMessage id="ProfileSettingsForm.portfolioUploadError" />
        </p>
      )}
      
      <div className={css.footer}>
        <p className={css.counter}>
          {allImages.length} / {MAX_PORTFOLIO_IMAGES}
        </p>
        
        {/* Show save button when there are new portfolio images */}
        {portfolioImages.length > 0 && (
          <Button
            className={css.saveButton}
            type="submit"
            inProgress={saveInProgress}
            disabled={saveDisabled || uploadInProgress}
          >
            <FormattedMessage id="ProfileSettingsForm.savePortfolio" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default PortfolioUploader;
