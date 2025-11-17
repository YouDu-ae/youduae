import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { FormattedMessage } from '../../util/reactIntl';
import { Page, LayoutSingleColumn, NamedLink, Avatar, VerificationBadge, SubcategoryFilter } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';
import { getCategoryLabel, SERVICE_CATEGORIES, getSubcategoryLabel } from '../../config/serviceCategories';
import { searchExecutors } from '../../util/api';
import css from './CategoryExecutorsPage.module.css';

/**
 * Страница со списком исполнителей по категории услуг
 * 
 * URL: /category/:categoryId
 * Например: /category/repairs_main (Ремонт и строительство)
 */
const CategoryExecutorsPage = () => {
  const { categoryId } = useParams();
  const location = useLocation();
  const [executors, setExecutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);

  const categoryLabel = getCategoryLabel(categoryId, 'ru');
  const categoryExists = SERVICE_CATEGORIES.find(cat => cat.id === categoryId);

  // Получаем subcategory из URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sub = params.get('sub');
    if (sub) {
      setSelectedSubcategory(sub);
    }
  }, [location.search]);

  useEffect(() => {
    if (!categoryExists) {
      setError('Категория не найдена');
      setLoading(false);
      return;
    }

    console.log('🔍 Fetching executors for category:', categoryId);

    searchExecutors(categoryId)
      .then(data => {
        console.log('✅ Received executors:', data);
        setExecutors(data.data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('❌ Error fetching executors:', err);
        setError(err.message || 'Failed to fetch executors');
        setLoading(false);
      });
  }, [categoryId, categoryExists]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 30) {
      return `${diffDays} дн. назад`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} мес. назад`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years} г. назад`;
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={i} className={css.star}>★</span>);
    }
    if (hasHalfStar) {
      stars.push(<span key="half" className={css.star}>★</span>);
    }
    const emptyStars = 5 - stars.length;
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<span key={`empty-${i}`} className={css.starEmpty}>☆</span>);
    }

    return stars;
  };

  // Фильтруем исполнителей по выбранной подкатегории
  const filteredExecutors = selectedSubcategory
    ? executors.filter(executor => {
        let subcategories = executor.attributes?.profile?.publicData?.subcategories;
        
        console.log('🔍 [CategoryFilter] Executor:', executor.attributes?.profile?.displayName);
        console.log('🔍 [CategoryFilter] Raw subcategories:', subcategories);
        console.log('🔍 [CategoryFilter] Type:', typeof subcategories);
        
        // Десериализуем subcategories, если это JSON-строка
        if (typeof subcategories === 'string') {
          try {
            subcategories = JSON.parse(subcategories);
            console.log('✅ [CategoryFilter] Parsed subcategories:', subcategories);
          } catch (e) {
            console.warn('Failed to parse subcategories:', e);
            return false;
          }
        }
        
        console.log('🔍 [CategoryFilter] Looking for categoryId:', categoryId);
        console.log('🔍 [CategoryFilter] subcategories[categoryId]:', subcategories?.[categoryId]);
        
        if (!subcategories || !subcategories[categoryId]) {
          console.warn('⚠️ [CategoryFilter] No subcategories for this category');
          return false;
        }
        
        const hasSubcategory = subcategories[categoryId].includes(selectedSubcategory);
        console.log(`🔍 [CategoryFilter] Has ${selectedSubcategory}?`, hasSubcategory);
        
        return hasSubcategory;
      })
    : executors;

  if (!categoryExists) {
    return (
      <Page title="Категория не найдена" scrollingDisabled={false}>
        <TopbarContainer />
        <LayoutSingleColumn>
          <div className={css.error}>
            <h1>Категория не найдена</h1>
            <p>Пожалуйста, выберите категорию из списка на главной странице.</p>
            <NamedLink name="LandingPage" className={css.backButton}>
              На главную
            </NamedLink>
          </div>
        </LayoutSingleColumn>
        <FooterContainer />
      </Page>
    );
  }

  return (
    <Page 
      title={`Исполнители - ${categoryLabel}`} 
      scrollingDisabled={false}
      schema={{
        '@context': 'http://schema.org',
        '@type': 'ItemList',
        name: `Исполнители в категории: ${categoryLabel}`,
      }}
    >
      <TopbarContainer />
      <LayoutSingleColumn>
        <div className={css.root}>
          {/* Заголовок с навигацией */}
          <div className={css.header}>
            <NamedLink name="LandingPage" className={css.backLink}>
              ← Назад к категориям
            </NamedLink>
            <h1 className={css.title}>
              Исполнители: {categoryLabel}
              {selectedSubcategory && ` / ${getSubcategoryLabel(categoryId, selectedSubcategory, 'ru')}`}
            </h1>
            <p className={css.subtitle}>
              Найдено {filteredExecutors.length} {filteredExecutors.length === 1 ? 'исполнитель' : 'исполнителей'}
            </p>
          </div>

          {/* Фильтр по подкатегориям */}
          {!loading && !error && executors.length > 0 && (
            <SubcategoryFilter
              categoryId={categoryId}
              selectedSubcategory={selectedSubcategory}
              onSubcategoryChange={setSelectedSubcategory}
            />
          )}

          {/* Загрузка */}
          {loading && (
            <div className={css.loading}>
              <div className={css.spinner}>⏳</div>
              <p>Загрузка исполнителей...</p>
            </div>
          )}

          {/* Ошибка или нет исполнителей */}
          {(error || (!loading && filteredExecutors.length === 0)) && (
            <div className={css.empty}>
              <p className={css.emptyIcon}>😔</p>
              <h2>
                <FormattedMessage 
                  id={selectedSubcategory ? "CategoryExecutorsPage.noExecutorsInSubcategory" : "CategoryExecutorsPage.noExecutorsTitle"} 
                />
              </h2>
              <p className={css.noExecutorsMessage}>
                <FormattedMessage 
                  id={selectedSubcategory ? "CategoryExecutorsPage.tryAnotherSubcategory" : "CategoryExecutorsPage.noExecutorsMessage"} 
                />
              </p>
              {selectedSubcategory && (
                <button 
                  onClick={() => setSelectedSubcategory(null)}
                  className={css.resetFilterButton}
                >
                  Показать всех исполнителей
                </button>
              )}
              <p className={css.hint}>
                <NamedLink name="LandingPage" className={css.backToHomeLink}>
                  ← Вернуться на главную
                </NamedLink>
              </p>
            </div>
          )}

          {/* Список исполнителей */}

          {!loading && !error && filteredExecutors.length > 0 && (
            <div className={css.tableContainer}>
              <table className={css.table}>
                <thead>
                  <tr>
                    <th className={css.thAvatar}></th>
                    <th className={css.thName}>Имя</th>
                    <th className={css.thVerification}>Верификация</th>
                    <th className={css.thRegistration}>Регистрация</th>
                    <th className={css.thReviews}>Отзывы</th>
                    <th className={css.thRating}>Рейтинг</th>
                    <th className={css.thActions}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExecutors.map(executor => {
                    // Проверяем верификацию (приходит с бэкенда)
                    const isVerified = executor.isVerified === true;

                    return (
                      <tr key={executor.id} className={css.executorRow}>
                        {/* Аватар */}
                        <td className={css.tdAvatar}>
                          <NamedLink name="ProfilePage" params={{ id: executor.id }}>
                            {executor.profileImage ? (
                              <img
                                src={
                                  executor.profileImage.attributes?.variants?.['square-small']?.url ||
                                  executor.profileImage.attributes?.variants?.default?.url ||
                                  executor.profileImage.attributes?.variants?.['square-small2x']?.url
                                }
                                alt={executor.displayName}
                                className={css.avatar}
                              />
                            ) : (
                              <div className={css.avatarPlaceholder}>
                                {executor.abbreviatedName || executor.displayName?.charAt(0) || '?'}
                              </div>
                            )}
                          </NamedLink>
                        </td>

                        {/* Имя */}
                        <td className={css.tdName}>
                          <NamedLink name="ProfilePage" params={{ id: executor.id }} className={css.nameLink}>
                            {executor.displayName}
                          </NamedLink>
                        </td>

                        {/* Верификация */}
                        <td className={css.tdVerification}>
                          {isVerified ? (
                            <span className={css.verified}>
                              <VerificationBadge isVerified={true} />
                              <span className={css.verifiedText}>Да</span>
                            </span>
                          ) : (
                            <span className={css.notVerified}>Нет</span>
                          )}
                        </td>

                        {/* Дата регистрации */}
                        <td className={css.tdRegistration}>
                          {formatDate(executor.createdAt)}
                        </td>

                        {/* Количество отзывов */}
                        <td className={css.tdReviews}>
                          <span className={css.reviewsCount}>
                            {executor.reviews.count} {executor.reviews.count === 1 ? 'отзыв' : 'отзывов'}
                          </span>
                        </td>

                        {/* Рейтинг */}
                        <td className={css.tdRating}>
                          {executor.reviews.count > 0 ? (
                            <div className={css.rating}>
                              <div className={css.stars}>
                                {renderStars(executor.reviews.averageRating)}
                              </div>
                              <span className={css.ratingNumber}>
                                {executor.reviews.averageRating.toFixed(1)}
                              </span>
                            </div>
                          ) : (
                            <span className={css.noRating}>—</span>
                          )}
                        </td>

                        {/* Кнопка */}
                        <td className={css.tdActions}>
                          <NamedLink 
                            name="ProfilePage" 
                            params={{ id: executor.id }} 
                            className={css.viewProfileButton}
                          >
                            Профиль
                          </NamedLink>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </LayoutSingleColumn>
      <FooterContainer />
    </Page>
  );
};

export default CategoryExecutorsPage;

