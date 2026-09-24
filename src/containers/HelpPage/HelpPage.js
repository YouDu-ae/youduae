import React, { useState } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { useIntl } from '../../util/reactIntl';

import { Page, LayoutSingleColumn, H2, NamedLink } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './HelpPage.module.css';

const FAQ_CATEGORIES = [
  {
    id: 'general',
    items: ['whatIsYoudu', 'howToRegister', 'isItFree'],
  },
  {
    id: 'clients',
    items: ['howToCreateTask', 'howToChooseSpecialist', 'workNotDone', 'canCancelTask'],
  },
  {
    id: 'specialists',
    items: ['howToBecomeSpecialist', 'howToGetMoreOrders', 'whatIsCommission', 'howToWithdraw'],
  },
  {
    id: 'safety',
    items: ['isPaymentSafe', 'paymentMethods', 'avoidScammers'],
  },
];

const HELP_ARTICLES = [
  { id: 'getting-started', key: 'gettingStarted', icon: '🚀' },
  { id: 'create-task', key: 'createTask', icon: '📝' },
  { id: 'specialist-profile', key: 'specialistProfile', icon: '👤' },
  { id: 'payments', key: 'payments', icon: '💳' },
  { id: 'safety', key: 'safety', icon: '🔒' },
  { id: 'reviews', key: 'reviews', icon: '⭐' },
];

const capitalize = str => str.charAt(0).toUpperCase() + str.slice(1);

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

  const [openItems, setOpenItems] = useState({});
  const [activeCategory, setActiveCategory] = useState(0);

  const faqData = FAQ_CATEGORIES.map(cat => ({
    category: intl.formatMessage({ id: `HelpPage.faqCategory${capitalize(cat.id)}` }),
    items: cat.items.map(item => ({
      q: intl.formatMessage({ id: `HelpPage.faq${capitalize(item)}Question` }),
      a: intl.formatMessage({ id: `HelpPage.faq${capitalize(item)}Answer` }),
    })),
  }));
  const articles = HELP_ARTICLES.map(article => ({
    id: article.id,
    icon: article.icon,
    title: intl.formatMessage({ id: `HelpPage.article${capitalize(article.key)}Title` }),
    description: intl.formatMessage({
      id: `HelpPage.article${capitalize(article.key)}Description`,
    }),
  }));

  const toggleItem = (categoryIndex, itemIndex) => {
    const key = `${categoryIndex}-${itemIndex}`;
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const title = intl.formatMessage({ id: 'HelpPage.schemaTitle' });
  const description = intl.formatMessage({ id: 'HelpPage.schemaDescription' });

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
              {intl.formatMessage({ id: 'HelpPage.title' })}
            </H2>

            <p className={css.pageSubtitle}>
              {intl.formatMessage({ id: 'HelpPage.subtitle' })}
            </p>

            {/* Quick Links */}
            <div className={css.quickLinks}>
              <NamedLink name="SupportPage" className={css.quickLink}>
                <span className={css.quickLinkIcon}>💬</span>
                <span>{intl.formatMessage({ id: 'HelpPage.writeToSupport' })}</span>
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
                {intl.formatMessage({ id: 'HelpPage.articlesTitle' })}
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
                {intl.formatMessage({ id: 'HelpPage.faqTitle' })}
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
              <h3>{intl.formatMessage({ id: 'HelpPage.stillNeedHelpTitle' })}</h3>
              <p>
                {intl.formatMessage({ id: 'HelpPage.stillNeedHelpText' })}
              </p>
              <NamedLink name="SupportPage" className={css.supportButton}>
                {intl.formatMessage({ id: 'HelpPage.contactSupport' })}
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
