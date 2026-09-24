import React from 'react';
import { NamedLink } from '../../components';
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import css from './LandingPage.module.css';

const LandingHero = () => {
  const intl = useIntl();
  return (
    <section className={css.heroWrap} aria-labelledby="heroTitle">
      {/* фоновая иллюстрация + подложка */}
      <div className={css.mainBg} />
      <div className={css.illustrationBack} />

      {/* контент слева */}
      <div className={css.hero}>
        <div className={css.heroTexts}>
          <h1 id="heroTitle" className={css.heroTitle}>
            <FormattedMessage id="LandingHero.title" />
          </h1>
          <p className={css.heroSubtitle}>
            <FormattedMessage id="LandingHero.subtitle" />
          </p>

          <div className={css.searchLine}>
            <input
              className={css.searchInput}
              type="text"
              placeholder={intl.formatMessage({ id: 'LandingPage.searchPlaceholder' })}
              aria-label={intl.formatMessage({ id: 'LandingHero.searchAriaLabel' })}
            />
            <NamedLink name="SearchPage" className={css.findBtn}>
              <FormattedMessage id="LandingPage.findButton" />
            </NamedLink>
          </div>
        </div>

        {/* преимущества */}
        <div className={css.advantages}>
          <div className={css.advItem}>
            <div className={css.advIcon} />
            <div className={css.advTexts}>
              <div className={css.advTitle}><FormattedMessage id="LandingHero.advantage1Title" /></div>
              <div className={css.advDesc}>
                <FormattedMessage id="LandingHero.advantage1Text" />
              </div>
            </div>
          </div>

          <div className={css.advItem}>
            <div className={css.advIcon} />
            <div className={css.advTexts}>
              <div className={css.advTitle}><FormattedMessage id="LandingHero.advantage2Title" /></div>
              <div className={css.advDesc}>
                <FormattedMessage id="LandingHero.advantage2Text" />
              </div>
            </div>
          </div>

          <div className={css.advItem}>
            <div className={css.advIcon} />
            <div className={css.advTexts}>
              <div className={css.advTitle}><FormattedMessage id="LandingHero.advantage3Title" /></div>
              <div className={css.advDesc}>
                <FormattedMessage id="LandingHero.advantage3Text" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingHero;