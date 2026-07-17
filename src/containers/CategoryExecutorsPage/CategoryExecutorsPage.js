import React, { useState, useEffect } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { useParams, useLocation, useHistory } from 'react-router-dom';
import { FormattedMessage } from '../../util/reactIntl';
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
 * Soft-gate: SEO-оболочка публичная, список исполнителей — только после входа.
 */
const CategoryExecutorsPageComponent = props => {
  const { isAuthenticated } = props;
  const { categoryId } = useParams();
  const location = useLocation();
  const history = useHistory();
  const [executors, setExecutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);

  const categoryLabel = getCategoryLabel(categoryId, 'ru');
  const categoryExists = SERVICE_CATEGORIES.find(cat => cat.id === categoryId);
  const returnFrom = `${location.pathname}${location.search}${location.hash}`;
  const authLinkState = { from: returnFrom };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sub = params.get('sub');
    setSelectedSubcategory(sub || null);
  }, [location.search]);

  useEffect(() => {
    if (!categoryExists) {
      setError('Категория не найдена');
      setLoading(false);
      setExecutors([]);
      return;
    }

    if (!isAuthenticated) {
      setLoading(false);
      setError(null);
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
  }, [categoryId, categoryExists, isAuthenticated]);

  const formatDate = dateString => {
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
      <Page title="Категория не найдена" scrollingDisabled={false}>
        <TopbarContainer />
        <LayoutSingleColumn topbar={<TopbarContainer />} footer={<FooterContainer />}>
          <div className={css.error}>
            <h1>Категория не найдена</h1>
            <p>Пожалуйста, выберите категорию из списка на главной странице.</p>
            <NamedLink name="LandingPage" className={css.backButton}>
              На главную
            </NamedLink>
          </div>
        </LayoutSingleColumn>
      </Page>
    );
  }

  const subcategoryLabels = (categoryExists.subcategories || []).map(sub => sub.label.ru);

  const renderAuthGate = () => (
    <div className={css.authGate}>
      <p className={css.authGateIcon} aria-hidden="true">
        🔐
      </p>
      <h2 className={css.authGateTitle}>
        <FormattedMessage id="CategoryExecutorsPage.authGateTitle" />
      </h2>
      <p className={css.authGateMessage}>
        <FormattedMessage
          id="CategoryExecutorsPage.authGateMessage"
          values={{ category: categoryLabel }}
        />
      </p>
      <div className={css.authGateActions}>
        <NamedLink name="LoginPage" className={css.authGatePrimary} to={{ state: authLinkState }}>
          <FormattedMessage id="CategoryExecutorsPage.authGateLogin" />
        </NamedLink>
        <NamedLink
          name="SignupForUserTypePage"
          params={{ userType: 'provider' }}
          className={css.authGateSecondary}
          to={{ state: authLinkState }}
        >
          <FormattedMessage id="CategoryExecutorsPage.authGateSignup" />
        </NamedLink>
      </div>
    </div>
  );

  const renderSeoShell = () => (
    <div className={css.seoShell}>
      <p className={css.seoIntro}>
        <FormattedMessage
          id="CategoryExecutorsPage.seoIntro"
          values={{ category: categoryLabel }}
        />
      </p>
      {subcategoryLabels.length > 0 ? (
        <div className={css.seoServices}>
          <h2 className={css.seoServicesTitle}>
            <FormattedMessage id="CategoryExecutorsPage.seoServicesTitle" />
          </h2>
          <ul className={css.seoServicesList}>
            {subcategoryLabels.map(label => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <ul className={css.seoBenefits}>
        <li>
          <FormattedMessage id="CategoryExecutorsPage.seoBenefit1" />
        </li>
        <li>
          <FormattedMessage id="CategoryExecutorsPage.seoBenefit2" />
        </li>
        <li>
          <FormattedMessage id="CategoryExecutorsPage.seoBenefit3" />
        </li>
      </ul>
    </div>
  );

  return (
    <Page
      title={`${categoryLabel} — исполнители в ОАЭ | YouDu`}
      description={`Найдите проверенных специалистов по направлению «${categoryLabel}» в ОАЭ на YouDu. Создайте задание и получите отклики от мастеров.`}
      scrollingDisabled={false}
      schema={{
        '@context': 'http://schema.org',
        '@type': 'CollectionPage',
        name: `${categoryLabel} — исполнители в ОАЭ`,
        description: `Специалисты YouDu в категории «${categoryLabel}»`,
      }}
    >
      <LayoutSingleColumn topbar={<TopbarContainer />} footer={<FooterContainer />}>
        <div className={css.root}>
          <div className={css.header}>
            <button onClick={() => history.goBack()} className={css.backLink} type="button">
              ← Назад к категориям
            </button>
            <h1 className={css.title}>
              {isAuthenticated ? (
                <>
                  Исполнители: {categoryLabel}
                  {selectedSubcategory
                    ? ` / ${getSubcategoryLabel(categoryId, selectedSubcategory, 'ru')}`
                    : ''}
                </>
              ) : (
                categoryLabel
              )}
            </h1>
            {isAuthenticated ? (
              <p className={css.subtitle}>
                Найдено {filteredExecutors.length}{' '}
                {filteredExecutors.length === 1 ? 'исполнитель' : 'исполнителей'}
              </p>
            ) : (
              <p className={css.subtitle}>
                <FormattedMessage id="CategoryExecutorsPage.guestSubtitle" />
              </p>
            )}
          </div>

          {!isAuthenticated ? (
            <>
              {renderSeoShell()}
              {renderAuthGate()}
            </>
          ) : (
            <>
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
                  <p>Загрузка исполнителей...</p>
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
                                  <span className={css.verifiedText}>Да</span>
                                </span>
                              ) : (
                                <span className={css.notVerified}>Нет</span>
                              )}
                            </td>

                            <td className={css.tdRegistration}>{formatDate(executor.createdAt)}</td>

                            <td className={css.tdReviews}>
                              <span className={css.reviewsCount}>
                                {executor.reviews.count}{' '}
                                {executor.reviews.count === 1 ? 'отзыв' : 'отзывов'}
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
            </>
          )}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => {
  const { isAuthenticated } = state.auth;
  return { isAuthenticated };
};

const CategoryExecutorsPage = compose(connect(mapStateToProps))(CategoryExecutorsPageComponent);

export default CategoryExecutorsPage;
