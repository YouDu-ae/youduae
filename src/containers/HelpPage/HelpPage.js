import React, { useState } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { useIntl } from '../../util/reactIntl';

import { Page, LayoutSingleColumn, H2, NamedLink } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './HelpPage.module.css';

const FAQ_DATA = {
  ru: [
    {
      category: 'Общие вопросы',
      items: [
        {
          q: 'Что такое YouDu?',
          a: 'YouDu — это платформа для поиска исполнителей и заказчиков в ОАЭ. Заказчики публикуют задания, а специалисты откликаются на них и предлагают свои услуги.',
        },
        {
          q: 'Как зарегистрироваться на YouDu?',
          a: 'Нажмите "Войти" в правом верхнем углу, затем выберите "Зарегистрироваться". Вы можете зарегистрироваться через email или с помощью Google/Apple аккаунта.',
        },
        {
          q: 'YouDu бесплатный?',
          a: 'Регистрация и создание заданий бесплатны. Специалисты платят комиссию только после успешного выполнения задания.',
        },
      ],
    },
    {
      category: 'Для заказчиков',
      items: [
        {
          q: 'Как создать задание?',
          a: 'Нажмите "Создать задание", опишите что вам нужно, укажите бюджет и сроки. После публикации специалисты начнут присылать отклики.',
        },
        {
          q: 'Как выбрать специалиста?',
          a: 'Просмотрите профили откликнувшихся специалистов, их рейтинг, отзывы и портфолио. Выберите наиболее подходящего и назначьте его исполнителем.',
        },
        {
          q: 'Что делать если специалист не выполнил работу?',
          a: 'Свяжитесь с нашей службой поддержки через раздел "Поддержка". Мы поможем разрешить спорную ситуацию.',
        },
        {
          q: 'Могу ли я отменить задание?',
          a: 'Да, вы можете отменить задание до назначения исполнителя. После назначения отмена возможна по согласованию со специалистом.',
        },
      ],
    },
    {
      category: 'Для специалистов',
      items: [
        {
          q: 'Как стать специалистом на YouDu?',
          a: 'При регистрации выберите "Я специалист", заполните профиль, добавьте портфолио и начните откликаться на задания.',
        },
        {
          q: 'Как увеличить количество заказов?',
          a: 'Заполните профиль полностью, добавьте фото работ в портфолио, пройдите верификацию и собирайте положительные отзывы.',
        },
        {
          q: 'Какая комиссия сервиса?',
          a: 'Комиссия составляет 10-15% от суммы заказа. Точный процент зависит от категории услуг.',
        },
        {
          q: 'Как вывести заработанные деньги?',
          a: 'Перейдите в раздел "Выплаты" в настройках профиля, подключите способ вывода и запросите выплату.',
        },
      ],
    },
    {
      category: 'Безопасность и оплата',
      items: [
        {
          q: 'Безопасно ли платить через YouDu?',
          a: 'Да, все платежи защищены. Деньги переводятся исполнителю только после подтверждения выполнения работы заказчиком.',
        },
        {
          q: 'Какие способы оплаты доступны?',
          a: 'Банковские карты (Visa, Mastercard), Apple Pay, Google Pay. В некоторых категориях доступна оплата наличными.',
        },
        {
          q: 'Как защититься от мошенников?',
          a: 'Работайте только через платформу, не переводите деньги напрямую, проверяйте рейтинг и отзывы специалистов.',
        },
      ],
    },
  ],
  en: [
    {
      category: 'General Questions',
      items: [
        {
          q: 'What is YouDu?',
          a: 'YouDu is a platform for finding service providers and clients in the UAE. Clients post tasks, and specialists respond with their offers.',
        },
        {
          q: 'How do I register on YouDu?',
          a: 'Click "Login" in the top right corner, then select "Sign up". You can register via email or using your Google/Apple account.',
        },
        {
          q: 'Is YouDu free?',
          a: 'Registration and posting tasks are free. Specialists pay a commission only after successfully completing a task.',
        },
      ],
    },
    {
      category: 'For Clients',
      items: [
        {
          q: 'How do I create a task?',
          a: 'Click "Create Task", describe what you need, set a budget and deadline. After publishing, specialists will start sending responses.',
        },
        {
          q: 'How do I choose a specialist?',
          a: 'Review profiles of responding specialists, their ratings, reviews, and portfolios. Select the most suitable one and assign them.',
        },
        {
          q: 'What if the specialist doesn\'t complete the work?',
          a: 'Contact our support team through the "Support" section. We will help resolve the dispute.',
        },
        {
          q: 'Can I cancel a task?',
          a: 'Yes, you can cancel a task before assigning a specialist. After assignment, cancellation is possible by agreement with the specialist.',
        },
      ],
    },
    {
      category: 'For Specialists',
      items: [
        {
          q: 'How do I become a specialist on YouDu?',
          a: 'During registration, select "I\'m a specialist", complete your profile, add a portfolio, and start responding to tasks.',
        },
        {
          q: 'How can I get more orders?',
          a: 'Complete your profile fully, add work photos to your portfolio, get verified, and collect positive reviews.',
        },
        {
          q: 'What is the service commission?',
          a: 'The commission is 10-15% of the order amount. The exact percentage depends on the service category.',
        },
        {
          q: 'How do I withdraw earned money?',
          a: 'Go to "Payouts" in your profile settings, connect a withdrawal method, and request a payout.',
        },
      ],
    },
    {
      category: 'Security and Payment',
      items: [
        {
          q: 'Is it safe to pay through YouDu?',
          a: 'Yes, all payments are protected. Money is transferred to the specialist only after the client confirms the work is complete.',
        },
        {
          q: 'What payment methods are available?',
          a: 'Bank cards (Visa, Mastercard), Apple Pay, Google Pay. Cash payment is available in some categories.',
        },
        {
          q: 'How to protect yourself from scammers?',
          a: 'Work only through the platform, don\'t transfer money directly, check specialist ratings and reviews.',
        },
      ],
    },
  ],
};

const HELP_ARTICLES = {
  ru: [
    {
      id: 'getting-started',
      title: 'Начало работы',
      description: 'Как начать пользоваться YouDu',
      icon: '🚀',
    },
    {
      id: 'create-task',
      title: 'Как создать задание',
      description: 'Пошаговая инструкция для заказчиков',
      icon: '📝',
    },
    {
      id: 'specialist-profile',
      title: 'Настройка профиля специалиста',
      description: 'Как заполнить профиль и привлечь клиентов',
      icon: '👤',
    },
    {
      id: 'payments',
      title: 'Оплата и выплаты',
      description: 'Как работают платежи на платформе',
      icon: '💳',
    },
    {
      id: 'safety',
      title: 'Безопасность',
      description: 'Советы по безопасной работе',
      icon: '🔒',
    },
    {
      id: 'reviews',
      title: 'Отзывы и рейтинг',
      description: 'Как работает система отзывов',
      icon: '⭐',
    },
  ],
  en: [
    {
      id: 'getting-started',
      title: 'Getting Started',
      description: 'How to start using YouDu',
      icon: '🚀',
    },
    {
      id: 'create-task',
      title: 'How to Create a Task',
      description: 'Step-by-step guide for clients',
      icon: '📝',
    },
    {
      id: 'specialist-profile',
      title: 'Specialist Profile Setup',
      description: 'How to complete your profile and attract clients',
      icon: '👤',
    },
    {
      id: 'payments',
      title: 'Payments and Payouts',
      description: 'How payments work on the platform',
      icon: '💳',
    },
    {
      id: 'safety',
      title: 'Safety',
      description: 'Tips for safe work',
      icon: '🔒',
    },
    {
      id: 'reviews',
      title: 'Reviews and Rating',
      description: 'How the review system works',
      icon: '⭐',
    },
  ],
};

const FAQItem = ({ question, answer, isOpen, onClick }) => (
  <div className={css.faqItem}>
    <button className={css.faqQuestion} onClick={onClick} aria-expanded={isOpen}>
      <span>{question}</span>
      <span className={`${css.faqArrow} ${isOpen ? css.faqArrowOpen : ''}`}>▼</span>
    </button>
    {isOpen && <div className={css.faqAnswer}>{answer}</div>}
  </div>
);

const HelpPageComponent = props => {
  const { scrollingDisabled } = props;
  const intl = useIntl();
  const locale = intl.locale || 'ru';

  const [openItems, setOpenItems] = useState({});
  const [activeCategory, setActiveCategory] = useState(0);

  const faqData = FAQ_DATA[locale] || FAQ_DATA.ru;
  const articles = HELP_ARTICLES[locale] || HELP_ARTICLES.ru;

  const toggleItem = (categoryIndex, itemIndex) => {
    const key = `${categoryIndex}-${itemIndex}`;
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const title = locale === 'ru' ? 'База знаний | YouDu' : 'Help Center | YouDu';
  const description = locale === 'ru'
    ? 'Ответы на частые вопросы и справочные материалы YouDu'
    : 'Answers to frequently asked questions and YouDu help articles';

  // Generate FAQ Schema for SEO
  const allFaqItems = faqData.flatMap(cat => cat.items);
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: allFaqItems.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };

  return (
    <Page
      title={title}
      description={description}
      scrollingDisabled={scrollingDisabled}
      schema={faqSchema}
    >
      <LayoutSingleColumn topbar={<TopbarContainer />} footer={<FooterContainer />}>
        <div className={css.pageWrapper}>
          <div className={css.container}>
            <H2 className={css.pageTitle}>
              {locale === 'ru' ? 'База знаний' : 'Help Center'}
            </H2>

            <p className={css.pageSubtitle}>
              {locale === 'ru'
                ? 'Найдите ответы на ваши вопросы или обратитесь в поддержку'
                : 'Find answers to your questions or contact support'}
            </p>

            {/* Quick Links */}
            <div className={css.quickLinks}>
              <NamedLink name="SupportPage" className={css.quickLink}>
                <span className={css.quickLinkIcon}>💬</span>
                <span>{locale === 'ru' ? 'Написать в поддержку' : 'Contact Support'}</span>
              </NamedLink>
              <a
                href="https://t.me/youdu_ae"
                target="_blank"
                rel="noopener noreferrer"
                className={css.quickLink}
              >
                <span className={css.quickLinkIcon}>📱</span>
                <span>Telegram</span>
              </a>
            </div>

            {/* Help Articles */}
            <section className={css.articlesSection}>
              <h3 className={css.sectionTitle}>
                {locale === 'ru' ? 'Справочные материалы' : 'Help Articles'}
              </h3>
              <div className={css.articlesGrid}>
                {articles.map(article => (
                  <div key={article.id} className={css.articleCard}>
                    <span className={css.articleIcon}>{article.icon}</span>
                    <h4 className={css.articleTitle}>{article.title}</h4>
                    <p className={css.articleDescription}>{article.description}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* FAQ Section */}
            <section className={css.faqSection}>
              <h3 className={css.sectionTitle}>
                {locale === 'ru' ? 'Часто задаваемые вопросы' : 'Frequently Asked Questions'}
              </h3>

              {/* Category Tabs */}
              <div className={css.categoryTabs}>
                {faqData.map((cat, idx) => (
                  <button
                    key={idx}
                    className={`${css.categoryTab} ${activeCategory === idx ? css.categoryTabActive : ''}`}
                    onClick={() => setActiveCategory(idx)}
                  >
                    {cat.category}
                  </button>
                ))}
              </div>

              {/* FAQ Items */}
              <div className={css.faqList}>
                {faqData[activeCategory].items.map((item, itemIdx) => (
                  <FAQItem
                    key={itemIdx}
                    question={item.q}
                    answer={item.a}
                    isOpen={openItems[`${activeCategory}-${itemIdx}`]}
                    onClick={() => toggleItem(activeCategory, itemIdx)}
                  />
                ))}
              </div>
            </section>

            {/* Still Need Help */}
            <div className={css.stillNeedHelp}>
              <h3>{locale === 'ru' ? 'Не нашли ответ?' : "Didn't find an answer?"}</h3>
              <p>
                {locale === 'ru'
                  ? 'Наша команда поддержки готова помочь вам'
                  : 'Our support team is ready to help you'}
              </p>
              <NamedLink name="SupportPage" className={css.supportButton}>
                {locale === 'ru' ? 'Связаться с поддержкой' : 'Contact Support'}
              </NamedLink>
            </div>
          </div>
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => ({
  scrollingDisabled: false,
});

const HelpPage = compose(connect(mapStateToProps))(HelpPageComponent);

export default HelpPage;
