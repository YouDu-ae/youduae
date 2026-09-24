import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useHistory } from 'react-router-dom';
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { Page, LayoutSingleColumn, NamedLink, VerificationBadge, SubcategoryFilter } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';
import {
  getCategoryLabel,
  SERVICE_CATEGORIES,
  getSubcategoryLabel,
} from '../../config/serviceCategories';
import { searchExecutors } from '../../util/api';
import css from './CategoryExecutorsPage.module.css';

/**
 * Страница со списком исполнителей по категории услуг
 *
 * URL: /category/:categoryId
 * Например: /category/repairs_main (Ремонт и строительство)
 *
 * Публичная страница: список исполнителей доступен всем посетителям.
 */
const CategoryExecutorsPageComponent = () => {
  const intl = useIntl();
  const locale = intl.locale === 'ru' ? 'ru' : 'en';
  const { categoryId } = useParams();
  const location = useLocation();
  const history = useHistory();
  const [executors, setExecutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);

  const categoryLabel = getCategoryLabel(categoryId, locale);
  const categoryExists = SERVICE_CATEGORIES.find(cat => cat.id === categoryId);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sub = params.get('sub');
    setSelectedSubcategory(sub || null);
  }, [location.search]);

  useEffect(() => {
    if (!categoryExists) {
      setError(intl.formatMessage({ id: 'CategoryExecutorsPage.categoryNotFound' }));
      setLoading(false);
      setExecutors([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    searchExecutors(categoryId)
      .then(data => {
        if (cancelled) return;
        setExecutors(data.data || []);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('❌ Error fetching executors:', err);
        setError(err.message || 'Failed to fetch executors');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [categoryId, categoryExists, intl]);

  const formatDate = dateString => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 30) {
      return intl.formatMessage({ id: 'CategoryExecutorsPage.daysAgo' }, { count: diffDays });
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return intl.formatMessage({ id: 'CategoryExecutorsPage.monthsAgo' }, { count: months });
    } else {
      const years = Math.floor(diffDays / 365);
      return intl.formatMessage({ id: 'CategoryExecutorsPage.yearsAgo' }, { count: years });
    }
  };

  const renderStars = rating => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <span key={i} className={css.star}>
          ★
        </span>
      );
    }
    if (hasHalfStar) {
      stars.push(
        <span key="half" className={css.star}>
          ★
        </span>
      );
    }
    const emptyStars = 5 - stars.length;
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <span key={`empty-${i}`} className={css.starEmpty}>
          ☆
        </span>
      );
    }

    return stars;
  };

  const filteredExecutors = selectedSubcategory
    ? executors.filter(executor => {
        let subcategories = executor.publicData?.subcategories;

        if (typeof subcategories === 'string' && subcategories.trim() !== '') {
          try {
            subcategories = JSON.parse(subcategories);
          } catch (e) {
            return false;
          }
        }

        if (!subcategories || !subcategories[categoryId]) {
          return false;
        }

        return subcategories[categoryId].includes(selectedSubcategory);
      })
    : executors;

  if (!categoryExists) {
    return (
      <Page
        title={intl.formatMessage({ id: 'CategoryExecutorsPage.categoryNotFound' })}
        scrollingDisabled={false}
      >
        <TopbarContainer />
        <LayoutSingleColumn topbar={<TopbarContainer />} footer={<FooterContainer />}>
          <div className={css.error}>
            <h1>
              <FormattedMessage id="CategoryExecutorsPage.categoryNotFound" />
            </h1>
            <p>
              <FormattedMessage id="CategoryExecutorsPage.categoryNotFoundMessage" />
            </p>
            <NamedLink name="LandingPage" className={css.backButton}>
              <FormattedMessage id="CategoryExecutorsPage.goHome" />
            </NamedLink>
          </div>
        </LayoutSingleColumn>
      </Page>
    );
  }

  return (
    <Page
      title={intl.formatMessage(
        { id: 'CategoryExecutorsPage.metaTitle' },
        { category: categoryLabel }
      )}
      description={intl.formatMessage(
        { id: 'CategoryExecutorsPage.metaDescription' },
        { category: categoryLabel }
      )}
      scrollingDisabled={false}
      schema={{
        '@context': 'http://schema.org',
        '@type': 'CollectionPage',
        name: intl.formatMessage(
          { id: 'CategoryExecutorsPage.schemaName' },
          { category: categoryLabel }
        ),
        description: intl.formatMessage(
          { id: 'CategoryExecutorsPage.schemaDescription' },
          { category: categoryLabel }
        ),
      }}
    >
      <LayoutSingleColumn topbar={<TopbarContainer />} footer={<FooterContainer />}>
        <div className={css.root}>
          <div className={css.header}>
            <button onClick={() => history.goBack()} className={css.backLink} type="button">
              ← <FormattedMessage id="CategoryExecutorsPage.backToCategories" />
            </button>
            <h1 className={css.title}>
              <FormattedMessage
                id="CategoryExecutorsPage.pageTitle"
                values={{ category: categoryLabel }}
              />
              {selectedSubcategory
                ? ` / ${getSubcategoryLabel(categoryId, selectedSubcategory, locale)}`
                : ''}
            </h1>
            <p className={css.subtitle}>
              {loading ? (
                <FormattedMessage id="CategoryExecutorsPage.loading" />
              ) : (
                <FormattedMessage
                  id="CategoryExecutorsPage.foundCount"
                  values={{ count: filteredExecutors.length }}
                />
              )}
            </p>
          </div>

          {!loading && !error && executors.length > 0 && (
            <SubcategoryFilter
              categoryId={categoryId}
              selectedSubcategory={selectedSubcategory}
              onSubcategoryChange={setSelectedSubcategory}
            />
          )}

          {loading && (
            <div className={css.loading}>
              <div className={css.spinner}>⏳</div>
              <p>
                <FormattedMessage id="CategoryExecutorsPage.loadingExecutors" />
              </p>
            </div>
          )}

          {(error || (!loading && filteredExecutors.length === 0)) && (
            <div className={css.empty}>
              <p className={css.emptyIcon}>{error ? '⚠️' : '😔'}</p>
              <h2>
                <FormattedMessage
                  id={
                    error
                      ? 'CategoryExecutorsPage.errorTitle'
                      : selectedSubcategory
                      ? 'CategoryExecutorsPage.noExecutorsInSubcategory'
                      : 'CategoryExecutorsPage.noExecutorsTitle'
                  }
                />
              </h2>
              <p className={css.noExecutorsMessage}>
                {error ? (
                  <FormattedMessage id="CategoryExecutorsPage.errorMessage" />
                ) : (
                  <FormattedMessage
                    id={
                      selectedSubcategory
                        ? 'CategoryExecutorsPage.tryAnotherSubcategory'
                        : 'CategoryExecutorsPage.noExecutorsMessage'
                    }
                  />
                )}
              </p>
              {selectedSubcategory && !error && (
                <button
                  onClick={() => setSelectedSubcategory(null)}
                  className={css.resetFilterButton}
                >
                  <FormattedMessage id="CategoryExecutorsPage.showAllExecutors" />
                </button>
              )}
              <p className={css.hint}>
                <NamedLink name="LandingPage" className={css.backToHomeLink}>
                  ← <FormattedMessage id="CategoryExecutorsPage.backToHome" />
                </NamedLink>
              </p>
            </div>
          )}

          {!loading && !error && filteredExecutors.length > 0 && (
            <div className={css.tableContainer}>
              <table className={css.table}>
                <thead>
                  <tr>
                    <th className={css.thAvatar}></th>
                    <th className={css.thName}>
                      <FormattedMessage id="CategoryExecutorsPage.columnName" />
                    </th>
                    <th className={css.thVerification}>
                      <FormattedMessage id="CategoryExecutorsPage.columnVerification" />
                    </th>
                    <th className={css.thRegistration}>
                      <FormattedMessage id="CategoryExecutorsPage.columnRegistration" />
                    </th>
                    <th className={css.thReviews}>
                      <FormattedMessage id="CategoryExecutorsPage.columnReviews" />
                    </th>
                    <th className={css.thRating}>
                      <FormattedMessage id="CategoryExecutorsPage.columnRating" />
                    </th>
                    <th className={css.thActions}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExecutors.map(executor => {
                    const isVerified = executor.isVerified === true;

                    return (
                      <tr key={executor.id} className={css.executorRow}>
                        <td className={css.tdAvatar}>
                          <NamedLink name="ProfilePage" params={{ id: executor.id }}>
                            {executor.profileImage ? (
                              <img
                                src={
                                  executor.profileImage.attributes?.variants?.['square-small']
                                    ?.url ||
                                  executor.profileImage.attributes?.variants?.default?.url ||
                                  executor.profileImage.attributes?.variants?.['square-small2x']
                                    ?.url
                                }
                                alt={executor.displayName}
                                className={css.avatar}
                              />
                            ) : (
                              <div className={css.avatarPlaceholder}>
                                {executor.abbreviatedName ||
                                  executor.displayName?.charAt(0) ||
                                  '?'}
                              </div>
                            )}
                          </NamedLink>
                        </td>

                        <td className={css.tdName}>
                          <NamedLink
                            name="ProfilePage"
                            params={{ id: executor.id }}
                            className={css.nameLink}
                          >
                            {executor.displayName}
                          </NamedLink>
                        </td>

                        <td className={css.tdVerification}>
                          {isVerified ? (
                            <span className={css.verified}>
                              <VerificationBadge isVerified={true} />
                              <span className={css.verifiedText}>
                                <FormattedMessage id="CategoryExecutorsPage.verifiedYes" />
                              </span>
                            </span>
                          ) : (
                            <span className={css.notVerified}>
                              <FormattedMessage id="CategoryExecutorsPage.verifiedNo" />
                            </span>
                          )}
                        </td>

                        <td className={css.tdRegistration}>{formatDate(executor.createdAt)}</td>

                        <td className={css.tdReviews}>
                          <span className={css.reviewsCount}>
                            <FormattedMessage
                              id="CategoryExecutorsPage.reviewsCount"
                              values={{ count: executor.reviews.count }}
                            />
                          </span>
                        </td>

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

                        <td className={css.tdActions}>
                          <NamedLink
                            name="ProfilePage"
                            params={{ id: executor.id }}
                            className={css.viewProfileButton}
                          >
                            <FormattedMessage id="CategoryExecutorsPage.viewProfile" />
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
    </Page>
  );
};

export default CategoryExecutorsPageComponent;
