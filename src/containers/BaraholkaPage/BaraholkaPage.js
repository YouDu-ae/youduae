import React from 'react';
import { Helmet } from 'react-helmet-async';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { Page, LayoutSingleColumn, NamedLink } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './BaraholkaPage.module.css';

const CANONICAL_URL = 'https://youdu.ae/baraholka-dubai';

const TELEGRAM_GROUPS = [
  {
    nameId: 'BaraholkaPage.group1Name',
    handle: '@baraholkadubae',
    url: 'https://t.me/baraholkadubae',
    members: 25000,
    descriptionId: 'BaraholkaPage.group1Description',
  },
  {
    nameId: 'BaraholkaPage.group2Name',
    handle: '@prodai_dubai',
    url: 'https://t.me/prodai_dubai',
    members: 22000,
    descriptionId: 'BaraholkaPage.group2Description',
  },
  {
    nameId: 'BaraholkaPage.group3Name',
    handle: '@dubaibaraholka',
    url: 'https://t.me/dubaibaraholka',
    members: 6000,
    descriptionId: 'BaraholkaPage.group3Description',
  },
];

const PLATFORMS = [
  {
    id: 'telegram',
    nameId: 'BaraholkaPage.platformTelegramName',
    goodIds: [
      'BaraholkaPage.platformTelegramGood1',
      'BaraholkaPage.platformTelegramGood2',
      'BaraholkaPage.platformTelegramGood3',
      'BaraholkaPage.platformTelegramGood4',
    ],
    badIds: [
      'BaraholkaPage.platformTelegramBad1',
      'BaraholkaPage.platformTelegramBad2',
    ],
    whoId: 'BaraholkaPage.platformTelegramWho',
  },
  {
    id: 'dubizzle',
    name: 'Dubizzle',
    goodIds: [
      'BaraholkaPage.platformDubizzleGood1',
      'BaraholkaPage.platformDubizzleGood2',
      'BaraholkaPage.platformDubizzleGood3',
    ],
    badIds: [
      'BaraholkaPage.platformDubizzleBad1',
      'BaraholkaPage.platformDubizzleBad2',
    ],
    whoId: 'BaraholkaPage.platformDubizzleWho',
  },
  {
    id: 'facebook',
    name: 'Facebook Marketplace',
    goodIds: [
      'BaraholkaPage.platformFacebookGood1',
      'BaraholkaPage.platformFacebookGood2',
    ],
    badIds: [
      'BaraholkaPage.platformFacebookBad1',
      'BaraholkaPage.platformFacebookBad2',
    ],
    whoId: 'BaraholkaPage.platformFacebookWho',
  },
  {
    id: 'buildingChats',
    nameId: 'BaraholkaPage.platformBuildingChatsName',
    goodIds: [
      'BaraholkaPage.platformBuildingChatsGood1',
      'BaraholkaPage.platformBuildingChatsGood2',
    ],
    badIds: ['BaraholkaPage.platformBuildingChatsBad1'],
    whoId: 'BaraholkaPage.platformBuildingChatsWho',
  },
];

const SAFETY_RULES = [1, 2, 3, 4, 5].map(n => ({
  titleId: `BaraholkaPage.safety${n}Title`,
  textId: `BaraholkaPage.safety${n}Text`,
}));

const FAQ = [1, 2, 3, 4, 5, 6].map(n => ({
  questionId: `BaraholkaPage.faq${n}Question`,
  answerId: `BaraholkaPage.faq${n}Answer`,
}));

const SERVICES = [
  {
    titleId: 'BaraholkaPage.service1Title',
    textId: 'BaraholkaPage.service1Text',
    categoryId: 'Cargo_transportation',
    sub: 'Moving',
  },
  {
    titleId: 'BaraholkaPage.service2Title',
    textId: 'BaraholkaPage.service2Text',
    categoryId: 'Cargo_transportation',
    sub: 'Garbage_removal',
  },
  {
    titleId: 'BaraholkaPage.service3Title',
    textId: 'BaraholkaPage.service3Text',
    categoryId: 'repairs_main',
    sub: 'Carpenter',
  },
  {
    titleId: 'BaraholkaPage.service4Title',
    textId: 'BaraholkaPage.service4Text',
    categoryId: 'Installation_mashines',
    sub: null,
  },
  {
    titleId: 'BaraholkaPage.service5Title',
    textId: 'BaraholkaPage.service5Text',
    categoryId: 'Delivery',
    sub: 'buy_delivery',
  },
];

const BaraholkaPage = () => {
  const intl = useIntl();
  const t = id => intl.formatMessage({ id });
  const seoTitle = t('BaraholkaPage.seoTitle');
  const seoDescription = t('BaraholkaPage.seoDescription');

  const pageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: seoTitle,
    description: seoDescription,
    url: CANONICAL_URL,
    inLanguage: intl.locale,
    about: {
      '@type': 'Thing',
      name: t('BaraholkaPage.schemaAbout'),
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: t('BaraholkaPage.breadcrumbHome'),
          item: 'https://youdu.ae',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: t('BaraholkaPage.breadcrumbCurrent'),
          item: CANONICAL_URL,
        },
      ],
    },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(item => ({
      '@type': 'Question',
      name: t(item.questionId),
      acceptedAnswer: { '@type': 'Answer', text: t(item.answerId) },
    })),
  };

  return (
    <Page
      title={seoTitle}
      description={seoDescription}
      scrollingDisabled={false}
      schema={pageSchema}
    >
      <Helmet>
        <link rel="canonical" href={CANONICAL_URL} />
        <meta name="keywords" content={t('BaraholkaPage.seoKeywords')} />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <LayoutSingleColumn topbar={<TopbarContainer />} footer={<FooterContainer />}>
        <div className={css.root}>
          <header className={css.hero}>
            <h1 className={css.title}>
              <FormattedMessage id="BaraholkaPage.heroTitle" />
            </h1>
            <p className={css.lead}>
              <FormattedMessage id="BaraholkaPage.heroLead" />
            </p>
          </header>

          <section className={css.groupsSection}>
            <h2 className={css.groupsSectionTitle}>
              <FormattedMessage id="BaraholkaPage.groupsTitle" />
            </h2>
            <p className={css.groupsSectionLead}>
              <FormattedMessage id="BaraholkaPage.groupsLead" />
            </p>
            <div className={css.groupsGrid}>
              {TELEGRAM_GROUPS.map(group => (
                <div className={css.groupCard} key={group.handle}>
                  <div className={css.groupHeader}>
                    <span className={css.groupName}>
                      <FormattedMessage id={group.nameId} />
                    </span>
                    <span className={css.groupMembers}>
                      <FormattedMessage
                        id="BaraholkaPage.groupMembers"
                        values={{ count: intl.formatNumber(group.members) }}
                      />
                    </span>
                  </div>
                  <p className={css.groupHandle}>{group.handle}</p>
                  <p className={css.groupText}>
                    <FormattedMessage id={group.descriptionId} />
                  </p>
                  <a
                    className={css.groupButton}
                    href={group.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FormattedMessage id="BaraholkaPage.openGroup" />
                  </a>
                </div>
              ))}
            </div>
          </section>

          <section className={css.section}>
            <h2 className={css.sectionTitle}>
              <FormattedMessage id="BaraholkaPage.platformsTitle" />
            </h2>
            <div className={css.platforms}>
              {PLATFORMS.map(platform => (
                <article className={css.platform} key={platform.id}>
                  <h3 className={css.platformName}>
                    {platform.nameId ? <FormattedMessage id={platform.nameId} /> : platform.name}
                  </h3>
                  <p className={css.platformWho}>
                    <FormattedMessage id={platform.whoId} />
                  </p>
                  <ul className={css.pros}>
                    {platform.goodIds.map(id => (
                      <li key={id}>
                        <FormattedMessage id={id} />
                      </li>
                    ))}
                  </ul>
                  <ul className={css.cons}>
                    {platform.badIds.map(id => (
                      <li key={id}>
                        <FormattedMessage id={id} />
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className={css.section}>
            <h2 className={css.sectionTitle}>
              <FormattedMessage id="BaraholkaPage.safetyTitle" />
            </h2>
            <p className={css.sectionLead}>
              <FormattedMessage id="BaraholkaPage.safetyLead" />
            </p>
            <ol className={css.rules}>
              {SAFETY_RULES.map(rule => (
                <li className={css.rule} key={rule.titleId}>
                  <h3 className={css.ruleTitle}>
                    <FormattedMessage id={rule.titleId} />
                  </h3>
                  <p className={css.ruleText}>
                    <FormattedMessage id={rule.textId} />
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section className={css.section}>
            <h2 className={css.sectionTitle}>
              <FormattedMessage id="BaraholkaPage.faqTitle" />
            </h2>
            <div className={css.faq}>
              {FAQ.map(item => (
                <details className={css.faqItem} key={item.questionId}>
                  <summary className={css.faqQuestion}>
                    <FormattedMessage id={item.questionId} />
                  </summary>
                  <p className={css.faqAnswer}>
                    <FormattedMessage id={item.answerId} />
                  </p>
                </details>
              ))}
            </div>
          </section>

          <section className={css.section}>
            <h2 className={css.sectionTitle}>
              <FormattedMessage id="BaraholkaPage.servicesTitle" />
            </h2>
            <p className={css.sectionLead}>
              <FormattedMessage id="BaraholkaPage.servicesLead" />
            </p>
            <div className={css.services}>
              {SERVICES.map(service => (
                <NamedLink
                  className={css.service}
                  key={service.titleId}
                  name="CategoryExecutorsPage"
                  params={{ categoryId: service.categoryId }}
                  to={service.sub ? { search: `?sub=${service.sub}` } : undefined}
                >
                  <span className={css.serviceTitle}>
                    <FormattedMessage id={service.titleId} />
                  </span>
                  <span className={css.serviceText}>
                    <FormattedMessage id={service.textId} />
                  </span>
                </NamedLink>
              ))}
            </div>
          </section>
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default BaraholkaPage;
