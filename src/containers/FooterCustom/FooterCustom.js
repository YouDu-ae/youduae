import React from 'react';
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { NamedLink } from '../../components';
import css from './FooterCustom.module.css';
import logo from '../../assets/Logo.png'; // проверь путь к картинке
import appStoreBadgeRu from '../../assets/app-store-badge-ru.svg';
import appStoreBadgeEn from '../../assets/app-store-badge-en.svg';

const APP_STORE_URL = 'https://apps.apple.com/app/id6808781959';

const FooterCustom = () => {
  const intl = useIntl();
  const year = new Date().getFullYear();
  const appStoreBadge = intl.locale === 'en' ? appStoreBadgeEn : appStoreBadgeRu;

  return (
    <footer className={css.footer}>
      <div className={css.container}>

        {/* Логотип */}
        <NamedLink name="LandingPage" className={css.logoName} aria-label={intl.formatMessage({ id: 'FooterCustom.homeAriaLabel' })}
        >
          <div className={css.logoPic}>
            <img src={logo} alt="YouDu" className={css.logoImg} />
          </div>
          <div className={css.logoText}>YouDu</div>
        </NamedLink>

        {/* Колонка 1 */}
        <div className={css.column1}>
          <NamedLink name="NewListingPage" className={css.col1Item}>
            <FormattedMessage id="TopbarDesktop.createListing" />
          </NamedLink>
          <NamedLink name="SearchPage" className={css.col1Item}>
            <FormattedMessage id="TopbarDesktop.searchLink" />
          </NamedLink>
          <NamedLink name="AboutPage" className={css.col1Item}>
            <FormattedMessage id="FooterCustom.about" />
          </NamedLink>
        </div>

        {/* Колонка 2 */}
        <div className={css.column2}>
          <NamedLink name="CooperationPage" className={css.col2Item}>
            <FormattedMessage id="TopbarDesktop.forSpecialists" />
          </NamedLink>
          <NamedLink name="SupportPage" className={css.col2Item}>
            <FormattedMessage id="FooterCustom.support" />
          </NamedLink>
          <NamedLink name="HelpPage" className={css.col2Item}>
            <FormattedMessage id="FooterCustom.help" />
          </NamedLink>
          <NamedLink name="BlogPage" className={css.col2Item}>
            <FormattedMessage id="TopbarCustom.blog" />
          </NamedLink>
        </div>

        {/* Приложение для iPhone */}
        <div className={css.columnApp}>
          <div className={css.supportTitle}>
            <FormattedMessage id="FooterCustom.appTitle" />:
          </div>
          <div className={css.appBadgeRow}>
            <a
              className={css.appBadgeLink}
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={appStoreBadge}
                alt={intl.formatMessage({ id: 'FooterCustom.appStoreBadgeAlt' })}
                className={css.appBadge}
              />
            </a>
          </div>
          <div className={css.appleCredit}>
            <FormattedMessage id="FooterCustom.appleCredit" />
          </div>
        </div>

        {/* Колонка 3 */}
        <div className={css.column3}>
          <div className={css.frame2}>
            <div className={css.supportTitle}>
              <FormattedMessage id="TopbarCustom.contactUs" />:
            </div>
            <a
              className={css.btnSupport}
              href="https://t.me/youdu_ae"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className={css.btnText}>Telegram</span>
            </a>
          </div>
          <div className={css.supportNote}>
            <FormattedMessage id="FooterCustom.supportNote" />
          </div>
        </div>

        {/* Разделительная линия */}
        <div className={css.line}></div>

        {/* Нижние строки */}
        <div className={css.bottomArea}>
          <div className={css.bottomRow}>
            <div className={css.copyright}>
              <FormattedMessage id="FooterCustom.copyright" values={{ year }} />
            </div>
            <div className={css.policyLinks}>
              <NamedLink name="TermsOfServicePage" className={css.policy}>
                <FormattedMessage id="FooterCustom.termsOfService" />
              </NamedLink>
              <span className={css.policySeparator}>|</span>
              <NamedLink name="PrivacyPolicyPage" className={css.policy}>
                <FormattedMessage id="FooterCustom.policy" />
              </NamedLink>
            </div>
          </div>
          <div className={css.legalInfo}>
            <FormattedMessage id="FooterCustom.legalInfo" />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default FooterCustom;