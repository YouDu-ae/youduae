import React, { useState, useRef, useEffect } from 'react';
import classNames from 'classnames';
import { FormattedMessage } from '../../../../../util/reactIntl';
import CategoryList from '../CategoryList/CategoryList';
import css from './FilterCategory.module.css';

const FilterCategory = ({ alignLeft }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Закрываем список при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleInputClick = () => {
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <div 
      ref={containerRef}
      className={classNames(css.filterContainer, {
        [css.alignLeft]: alignLeft,
      })}
    >
      <div 
        className={css.searchInput}
        onClick={handleInputClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleInputClick();
          }
        }}
      >
        <svg className={css.icon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className={css.placeholder}>
          <FormattedMessage id="FilterCategory.placeholder" />
        </span>
      </div>
      
      <CategoryList isOpen={isOpen} onClose={handleClose} />
    </div>
  );
};

export default FilterCategory;

