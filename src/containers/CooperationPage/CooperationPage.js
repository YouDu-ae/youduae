import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { NamedLink, Page } from '../../components';
import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import FooterCustom from '../FooterCustom/FooterCustom';
import { getPlatformStats } from '../../util/api';
import { useIntl, FormattedMessage } from '../../util/reactIntl';

import css from './CooperationPage.module.css';

const CANONICAL_URL = 'https://youdu.ae/cooperation';

// Animated counter hook
const useAnimatedCounter = (targetValue, duration = 2000, enabled = true) => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    if (!enabled || targetValue === 0) {
      setCount(targetValue);
      return;
    }
    
    const startTime = Date.now();
    const startValue = 0;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out function for smoother animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.floor(startValue + (targetValue - startValue) * easeOut);
      
      setCount(currentValue);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(targetValue);
      }
    };
    
    requestAnimationFrame(animate);
  }, [targetValue, duration, enabled]);
  
  return count;
};

const FAQ_KEYS = [
  'verificationRequired',
  'cost',
  'earnings',
  'rating',
  'areas',
  'skipTasks',
  'getChosen',
];

const SERVICE_TYPE_KEYS = [
  'serviceTypeRepair',
  'serviceTypeCleaning',
  'serviceTypeTutors',
  'serviceTypeBeauty',
  'serviceTypeDelivery',
  'serviceTypeIt',
];

const capitalize = str => str.charAt(0).toUpperCase() + str.slice(1);

const CooperationPage = () => {
  const intl = useIntl();
  const SEO_TITLE = intl.formatMessage({ id: 'CooperationPage.schemaTitle' });
  const SEO_DESCRIPTION = intl.formatMessage({ id: 'CooperationPage.schemaDescription' });
  const SEO_KEYWORDS = intl.formatMessage({ id: 'CooperationPage.schemaKeywords' });
  const [stats, setStats] = useState({ totalCompletedTasks: 0, totalSumAED: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Animated counters
  const animatedTasks = useAnimatedCounter(stats.totalCompletedTasks, 1500, !statsLoading);
  const animatedSum = useAnimatedCounter(stats.totalSumAED, 2000, !statsLoading);

  useEffect(() => {
    getPlatformStats()
      .then(response => {
        const receivedStats = response.data;
        
        const finalStats = {
          totalCompletedTasks: receivedStats.totalCompletedTasks || 0,
          totalSumAED: receivedStats.totalSumAED || 0,
        };
        
        setStats(finalStats);
        setStatsLoading(false);
      })
      .catch(err => {
        console.error('Failed to load platform stats:', err);
        setStats({ totalCompletedTasks: 0, totalSumAED: 0 });
        setStatsLoading(false);
      });
  }, []);

  const faqData = FAQ_KEYS.map(key => ({
    question: intl.formatMessage({ id: `CooperationPage.faq${capitalize(key)}Question` }),
    answer: intl.formatMessage({ id: `CooperationPage.faq${capitalize(key)}Answer` }),
  }));

const [openIndex, setOpenIndex] = React.useState(null);

const toggle = i => {
  setOpenIndex(prev => (prev === i ? null : i));
};

  // JSON-LD structured data for search engines and AI
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: SEO_TITLE,
    description: SEO_DESCRIPTION,
    url: CANONICAL_URL,
    mainEntity: {
      '@type': 'Organization',
      name: 'YouDu',
      url: 'https://youdu.ae',
      logo: 'https://youdu.ae/static/icons/youdu-logo.png',
      description: intl.formatMessage({ id: 'CooperationPage.schemaOrganizationDescription' }),
      areaServed: {
        '@type': 'Country',
        name: 'United Arab Emirates'
      },
      serviceType: SERVICE_TYPE_KEYS.map(key => intl.formatMessage({ id: `CooperationPage.${key}` })),
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: intl.formatMessage({ id: 'CooperationPage.breadcrumbHome' }),
          item: 'https://youdu.ae'
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: intl.formatMessage({ id: 'CooperationPage.breadcrumbSpecialists' }),
          item: CANONICAL_URL
        }
      ]
    }
  };

  // FAQ Schema for rich snippets
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqData.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer
      }
    }))
  };

  // OG images for social sharing
  const ogImages = [
    {
      url: 'https://youdu.ae/static/icons/youdu-og-cooperation-v2.png',
      width: 1200,
      height: 630,
    }
  ];

  return (
    <Page
      title={SEO_TITLE}
      description={SEO_DESCRIPTION}
      schema={schemaData}
      facebookImages={ogImages}
      twitterImages={ogImages}
    >
      <Helmet>
        <link rel="canonical" href={CANONICAL_URL} />
        <meta name="keywords" content={SEO_KEYWORDS} />
        <meta name="robots" content="index, follow" />
        
        {/* Additional SEO for AI assistants */}
        <meta name="subject" content={intl.formatMessage({ id: 'CooperationPage.metaSubject' })} />
        <meta name="topic" content={intl.formatMessage({ id: 'CooperationPage.metaTopic' })} />
        <meta name="coverage" content="UAE, Dubai, Abu Dhabi, Sharjah" />
        <meta name="distribution" content="global" />
        
        {/* FAQ Schema */}
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      </Helmet>
      
      <div className={css.shell}>
        <TopbarContainer />

        <main className={css.page}>
          <div className={css.coverBg} aria-hidden="true" />

          <div className={css.container}>

            {/* ===== HERO ===== */}
            <section className={css.hero}>
              <h1 className={css.heroTitle}>
                {intl.formatMessage({ id: 'CooperationPage.heroTitle' })}
            </h1>

            <p className={css.heroSubtitle}>
              {intl.formatMessage({ id: 'CooperationPage.heroSubtitle' })}
            </p>

            <div className={css.heroActions}>
              <NamedLink name="CooperationSignupPage" className={css.heroBtn}>
                {intl.formatMessage({ id: 'CooperationPage.becomeSpecialist' })}
              </NamedLink>

              {/* Задания видно без регистрации: специалист сначала смотрит,
                  есть ли для него работа, и только потом заводит аккаунт */}
              <NamedLink name="SearchPage" className={css.heroBtnSecondary}>
                {intl.formatMessage({ id: 'CooperationPage.viewTasks' })}
              </NamedLink>
            </div>
          </section>

          {/* Фоновая картинка */}
          <div className={css.bgMain} aria-hidden="true" />

          {/* ===== ADVANTAGES ===== */}
          <section className={css.advantages}>
            <div className={css.advCard}>
              <div className={css.advText}>
                <h3 className={css.advTitle}>{intl.formatMessage({ id: 'CooperationPage.advOwnPriceTitle' })}</h3>
                <p className={css.advDesc}>
                  <FormattedMessage id="CooperationPage.advOwnPriceDescription" values={{ br: <br /> }} />
                </p>
              </div>
            </div>

            <div className={css.advCard}>
              <div className={css.advText}>
                <h3 className={css.advTitle}>{intl.formatMessage({ id: 'CooperationPage.advFlexibleScheduleTitle' })}</h3>
                <p className={css.advDesc}>
                  <FormattedMessage id="CooperationPage.advFlexibleScheduleDescription" values={{ br: <br /> }} />
                </p>
              </div>
            </div>

            <div className={css.advCard}>
              <div className={css.advText}>
                <h3 className={css.advTitle}>{intl.formatMessage({ id: 'CooperationPage.advRatingTitle' })}</h3>
                <p className={css.advDesc}>
                  <FormattedMessage id="CooperationPage.advRatingDescription" values={{ br: <br /> }} />
                </p>
              </div>
            </div>

            <div className={css.advCard}>
              <div className={css.advText}>
                <h3 className={css.advTitle}>{intl.formatMessage({ id: 'CooperationPage.advNoCommissionTitle' })}</h3>
                <p className={css.advDesc}>
                  <FormattedMessage id="CooperationPage.advNoCommissionDescription" values={{ br: <br /> }} />
                </p>
              </div>
            </div>
          </section>

         {/* ===== HOW IT WORKS ===== */}
<section className={css.howSection}>
  <div className={css.howContent}>

    {/* LEFT COLUMN */}
    <div className={css.howLeft}>
      <h2 className={css.howTitle}>{intl.formatMessage({ id: 'CooperationPage.howTitle' })}</h2>

      <p className={css.howSubtitle}>
        {intl.formatMessage({ id: 'CooperationPage.howSubtitle' })}
      </p>

      <div className={css.howSteps}>

        {/* STEP 1 */}
        <div className={css.step}>
          <div className={css.stepLeft}>
            <div className={css.stepCircle}>
              <div className={css.stepNumber}>1</div>
            </div>
            <div className={css.stepLine} />
          </div>

          <div className={css.stepText}>
            <h3 className={css.stepTitle}>{intl.formatMessage({ id: 'CooperationPage.step1Title' })}</h3>
            <p className={css.stepDesc}>
              {intl.formatMessage({ id: 'CooperationPage.step1Description' })}
            </p>
          </div>
        </div>

        {/* STEP 2 */}
        <div className={css.step}>
          <div className={css.stepLeft}>
            <div className={css.stepCircle}>
              <div className={css.stepNumber}>2</div>
            </div>
            <div className={css.stepLine} />
          </div>

          <div className={css.stepText}>
            <h3 className={css.stepTitle}>{intl.formatMessage({ id: 'CooperationPage.step2Title' })}</h3>
            <p className={css.stepDesc}>
              {intl.formatMessage({ id: 'CooperationPage.step2Description' })}
            </p>
          </div>
        </div>

        {/* STEP 3 */}
        <div className={`${css.step} ${css.stepLast}`}>
          <div className={css.stepLeft}>
            <div className={css.stepCircle}>
              <div className={css.stepNumber}>3</div>
            </div>
            <div className={css.stepLine} />
          </div>

          <div className={css.stepText}>
            <h3 className={css.stepTitle}>{intl.formatMessage({ id: 'CooperationPage.step3Title' })}</h3>
            <p className={css.stepDesc}>
              {intl.formatMessage({ id: 'CooperationPage.step3Description' })}
            </p>
          </div>
        </div>

        <NamedLink name="CooperationSignupPage" className={css.howBtn}>
          {intl.formatMessage({ id: 'CooperationPage.specialistSignup' })}
        </NamedLink>
      </div>
    </div>

    {/* RIGHT COLUMN — image */}
    <div className={css.howImage} />
  </div>
</section>


{/* ===== VERIFY ===== */}
      
<section className={css.verifySection}>
  <h2 className={css.verifyTitle}>{intl.formatMessage({ id: 'CooperationPage.verifyTitle' })}</h2>
  <p className={css.verifySubtitle}>
    {intl.formatMessage({ id: 'CooperationPage.verifySubtitle' })}
  </p>

  {/* Карточка 1 */}
  <div className={css.verifyRow}>
    <div className={css.verifyText}>
      <h3 className={css.verifyTextTitle}>{intl.formatMessage({ id: 'CooperationPage.verifyBenefitsTitle' })}</h3>
      <p className={css.verifyTextDesc}>
        <FormattedMessage id="CooperationPage.verifyBenefitsList" values={{ br: <br /> }} />
      </p>
    </div>

    <div className={css.verifyPic1} />
  </div>

  {/* Карточка 2 */}
  <div className={css.verifyRow}>
    <div className={css.verifyText}>
      <h3 className={css.verifyTextTitle}>{intl.formatMessage({ id: 'CooperationPage.verifyRequirementsTitle' })}</h3>
      <p className={css.verifyTextDesc}>
        <FormattedMessage id="CooperationPage.verifyRequirementsList" values={{ br: <br /> }} />
      </p>
    </div>

    <div className={css.verifyPic2} />
  </div>
</section>

         {/* CALL TO ACTION */}
        <section className={css.actionSection}>
          <div className={css.actionBox}>
            <div className={css.actionContent}>
              <div className={css.actionLogo} />

              <div className={css.actionRight}>
                <div className={css.actionTitleBlock}>
                  <h3 className={css.actionTitle}>{intl.formatMessage({ id: 'CooperationPage.actionTitle' })}</h3>
                  <p className={css.actionSubtitle}>
                    {intl.formatMessage({ id: 'CooperationPage.actionSubtitle' })}
                  </p>
                  
                  {/* Platform Statistics */}
                  {!statsLoading && (
                    <div className={css.statsBlock}>
                      <div className={css.statItem}>
                        <div className={css.statValue}>
                          {intl.formatNumber(animatedTasks)}
                        </div>
                        <div className={css.statLabel}>{intl.formatMessage({ id: 'CooperationPage.statTasksLabel' })}</div>
                      </div>
                      <div className={css.statDivider} />
                      <div className={css.statItem}>
                        <div className={css.statValue}>
                          {intl.formatNumber(animatedSum, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}{' '}
                          AED
                        </div>
                        <div className={css.statLabel}>{intl.formatMessage({ id: 'CooperationPage.statSumLabel' })}</div>
                      </div>
                    </div>
                  )}
                </div>

                <NamedLink name="CooperationSignupPage" className={css.actionBtn}>
                  {intl.formatMessage({ id: 'CooperationPage.becomeSpecialist' })}
                </NamedLink>
              </div>
            </div>
          </div>
        </section>


        {/* ===== REVIEWS ===== */}
<section className={css.reviewsSection}>
  <h2 className={css.reviewsTitle}>{intl.formatMessage({ id: 'CooperationPage.reviewsTitle' })}</h2>

  <div className={css.reviewsContent}>
    {/* ЛЕВАЯ КАРТОЧКА С ФОТО */}
    <div className={css.reviewImage}>
      <div className={css.reviewBadge}>
        <span className={css.reviewBadgeStar} />
        <span className={css.reviewBadgeValue}>5.0</span>
      </div>
    </div>

    {/* ПРАВАЯ КОЛОНКА С ТЕКСТОМ */}
    <div className={css.reviewRight}>
      <p className={css.reviewText}>
        {intl.formatMessage({ id: 'CooperationPage.review1Text' })}
      </p>

      <div className={css.reviewDivider} />

      <div className={css.reviewAuthor}>
        <div className={css.reviewAvatarOuter}>
          <div className={css.reviewAvatarInner} />
        </div>

        <div className={css.reviewAuthorInfo}>
          <div className={css.reviewAuthorName}>{intl.formatMessage({ id: 'CooperationPage.review1Author' })}</div>
          <div className={css.reviewRatingRow}>
            <span className={css.reviewRatingStar} />
            <span className={css.reviewRatingText}>{intl.formatMessage({ id: 'CooperationPage.review1Rating' })}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>


         {/* ===== REVIEW 2 ===== */}
<section className={css.reviewSectionAlt}>
  <div className={css.reviewsContentAlt}>

    {/* ЛЕВАЯ КОЛОНКА — текст */}
    <div className={css.reviewRightAlt}>
      <p className={css.reviewTextAlt}>
        {intl.formatMessage({ id: 'CooperationPage.review2Text' })}
      </p>

      <div className={css.reviewDividerAlt} />

      <div className={css.reviewAuthorAlt}>
        <div className={css.reviewAvatarOuterAlt}>
          <div className={css.reviewAvatarInnerAlt} />
        </div>

        <div className={css.reviewAuthorInfoAlt}>
          <div className={css.reviewAuthorNameAlt}>{intl.formatMessage({ id: 'CooperationPage.review2Author' })}</div>

          <div className={css.reviewRatingRowAlt}>
            <span className={css.reviewRatingStarAlt} />
            <span className={css.reviewRatingTextAlt}>{intl.formatMessage({ id: 'CooperationPage.review2Rating' })}</span>
          </div>
        </div>
      </div>
    </div>

    {/* ПРАВАЯ КОЛОНКА — фото */}
    <div className={css.reviewImageAlt}>
      <div className={css.reviewBadgeAlt}>
        <span className={css.reviewBadgeStarAlt} />
        <span className={css.reviewBadgeValueAlt}>4.9</span>
      </div>
    </div>

  </div>
</section>



        {/* ===== REVIEWS 3 ===== */}
<section className={css.reviewsSection3}>

  <div className={css.reviewsContent}>
    {/* ЛЕВАЯ КАРТОЧКА С ФОТО */}
    <div className={css.reviewImage3}>
      <div className={css.reviewBadge}>
        <span className={css.reviewBadgeStar} />
        <span className={css.reviewBadgeValue}>5.0</span>
      </div>
    </div>

    {/* ПРАВАЯ КОЛОНКА С ТЕКСТОМ */}
    <div className={css.reviewRight}>
      <p className={css.reviewText}>
        <FormattedMessage id="CooperationPage.review3Text" values={{ br: <br /> }} />
      </p>

      <div className={css.reviewDivider} />

      <div className={css.reviewAuthor}>
        <div className={css.reviewAvatarOuter}>
          <div className={css.reviewAvatarInner3} />
        </div>

        <div className={css.reviewAuthorInfo}>
          <div className={css.reviewAuthorName}>Ruslan B.</div>
          <div className={css.reviewRatingRow}>
            <span className={css.reviewRatingStar} />
            <span className={css.reviewRatingText}>{intl.formatMessage({ id: 'CooperationPage.review3Rating' })}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

{/* ===== PRESENTATION ===== */}
<section className={css.presentationSection}>
  <h2 className={css.presentationTitle}>{intl.formatMessage({ id: 'CooperationPage.presentationTitle' })}</h2>
  <p className={css.presentationSubtitle}>
    {intl.formatMessage({ id: 'CooperationPage.presentationSubtitle' })}
  </p>
  
  <div className={css.presentationContent}>
    <div className={css.pdfViewer}>
      <iframe
        src="/static/presentation/youdu-presentation.pdf"
        title={intl.formatMessage({ id: 'CooperationPage.presentationTitle' })}
        className={css.pdfFrame}
      />
    </div>
    
    <a
      href="/static/presentation/youdu-presentation.pdf"
      download={intl.formatMessage({ id: 'CooperationPage.presentationFileName' })}
      className={css.downloadBtn}
    >
      <svg className={css.downloadIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {intl.formatMessage({ id: 'CooperationPage.presentationDownload' })}
    </a>
  </div>
</section>

 {/* ===== FAQ ===== */}
<section className={css.faqSection}>
  <h2 className={css.faqHeading}>{intl.formatMessage({ id: 'CooperationPage.faqTitle' })}</h2>

  <div className={css.faqList}>
    {faqData.map((item, i) => {
      const open = openIndex === i;
      return (
        <div className={css.faqItem} key={i}>
          <button
            type="button"
            className={css.faqQuestion}
            onClick={() => toggle(i)}
          >
            <span className={css.faqTitle}>{item.question}</span>
            <span className={`${css.faqIcon} ${open ? css.faqIconOpen : ''}`} />
          </button>

          <div className={`${css.faqAnswer} ${open ? css.faqAnswerOpen : ''}`}>
            {item.answer}
          </div>
        </div>
      );
    })}
  </div>
</section>

          </div>
        </main>

        <FooterCustom />
      </div>
    </Page>
  );
};




export default CooperationPage;