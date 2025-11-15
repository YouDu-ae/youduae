import React, { useState } from 'react';
import classNames from 'classnames';
import { FormattedMessage } from '../../util/reactIntl';
import { H4, ResponsiveImage, Modal } from '../../components';

import css from './SectionPortfolio.module.css';

const PortfolioItem = ({ item, images, onImageClick }) => {
  const { title, description, category, completedAt } = item;
  const mainImage = images && images.length > 0 ? images[0] : null;

  if (!mainImage) {
    return null;
  }

  return (
    <div className={css.portfolioItem} onClick={() => onImageClick(item, images)}>
      <div className={css.imageWrapper}>
        <ResponsiveImage
          rootClassName={css.portfolioImage}
          alt={title || 'Portfolio work'}
          image={mainImage}
          variants={['scaled-small', 'scaled-medium', 'scaled-large']}
        />
        {images.length > 1 && (
          <div className={css.imageCount}>
            <span>+{images.length - 1}</span>
          </div>
        )}
      </div>
      {title && <h3 className={css.portfolioTitle}>{title}</h3>}
      {description && <p className={css.portfolioDescription}>{description}</p>}
      {completedAt && (
        <p className={css.portfolioDate}>
          {new Date(completedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
};

const PortfolioModal = ({ isOpen, onClose, item, images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!isOpen || !images || images.length === 0) {
    return null;
  }

  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;

  const handlePrev = () => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
  };

  return (
    <Modal
      id="PortfolioModal"
      isOpen={isOpen}
      onClose={onClose}
      onManageDisableScrolling={() => {}}
      containerClassName={css.modalContainer}
      contentClassName={css.modalContent}
    >
      <div className={css.modalImageWrapper}>
        {hasMultiple && (
          <button
            type="button"
            className={classNames(css.modalNav, css.modalNavPrev)}
            onClick={handlePrev}
            aria-label="Previous image"
          >
            ‹
          </button>
        )}
        
        <ResponsiveImage
          rootClassName={css.modalImage}
          alt={item?.title || 'Portfolio work'}
          image={currentImage}
          variants={['scaled-large', 'scaled-xlarge']}
        />

        {hasMultiple && (
          <button
            type="button"
            className={classNames(css.modalNav, css.modalNavNext)}
            onClick={handleNext}
            aria-label="Next image"
          >
            ›
          </button>
        )}
      </div>

      {hasMultiple && (
        <div className={css.modalCounter}>
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {item?.title && <h3 className={css.modalTitle}>{item.title}</h3>}
      {item?.description && <p className={css.modalDescription}>{item.description}</p>}
      {item?.completedAt && (
        <p className={css.modalDate}>
          <FormattedMessage
            id="ProfilePage.portfolioCompletedOn"
            values={{ date: new Date(item.completedAt).toLocaleDateString() }}
          />
        </p>
      )}

      <button type="button" className={css.modalClose} onClick={onClose}>
        ×
      </button>
    </Modal>
  );
};

const SectionPortfolio = props => {
  const { portfolioItems = [], user, intl } = props;
  const [modalState, setModalState] = useState({ isOpen: false, item: null, images: null });

  if (!portfolioItems || portfolioItems.length === 0) {
    return null;
  }

  const handleImageClick = (item, images) => {
    setModalState({ isOpen: true, item, images });
  };

  const handleCloseModal = () => {
    setModalState({ isOpen: false, item: null, images: null });
  };

  // Get all images from Redux state (included in user entity)
  const allUserImages = user?.images || [];

  // Map image UUIDs from portfolio items to actual image entities
  const getImagesForItem = item => {
    if (!item.images || !Array.isArray(item.images)) {
      return [];
    }
    
    return item.images
      .map(imageId => {
        const imageUuid = typeof imageId === 'string' ? imageId : imageId?.uuid || imageId?.id?.uuid;
        // Find image in user's images array
        const foundImage = allUserImages.find(img => {
          const imgUuid = img?.id?.uuid || img?.uuid;
          return imgUuid === imageUuid;
        });
        return foundImage;
      })
      .filter(Boolean);
  };

  return (
    <div className={css.root}>
      <H4 as="h2" className={css.title}>
        <FormattedMessage id="ProfilePage.portfolioTitle" values={{ count: portfolioItems.length }} />
      </H4>

      <div className={css.portfolioGrid}>
        {portfolioItems.map((item, index) => {
          const images = getImagesForItem(item);
          return images.length > 0 ? (
            <PortfolioItem
              key={item.id || index}
              item={item}
              images={images}
              onImageClick={handleImageClick}
            />
          ) : null;
        })}
      </div>

      <PortfolioModal
        isOpen={modalState.isOpen}
        onClose={handleCloseModal}
        item={modalState.item}
        images={modalState.images}
      />
    </div>
  );
};

export default SectionPortfolio;

