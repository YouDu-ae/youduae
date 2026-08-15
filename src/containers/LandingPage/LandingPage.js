import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { NamedLink, Page } from '../../components';
import { apiBaseUrl } from '../../util/api';
import css from './LandingPage.module.css';
import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import FooterCustom from '../FooterCustom/FooterCustom';
import blogFallbackVilla from './blog-villa.png';
import blogFallbackPlane from './blog-plane.png';
import blogFallbackTeacher from './blog-teacher.png';

const BLOG_FALLBACK_IMAGES = [blogFallbackVilla, blogFallbackPlane, blogFallbackTeacher];
const BLOG_CARDS_COUNT = 3;

const LandingPage = () => {
  const history = useHistory();
  const intl = useIntl();
  const locale = intl.locale || 'ru';
  const [taskTitle, setTaskTitle] = useState('');
  const [blog, setBlog] = useState({ status: 'loading', articles: [], categories: [] });
  const [reviews, setReviews] = useState({ status: 'loading', items: [] });

  useEffect(() => {
    let cancelled = false;

    fetch(`${apiBaseUrl()}/api/landing-reviews`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(data => {
        if (!cancelled) setReviews({ status: 'ready', items: data.reviews || [] });
      })
      .catch(() => {
        if (!cancelled) setReviews({ status: 'failed', items: [] });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch(`${apiBaseUrl()}/api/blog/articles`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(data => {
        if (cancelled) return;
        setBlog({
          status: 'ready',
          articles: (data.articles || []).slice(0, BLOG_CARDS_COUNT),
          categories: data.categories || [],
        });
      })
      .catch(() => {
        if (!cancelled) setBlog({ status: 'failed', articles: [], categories: [] });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const blogCategoryLabel = article =>
    blog.categories.find(c => c.id === article.category)?.name?.[locale] || article.category;

  // Статьи без обложки получают одну из фирменных иллюстраций — так блок
  // выглядит разнообразнее, чем с общей заглушкой из /static/blog.
  const blogCardBackground = (article, index) => {
    const fallback = BLOG_FALLBACK_IMAGES[index % BLOG_FALLBACK_IMAGES.length];
    return { backgroundImage: `url(${article.image || fallback})` };
  };

  const showBlogSection = blog.status === 'loading' || blog.articles.length > 0;

  // Настоящих отзывов пока немного, и блок скрывается, если их нет совсем:
  // пустой раздел «Отзывы об исполнителях» вредит доверию сильнее, чем его отсутствие.
  const showReviewsSection = reviews.status === 'loading' || reviews.items.length > 0;
  const reviewInitials = review =>
    review.authorInitials || review.authorName.trim().charAt(0).toUpperCase();

  const siteTitle = intl.formatMessage({ id: 'LandingPage.schemaTitle' });
  const schemaDescription = intl.formatMessage({ id: 'LandingPage.schemaDescription' });

  const handleSearchClick = (e) => {
    e.preventDefault();
    // ВСЕГДА редирект на GuestListingWizard (форма создания задания)
    // Передаем title если есть, иначе просто открываем форму
    if (taskTitle && taskTitle.trim()) {
      history.push({
        pathname: '/l/new',
        search: `?title=${encodeURIComponent(taskTitle.trim())}`,
      });
    } else {
      // Даже без title открываем форму создания задания
      history.push('/l/new');
    }
  };

  // OG images for social sharing
  const ogImages = [
    {
      url: 'https://youdu.ae/og-banner.png',
      width: 1200,
      height: 630,
    }
  ];

  return (
    <Page
      title={siteTitle}
      description={schemaDescription}
      facebookImages={ogImages}
      twitterImages={ogImages}
      schema={{
        '@context': 'http://schema.org',
        '@type': 'WebSite',
        name: siteTitle,
        description: schemaDescription,
        url: 'https://youdu.ae',
      }}
    >
      <div className={css.shell}>
        <TopbarContainer />

      <main className={css.page}>
        {/* фоны */}
        <div className={css.mainBg} aria-hidden="true" />
        <div className={css.mainBgMobile} aria-hidden="true" />
        <div className={css.illustrationBack} aria-hidden="true" />

        <div className={css.container}>

          {/* ===== HERO ===== */}
          <section className={css.hero}>
            <div className={css.heroText}>
              <div className={css.title}>
                <h1 className={css.titleH1}>
                  <FormattedMessage 
                    id="LandingPage.heroTitle" 
                    values={{ br: <br /> }} 
                  />
                </h1>
                <p className={css.titleSub}>
                  <FormattedMessage id="LandingPage.heroSubtitle" />
                </p>
              </div>

              <div className={css.searchLine}>
                <div className={css.search}>
                  <input
                    type="text"
                    className={css.searchInput}
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder={intl.formatMessage({ id: 'LandingPage.searchPlaceholder' })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearchClick(e);
                      }
                    }}
                  />
                </div>
                <button onClick={handleSearchClick} className={css.btnFind}>
                  <FormattedMessage id="LandingPage.findButton" />
                </button>
              </div>
            </div>

            <div className={css.heroIllustration} aria-hidden="true" />
          </section>

 
         {/* ===== ПРЕИМУЩЕСТВА ===== */}
          <section className={css.advantages}>
            <div className={css.advantagesLine}>
              <div className={css.advantage}>
                <div className={css.advRow}>
                  <span className={`${css.icon} ${css.iconTexting}`} />
                  <span className={css.advTitle}>
                    <FormattedMessage id="LandingPage.advantagesTitle1" values={{ br: <br /> }} />
                  </span>
                </div>
                <div className={css.advText}>
                  <FormattedMessage id="LandingPage.advantagesText1" values={{ br: <br /> }} />
                </div>
              </div>

              <div className={css.advantage}>
                <div className={css.advRow}>
                  <span className={`${css.icon} ${css.iconFire}`} />
                  <span className={css.advTitle}>
                    <FormattedMessage id="LandingPage.advantagesTitle2" values={{ br: <br /> }} />
                  </span>
                </div>
                <div className={css.advText}>
                  <FormattedMessage id="LandingPage.advantagesText2" values={{ br: <br /> }} />
                </div>
              </div>

              <div className={css.advantage}>
                <div className={css.advRow}>
                  <span className={`${css.icon} ${css.iconPopular}`} />
                  <span className={css.advTitle}>
                    <FormattedMessage id="LandingPage.advantagesTitle3" values={{ br: <br /> }} />
                  </span>
                </div>
                <div className={css.advText}>
                  <FormattedMessage id="LandingPage.advantagesText3" values={{ br: <br /> }} />
                </div>
              </div>
            </div>
          </section>
  

          {/* ===== КАТЕГОРИИ ===== */}
          <section className={css.categories}>
            <h2 className={css.catTitle}><FormattedMessage id="LandingPage.categoriesTitle" /></h2>
            <p className={css.catSubtitle}>
              <FormattedMessage id="LandingPage.categoriesSubtitle" values={{ br: <br /> }} />
            </p>

            <div className={css.categoriesGrid}>
              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'repairs_main' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconDrill}></span>
                  <span><FormattedMessage id="LandingPage.category.construction" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'Beauty_health' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconScissors}></span>
                  <span><FormattedMessage id="LandingPage.category.beauty" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'training' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconSchool}></span>
                  <span><FormattedMessage id="LandingPage.category.tutors" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'Help_home' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconHousekeeper}></span>
                  <span><FormattedMessage id="LandingPage.category.cleaning" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'Legal_assistance' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconWeight}></span>
                  <span><FormattedMessage id="LandingPage.category.legal" values={{ br: <br /> }} /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'Installation_mashines' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconKitchen}></span>
                  <span><FormattedMessage id="LandingPage.category.appliances" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'Photo' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconCamera}></span>
                  <span><FormattedMessage id="LandingPage.category.photo" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'Delivery' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconCourier}></span>
                  <span><FormattedMessage id="LandingPage.category.courier" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'Cargo_transportation' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconTruck}></span>
                  <span><FormattedMessage id="LandingPage.category.transport" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'Repair_digital' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconSearch}></span>
                  <span><FormattedMessage id="LandingPage.category.electronics" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'Automotive_services' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconCar}></span>
                  <span><FormattedMessage id="LandingPage.category.auto" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'Interior_designer' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconInterior}></span>
                  <span><FormattedMessage id="LandingPage.category.interior" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'Tourist_services' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconTourist}></span>
                  <span><FormattedMessage id="LandingPage.category.tourist" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'Web_design' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconWeb}></span>
                  <span><FormattedMessage id="LandingPage.category.web" /></span>
                </div>
              </NamedLink>
            </div>
          </section>
 

          {/* ===== КАК ЭТО РАБОТАЕТ ===== */}
          <section className={css.howItWorks}>
            <h2 className={css.h2}><FormattedMessage id="LandingPage.howItWorksTitle" /></h2>

            <div className={css.hiwGrid}>
              <div className={`${css.hiwCard} ${css.hiwCard1}`}>
                <div className={css.hiwBack}>
                  <div className={css.hiwTitle}><FormattedMessage id="LandingPage.howItWorksCard1Title" /></div>
                  <div className={css.hiwText}><FormattedMessage id="LandingPage.howItWorksCard1Text" /></div>
                </div>
              </div>

              <div className={`${css.hiwCard} ${css.hiwCard2}`}>
                <div className={css.hiwBack}>
                  <div className={css.hiwTitle}><FormattedMessage id="LandingPage.howItWorksCard2Title" /></div>
                  <div className={css.hiwText}><FormattedMessage id="LandingPage.howItWorksCard2Text" /></div>
                </div>
              </div>

              <div className={`${css.hiwCard} ${css.hiwCard3}`}>
                <div className={css.hiwBack}>
                  <div className={css.hiwTitle}><FormattedMessage id="LandingPage.howItWorksCard3Title" /></div>
                  <div className={css.hiwText}><FormattedMessage id="LandingPage.howItWorksCard3Text" values={{ br: <br /> }} /></div>
                </div>
              </div>
            </div>
          </section>
  

          {/* ===== ОТЗЫВЫ ===== */}
          {showReviewsSection && (
          <section className={css.reviews}>
            <h2 className={css.h2}><FormattedMessage id="LandingPage.reviewsTitle" /></h2>

            <div className={css.reviewsGrid}>
              {reviews.status === 'loading'
                ? [0, 1, 2].map(index => (
                    <div key={index} className={css.reviewSkeleton} aria-hidden="true" />
                  ))
                : reviews.items.map(review => (
                    <article key={review.id} className={css.reviewCard}>
                      <header className={css.reviewHeader}>
                        <div className={css.avatar} aria-hidden="true">
                          {reviewInitials(review)}
                        </div>
                        <div className={css.person}>{review.authorName}</div>
                      </header>
                      <div className={css.reviewBody}>
                        <div className={css.reviewTask}>
                          <FormattedMessage
                            id="LandingPage.reviewTask"
                            values={{ title: review.taskTitle }}
                          />
                        </div>
                        <div className={css.reviewText}>{review.content}</div>
                      </div>
                      <div
                        className={css.stars}
                        role="img"
                        aria-label={intl.formatMessage(
                          { id: 'LandingPage.reviewRating' },
                          { rating: review.rating }
                        )}
                      >
                        {Array.from({ length: review.rating }, (_, index) => (
                          <span key={index} className={css.star} />
                        ))}
                      </div>
                    </article>
                  ))}
            </div>
          </section>
          )}
 

          {/* ===== БЛОГ ===== */}
          {showBlogSection && (
          <section className={css.blog}>
            <h2 className={css.h2}><FormattedMessage id="LandingPage.blogTitle" /></h2>

            <div className={css.blogGrid}>
              {blog.status === 'loading'
                ? BLOG_FALLBACK_IMAGES.map((image, index) => (
                    <div key={index} className={css.blogCard} aria-hidden="true">
                      <div className={css.blogImage} style={{ backgroundImage: `url(${image})` }} />
                      <div className={css.blogTextBlock}>
                        <div className={css.blogTagSkeleton} />
                        <div className={css.blogNameSkeleton} />
                      </div>
                    </div>
                  ))
                : blog.articles.map((article, index) => (
                    <NamedLink
                      key={article.id}
                      name="BlogArticlePage"
                      params={{ slug: article.slug }}
                      className={css.blogCard}
                    >
                      <div
                        className={css.blogImage}
                        style={blogCardBackground(article, index)}
                      />
                      <div className={css.blogTextBlock}>
                        <div className={css.blogTag}>{blogCategoryLabel(article)}</div>
                        <div className={css.blogName}>
                          {article.title?.[locale] || article.title?.ru}
                        </div>
                      </div>
                    </NamedLink>
                  ))}
            </div>

            <NamedLink name="BlogPage" className={css.btnBlog}>
              <FormattedMessage id="LandingPage.blogButton" />
            </NamedLink>
          </section>
          )}
 

        </div>
      </main>

      <FooterCustom />
      </div>
    </Page>
  );
};

export default LandingPage;

