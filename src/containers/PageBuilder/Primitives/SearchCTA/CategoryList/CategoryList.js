import React from 'react';
import { useHistory } from 'react-router-dom';
import { useRouteConfiguration } from '../../../../../context/routeConfigurationContext';
import { createResourceLocatorString } from '../../../../../util/routes';
import classNames from 'classnames';
import { FormattedMessage } from '../../../../../util/reactIntl';
import css from './CategoryList.module.css';

const CATEGORIES = [
  { id: 'repair-construction', labelId: 'CategoryList.repairConstruction' },
  { id: 'courier-services', labelId: 'CategoryList.courierServices' },
  { id: 'cleaning-home-help', labelId: 'CategoryList.cleaningHomeHelp' },
  { id: 'cargo-transport', labelId: 'CategoryList.cargoTransport' },
  { id: 'appliance-installation', labelId: 'CategoryList.applianceInstallation' },
  { id: 'beauty-health', labelId: 'CategoryList.beautyHealth' },
  { id: 'photo-video-audio', labelId: 'CategoryList.photoVideoAudio' },
  { id: 'digital-tech-repair', labelId: 'CategoryList.digitalTechRepair' },
  { id: 'legal-accounting', labelId: 'CategoryList.legalAccounting' },
  { id: 'tutoring-education', labelId: 'CategoryList.tutoringEducation' },
  { id: 'automotive-services', labelId: 'CategoryList.automotiveServices' },
];

const CategoryList = ({ isOpen, onClose }) => {
  const history = useHistory();
  const routeConfiguration = useRouteConfiguration();

  const handleCategoryClick = (categoryId) => {
    // Создаем URL для страницы создания листинга с предвыбранной категорией
    const to = createResourceLocatorString(
      'NewListingPage',
      routeConfiguration,
      {},
      { category: categoryId }
    );
    
    history.push(to);
    if (onClose) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className={css.categoryListContainer}>
      <div className={css.categoryList}>
        {CATEGORIES.map((category) => (
          <button
            key={category.id}
            className={css.categoryButton}
            onClick={() => handleCategoryClick(category.id)}
            type="button"
          >
            <FormattedMessage id={category.labelId} />
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryList;

