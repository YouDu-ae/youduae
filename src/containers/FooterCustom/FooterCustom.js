import React from 'react';
import { FormattedMessage } from '../../util/reactIntl';
import { NamedLink } from '../../components';
import css from './FooterCustom.module.css';
import logo from '../../assets/Logo.png'; // проверь путь к картинке

const FooterCustom = () => {
  const year = new Date().getFullYear();

  return (
    <footer className={css.footer}>
      <div className={css.container}>

        {/* Логотип */}
        <NamedLink name="LandingPage" className={css.logoName} aria-label="На главную">
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
          <NamedLink name="PrivacyPolicyPage" className={css.col2Item}>
            <FormattedMessage id="FooterCustom.contacts" />
          </NamedLink>
          <NamedLink name="PrivacyPolicyPage" className={css.col2Item}>
            <FormattedMessage id="TopbarCustom.blog" />
          </NamedLink>
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
      </div>
    </footer>
  );
};

export default FooterCustom;