import React, { useState } from 'react';
import { useForm, useField } from 'react-final-form';
import classNames from 'classnames';

import { useIntl } from '../../util/reactIntl';
import { SERVICE_CATEGORIES, getSubcategoryEnumOptions } from '../../config/serviceCategories';
import { FieldCheckbox } from '../../components';

import css from './ServiceCategorySelector.module.css';

/**
 * ServiceCategorySelector - красивый компонент для выбора категорий и подкатегорий
 * Используется в форме регистрации Customer (исполнитель)
 */
const ServiceCategorySelector = () => {
  const intl = useIntl();
  const locale = intl.locale === 'ru' ? 'ru' : 'en';
  
  // Получаем доступ к Form API
  const form = useForm();

  const [expandedCategories, setExpandedCategories] = useState([]);

  // Read categories straight from the form: mirroring them in local state
  // writes [] back into the form on mount and wipes saved categories.
  const { input: categoriesInput } = useField('serviceCategories', { subscription: { value: true } });
  const { input: subcategoriesInput } = useField('subcategories', { subscription: { value: true } });
  const selectedCategories = Array.isArray(categoriesInput.value) ? categoriesInput.value : [];
  const currentSubcategories =
    subcategoriesInput.value && typeof subcategoriesInput.value === 'object'
      ? subcategoriesInput.value
      : {};

  // Переключение категории
  const toggleCategory = categoryId => {
    const isSelected = selectedCategories.includes(categoryId);
    
    if (isSelected) {
      // Убираем категорию
      const newCategories = selectedCategories.filter(id => id !== categoryId);
      
      // Убираем из expanded
      setExpandedCategories(expandedCategories.filter(id => id !== categoryId));
      
      // Очищаем subcategories для этой категории
      const newSubcategories = { ...currentSubcategories };
      delete newSubcategories[categoryId];
      
      // Обновляем форму через Form API
      form.change('serviceCategories', newCategories);
      form.change('subcategories', newSubcategories);
    } else {
      // Добавляем категорию
      const newCategories = [...selectedCategories, categoryId];
      
      // Автоматически раскрываем для выбора подкатегорий
      setExpandedCategories([...expandedCategories, categoryId]);
      
      // Обновляем форму через Form API
      form.change('serviceCategories', newCategories);
    }
  };

  // Переключение раскрытия категории
  const toggleExpanded = categoryId => {
    if (expandedCategories.includes(categoryId)) {
      setExpandedCategories(expandedCategories.filter(id => id !== categoryId));
    } else {
      setExpandedCategories([...expandedCategories, categoryId]);
    }
  };

  // Переключение подкатегории
  const toggleSubcategory = (categoryId, subcategoryId) => {
    const currentSubs = currentSubcategories[categoryId] || [];
    const isSelected = currentSubs.includes(subcategoryId);
    
    let newSubs;
    if (isSelected) {
      newSubs = currentSubs.filter(id => id !== subcategoryId);
    } else {
      newSubs = [...currentSubs, subcategoryId];
    }
    
    const newSubcategories = {
      ...currentSubcategories,
      [categoryId]: newSubs,
    };
    
    // Обновляем форму через Form API
    form.change('subcategories', newSubcategories);
  };

  return (
    <div className={css.root}>
      <label className={css.label}>
        {intl.formatMessage({ id: 'ServiceCategory.selectServices' })}
        <span className={css.required}>*</span>
      </label>
      
      <p className={css.description}>
        {intl.formatMessage({ id: 'ServiceCategory.selectDescription' })}
      </p>

      <div className={css.categoriesGrid}>
        {SERVICE_CATEGORIES.map(category => {
          const isSelected = selectedCategories.includes(category.id);
          const isExpanded = expandedCategories.includes(category.id);
          const hasSubcategories = category.subcategories && category.subcategories.length > 0;
          const selectedSubs = currentSubcategories[category.id] || [];

          return (
            <div
              key={category.id}
              className={classNames(css.categoryCard, {
                [css.selected]: isSelected,
                [css.expanded]: isExpanded,
              })}
            >
              {/* Основная категория */}
              <div className={css.categoryHeader} onClick={() => toggleCategory(category.id)}>
                <span className={css.categoryLabel}>
                  <span className={classNames(css.icon, css[category.icon])} />
                  <span>{category.label[locale]}</span>
                </span>

                {hasSubcategories && isSelected && (
                  <button
                    type="button"
                    className={css.expandToggle}
                    onClick={e => {
                      e.stopPropagation();
                      toggleExpanded(category.id);
                    }}
                  >
                    {isExpanded ? '−' : '+'}
                  </button>
                )}
              </div>

              {/* Подкатегории */}
              {isSelected && isExpanded && hasSubcategories && (
                <div className={css.subcategories}>
                  <p className={css.subcategoriesTitle}>
                    {intl.formatMessage({ id: 'ServiceCategory.chooseSpecialization' })}
                  </p>
                  <div className={css.subcategoryPills}>
                    {category.subcategories.map(sub => {
                      const isSubSelected = selectedSubs.includes(sub.id);
                      
                      return (
                        <label
                          key={sub.id}
                          className={classNames(css.pill, {
                            [css.pillSelected]: isSubSelected,
                          })}
                        >
                          <input
                            type="checkbox"
                            checked={isSubSelected}
                            onChange={() => toggleSubcategory(category.id, sub.id)}
                          />
                          <span>{sub.label[locale]}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ServiceCategorySelector;

