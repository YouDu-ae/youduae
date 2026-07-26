import React, { useState } from 'react';
import { FormattedMessage } from '../../util/reactIntl';
import { Heading } from '../../components';

import css from './ProfilePage.module.css';

const SectionPortfolio = props => {
  const { portfolio = [] } = props;
  const [selectedImage, setSelectedImage] = useState(null);

  // Only show approved images
  const approvedImages = portfolio.filter(img => img.status === 'approved');

  if (!approvedImages.length) {
    return null;
  }

  const handleImageClick = imageUrl => {
    setSelectedImage(imageUrl);
  };

  const handleCloseModal = () => {
    setSelectedImage(null);
  };

  return (
    <div className={css.sectionPortfolio}>
      <Heading as="h2" rootClassName={css.sectionHeading}>
        <FormattedMessage id="ProfilePage.portfolioTitle" />
      </Heading>
      <div className={css.portfolioGrid}>
        {approvedImages.map((image, index) => (
          <button
            key={image.imageId || index}
            type="button"
            className={css.portfolioImageWrapper}
            onClick={() => handleImageClick(image.imageUrl)}
          >
            <img
              src={image.imageUrl}
              alt={`Portfolio ${index + 1}`}
              className={css.portfolioImage}
            />
          </button>
        ))}
      </div>

      {/* Modal for full-size image */}
      {selectedImage && (
        <div className={css.portfolioModal} onClick={handleCloseModal}>
          <button
            type="button"
            className={css.portfolioModalClose}
            onClick={handleCloseModal}
            aria-label="Close"
          >
            ×
          </button>
          <img
            src={selectedImage}
            alt="Portfolio"
            className={css.portfolioModalImage}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default SectionPortfolio;
