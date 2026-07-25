import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { NamedLink, Page } from '../../components';
import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import FooterCustom from '../FooterCustom/FooterCustom';
import { getPlatformStats } from '../../util/api';

import css from './CooperationPage.module.css';

// SEO content
const SEO_TITLE = 'Стать специалистом YouDu | Работа в ОАЭ без комиссии';
const SEO_DESCRIPTION = 'Зарабатывайте на своих навыках с YouDu в Дубае и ОАЭ. Находите заказы рядом, предлагайте свою цену, работайте по гибкому графику. Без комиссии и скрытых платежей. Регистрация бесплатна.';
const SEO_KEYWORDS = 'работа в ОАЭ, подработка Дубай, фриланс ОАЭ, найти работу Дубай, специалист YouDu, заработок в Эмиратах, услуги Дубай, мастер на час, ремонт Дубай, клининг ОАЭ';
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

const CooperationPage = () => {
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

  const faqData = [
  {
    question: "Нужно ли проходить верификацию?",
    answer: "Можно и без неё, но верифицированные мастера получают приоритет показа и больше заказов."
  },
  {
    question: "Сколько это стоит?",
    answer: "Регистрация специалиста бесплатна.  Комиссий за сделки нет, оплаты за отклики тоже нет."
  },
  {
    question: "Сколько можно заработать через YouDu?",
    answer: "Все зависит от количества ваших откликов и рейтинга. Вы сами регулируете это."
  },
   {
    question: "Как формируется рейтинг?",
    answer: "Рейтинг основан на отзывах клиентов и качестве выполненных заданий. Verified-отзывы влияют сильнее."
  },
   {
    question: "Как выбрать удобные районы для работы?",
    answer: "Укажите районы/радиус в профиле и мы покажем задания рядом."
  },
   {
    question: "Можно ли пропускать задания?",
    answer: "Да. Вы сами решаете, когда и на какие задания откликаться."
  },
   {
    question: "Как повысить шанс, что выберут мой отклик?",
    answer: "Заполните профиль, пройдите верификацию, прикладывайте фото работ и пишите конкретное предложение с чёткой ценой и сроками."
  }
];

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
      description: 'Платформа для поиска специалистов и заказов в ОАЭ',
      areaServed: {
        '@type': 'Country',
        name: 'United Arab Emirates'
      },
      serviceType: ['Ремонт', 'Клининг', 'Репетиторы', 'Красота', 'Доставка', 'IT услуги']
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Главная',
          item: 'https://youdu.ae'
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Для специалистов',
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

  return (
    <Page
      title={SEO_TITLE}
      description={SEO_DESCRIPTION}
      schema={schemaData}
    >
      <Helmet>
        <link rel="canonical" href={CANONICAL_URL} />
        <meta name="keywords" content={SEO_KEYWORDS} />
        <meta name="robots" content="index, follow" />
        
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={CANONICAL_URL} />
        <meta property="og:title" content={SEO_TITLE} />
        <meta property="og:description" content={SEO_DESCRIPTION} />
        <meta property="og:image" content="https://youdu.ae/static/icons/youdu-og-cooperation.png" />
        <meta property="og:locale" content="ru_RU" />
        <meta property="og:site_name" content="YouDu" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={SEO_TITLE} />
        <meta name="twitter:description" content={SEO_DESCRIPTION} />
        <meta name="twitter:image" content="https://youdu.ae/static/icons/youdu-og-cooperation.png" />
        
        {/* Additional SEO for AI assistants */}
        <meta name="subject" content="Работа для специалистов в ОАЭ" />
        <meta name="topic" content="Фриланс и подработка в Дубае" />
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
                Зарабатывайте на своих навыках с YouDu
            </h1>

            <p className={css.heroSubtitle}>
              Выбирайте задания поблизости, предлагайте цену, получайте оплату
            </p>

            <NamedLink name="CooperationSignupPage" className={css.heroBtn}>
              Стать специалистом
            </NamedLink>
          </section>

          {/* Фоновая картинка */}
          <div className={css.bgMain} aria-hidden="true" />

          {/* ===== ADVANTAGES ===== */}
          <section className={css.advantages}>
            <div className={css.advCard}>
              <div className={css.advText}>
                <h3 className={css.advTitle}>Своя цена</h3>
                <p className={css.advDesc}>
                  Откликайтесь и предлагайте<br />комфортную стоимость<br />на ваши услуги
                </p>
              </div>
            </div>

            <div className={css.advCard}>
              <div className={css.advText}>
                <h3 className={css.advTitle}>Гибкий график</h3>
                <p className={css.advDesc}>
                  Работайте, когда удобно.<br />Вы работаете на себя и сами<br />устраиваете выходные
                </p>
              </div>
            </div>

            <div className={css.advCard}>
              <div className={css.advText}>
                <h3 className={css.advTitle}>Рейтинг и отзывы</h3>
                <p className={css.advDesc}>
                  Получайте отзывы<br />и поднимайтесь выше в поиске,<br />читайте отзывы о заказчиках
                </p>
              </div>
            </div>

            <div className={css.advCard}>
              <div className={css.advText}>
                <h3 className={css.advTitle}>Нет комиссии</h3>
                <p className={css.advDesc}>
                  Наш сервис не берёт<br />комиссию с вас,<br />никаких скрытых платежей
                </p>
              </div>
            </div>
          </section>

         {/* ===== HOW IT WORKS ===== */}
<section className={css.howSection}>
  <div className={css.howContent}>

    {/* LEFT COLUMN */}
    <div className={css.howLeft}>
      <h2 className={css.howTitle}>Как это работает</h2>

      <p className={css.howSubtitle}>
        Мы работаем, чтобы сделать условия работы для вас комфортными
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
            <h3 className={css.stepTitle}>Профиль специалиста</h3>
            <p className={css.stepDesc}>
              Создайте профиль. Выберите категории, районы и добавьте фото работ,
              чтобы заказчикам было проще довериться вам
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
            <h3 className={css.stepTitle}>Отклик и цена</h3>
            <p className={css.stepDesc}>
              Находите подходящие задания, отправляйте предложение и вашу цену,
              общайтесь в чате с заказчиком
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
            <h3 className={css.stepTitle}>Работа и отзыв</h3>
            <p className={css.stepDesc}>
              Выполните задание, получите оплату, получите отзыв
              и оставьте отзыв заказчику
            </p>
          </div>
        </div>

        <NamedLink name="CooperationSignupPage" className={css.howBtn}>
          Регистрация специалиста
        </NamedLink>
      </div>
    </div>

    {/* RIGHT COLUMN — image */}
    <div className={css.howImage} />
  </div>
</section>


{/* ===== VERIFY ===== */}
      
<section className={css.verifySection}>
  <h2 className={css.verifyTitle}>Верификация = больше заказов</h2>
  <p className={css.verifySubtitle}>
    Пройдите верификацию и поднимитесь в поисковой выдаче сервиса
  </p>

  {/* Карточка 1 */}
  <div className={css.verifyRow}>
    <div className={css.verifyText}>
      <h3 className={css.verifyTextTitle}>Что даёт верификация</h3>
      <p className={css.verifyTextDesc}>
        • Бейдж доверия в профиле и откликах<br />
        • Приоритет показа отклика над неверифицированными<br />
        • Больше просмотров и откликов от клиентов
      </p>
    </div>

    <div className={css.verifyPic1} />
  </div>

  {/* Карточка 2 */}
  <div className={css.verifyRow}>
    <div className={css.verifyText}>
      <h3 className={css.verifyTextTitle}>Что потребуется (один из вариантов)</h3>
      <p className={css.verifyTextDesc}>
        • Emirates ID / паспорт (для физлиц)<br />
        • Trade License (для компаний)<br />
        • По запросу – селфи / подтверждение адреса
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
                  <h3 className={css.actionTitle}>Зарабатывайте с YouDu</h3>
                  <p className={css.actionSubtitle}>
                    Экономьте на рекламе, получайте клиентов
                  </p>
                  
                  {/* Platform Statistics */}
                  {!statsLoading && (
                    <div className={css.statsBlock}>
                      <div className={css.statItem}>
                        <div className={css.statValue}>
                          {animatedTasks.toLocaleString('ru-RU')}
                        </div>
                        <div className={css.statLabel}>заданий на платформе</div>
                      </div>
                      <div className={css.statDivider} />
                      <div className={css.statItem}>
                        <div className={css.statValue}>
                          {animatedSum.toLocaleString('ru-RU', { 
                            minimumFractionDigits: 0, 
                            maximumFractionDigits: 0 
                          })} AED
                        </div>
                        <div className={css.statLabel}>общая сумма заданий</div>
                      </div>
                    </div>
                  )}
                </div>

                <NamedLink name="CooperationSignupPage" className={css.actionBtn}>
                  Стать специалистом
                </NamedLink>
              </div>
            </div>
          </div>
        </section>


        {/* ===== REVIEWS ===== */}
<section className={css.reviewsSection}>
  <h2 className={css.reviewsTitle}>Отзывы специалистов</h2>

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
        Сервис помогает мне зарабатывать онлайн и находить клиентов. Плюс,
        я сама выбираю, когда мне брать клиентов. Это очень удобно!
      </p>

      <div className={css.reviewDivider} />

      <div className={css.reviewAuthor}>
        <div className={css.reviewAvatarOuter}>
          <div className={css.reviewAvatarInner} />
        </div>

        <div className={css.reviewAuthorInfo}>
          <div className={css.reviewAuthorName}>Дебушева Вероника</div>
          <div className={css.reviewRatingRow}>
            <span className={css.reviewRatingStar} />
            <span className={css.reviewRatingText}>5 Английский язык</span>
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
        На YouDu нашла себе постоянных клиентов и отрегулировала доход.
        Теперь мне, как человеку в эмиграции стало проще жить и не переживать.
      </p>

      <div className={css.reviewDividerAlt} />

      <div className={css.reviewAuthorAlt}>
        <div className={css.reviewAvatarOuterAlt}>
          <div className={css.reviewAvatarInnerAlt} />
        </div>

        <div className={css.reviewAuthorInfoAlt}>
          <div className={css.reviewAuthorNameAlt}>Эльвира Муратовна</div>

          <div className={css.reviewRatingRowAlt}>
            <span className={css.reviewRatingStarAlt} />
            <span className={css.reviewRatingTextAlt}>4.9 Клининг</span>
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
        Началось все с подработки в свободное время, но наработал репутацию, 
        сейчас заказчики рекомендуют меня другим. <br />Не ожидал, что вырасту в этой сфере.
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
            <span className={css.reviewRatingText}>5 Ремонты</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

{/* ===== PRESENTATION ===== */}
<section className={css.presentationSection}>
  <h2 className={css.presentationTitle}>Презентация YouDu</h2>
  <p className={css.presentationSubtitle}>
    Узнайте больше о возможностях платформы
  </p>
  
  <div className={css.presentationContent}>
    <div className={css.pdfViewer}>
      <iframe
        src="/static/presentation/youdu-presentation.pdf"
        title="Презентация YouDu"
        className={css.pdfFrame}
      />
    </div>
    
    <a
      href="/static/presentation/youdu-presentation.pdf"
      download="Презентация YouDu.pdf"
      className={css.downloadBtn}
    >
      <svg className={css.downloadIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Скачать презентацию (PDF)
    </a>
  </div>
</section>

 {/* ===== FAQ ===== */}
<section className={css.faqSection}>
  <h2 className={css.faqHeading}>Частые вопросы</h2>

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