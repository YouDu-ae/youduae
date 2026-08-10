import React, { useEffect } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { ensureCurrentUser } from '../../util/data';
import { getCurrentUserTypeRoles } from '../../util/userHelpers';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { Page, NamedLink, LayoutSingleColumn, PrimaryButton, SecondaryButton, ExternalLink } from '../../components';
import { useTelegramLink } from '../../hooks/useTelegramLink';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './WelcomePage.module.css';

export const WelcomePageComponent = props => {
  const { scrollingDisabled, currentUser } = props;
  const config = useConfiguration();
  const intl = useIntl();
  const history = useHistory();
  
  // Mark that user has seen welcome page (for redirect logic)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hasSeenWelcome', 'true');
    }
  }, []);

  const user = ensureCurrentUser(currentUser);
  const userRoles = getCurrentUserTypeRoles(config, user);
  // Right after signup nobody has Telegram linked yet, so the status request
  // would only delay the prompt.
  const { connecting, error: telegramError, connect: connectTelegram } = useTelegramLink({
    currentUser: user,
    skipStatusCheck: true,
  });
  
  // ⚠️ ROLE MAPPING:
  // userType 'provider' (Заказчик) → roles: {customer: true, provider: false} → создаёт задания
  // userType 'customer' (Исполнитель) → roles: {customer: false, provider: true} → откликается на задания
  const isProvider = userRoles.customer; // Provider userType - can create listings (Заказчик)
  const isCustomer = userRoles.provider; // Customer userType - searches for tasks (Исполнитель)

  // Get user's first name from profile
  const firstName = user?.attributes?.profile?.firstName || '';
  const displayName = user?.attributes?.profile?.displayName || '';
  const userName = firstName || displayName.split(' ')[0] || intl.formatMessage({ id: 'WelcomePage.defaultName' });
  
  console.log('🔍 WelcomePage user info:', {
    userId: user?.id?.uuid,
    firstName,
    displayName,
    userName,
    userRoles,
    isProvider,
    isCustomer,
  });

  const title = intl.formatMessage({ id: 'WelcomePage.title' });
  const schemaTitle = intl.formatMessage({ id: 'WelcomePage.schemaTitle' });

  return (
    <Page title={schemaTitle} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={<TopbarContainer />}
        footer={<FooterContainer />}
      >
        <div className={css.root}>
          <div className={css.content}>
            <div className={css.iconContainer}>
              <svg className={css.successIcon} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="45" fill="#4CAF50" />
                <path d="M30 50 L45 65 L70 35" stroke="white" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <h1 className={css.title}>
              <FormattedMessage id="WelcomePage.welcomeTitle" values={{ name: userName }} />
            </h1>

            <p className={css.subtitle}>
              <FormattedMessage id="WelcomePage.subtitle" />
            </p>

            {/* Telegram Section - First thing user sees */}
            <div className={css.telegramSection}>
              <div className={css.telegramIcon}>
                <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={css.telegramSvg}>
                  <path d="M24 4C12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20S35.046 4 24 4z" fill="#fff"/>
                  <path d="M34.143 15.176L30.1 33.667c-.305 1.342-1.1 1.675-2.231 1.043l-6.16-4.54-2.97 2.86c-.329.33-.604.604-1.237.604l.441-6.274 11.402-10.305c.496-.44-.108-.686-.77-.247L14.42 25.714l-6.08-1.9c-1.321-.414-1.346-1.321.275-1.956l23.768-9.16c1.1-.414 2.063.247 1.76 2.478z" fill="#0088cc"/>
                </svg>
              </div>
              <div className={css.telegramContent}>
                <h3 className={css.telegramTitle}>
                  <FormattedMessage 
                    id={isProvider ? 'WelcomePage.telegramTitleProvider' : 'WelcomePage.telegramTitleCustomer'} 
                  />
                </h3>
                <p className={css.telegramDescription}>
                  <FormattedMessage 
                    id={isProvider ? 'WelcomePage.telegramDescriptionProvider' : 'WelcomePage.telegramDescriptionCustomer'} 
                  />
                </p>
                <button
                  type="button"
                  onClick={connectTelegram}
                  disabled={connecting}
                  className={css.telegramButton}
                >
                  {connecting ? (
                    <FormattedMessage id="WelcomePage.telegramConnecting" />
                  ) : (
                    <FormattedMessage id="WelcomePage.telegramConnect" />
                  )}
                </button>
                {telegramError ? (
                  <p className={css.telegramError}>{telegramError}</p>
                ) : null}
              </div>
            </div>

            {isProvider ? (
              <div className={css.guidanceSection}>
                <h2 className={css.sectionTitle}>
                  <FormattedMessage id="WelcomePage.providerGuideTitle" />
                </h2>
                
                <div className={css.steps}>
                  <div className={css.step}>
                    <div className={css.stepNumber}>1</div>
                    <div className={css.stepContent}>
                      <h3 className={css.stepTitle}>
                        <FormattedMessage id="WelcomePage.providerStep1Title" />
                      </h3>
                      <p className={css.stepDescription}>
                        <FormattedMessage id="WelcomePage.providerStep1Description" />
                      </p>
                    </div>
                  </div>

                  <div className={css.step}>
                    <div className={css.stepNumber}>2</div>
                    <div className={css.stepContent}>
                      <h3 className={css.stepTitle}>
                        <FormattedMessage id="WelcomePage.providerStep2Title" />
                      </h3>
                      <p className={css.stepDescription}>
                        <FormattedMessage id="WelcomePage.providerStep2Description" />
                      </p>
                    </div>
                  </div>

                  <div className={css.step}>
                    <div className={css.stepNumber}>3</div>
                    <div className={css.stepContent}>
                      <h3 className={css.stepTitle}>
                        <FormattedMessage id="WelcomePage.providerStep3Title" />
                      </h3>
                      <p className={css.stepDescription}>
                        <FormattedMessage id="WelcomePage.providerStep3Description" />
                      </p>
                    </div>
                  </div>
                </div>

                <div className={css.actions}>
                  <NamedLink name="NewListingPage" className={css.primaryActionLink}>
                    <PrimaryButton className={css.primaryAction}>
                      <FormattedMessage id="WelcomePage.createFirstTask" />
                    </PrimaryButton>
                  </NamedLink>
                  <NamedLink name="ManageListingsPage" className={css.secondaryActionLink}>
                    <SecondaryButton className={css.secondaryAction}>
                      <FormattedMessage id="WelcomePage.viewMyTasks" />
                    </SecondaryButton>
                  </NamedLink>
                </div>
              </div>
            ) : (
              <div className={css.guidanceSection}>
                <h2 className={css.sectionTitle}>
                  <FormattedMessage id="WelcomePage.customerGuideTitle" />
                </h2>
                
                <div className={css.steps}>
                  <div className={css.step}>
                    <div className={css.stepNumber}>1</div>
                    <div className={css.stepContent}>
                      <h3 className={css.stepTitle}>
                        <FormattedMessage id="WelcomePage.customerStep1Title" />
                      </h3>
                      <p className={css.stepDescription}>
                        <FormattedMessage id="WelcomePage.customerStep1Description" />
                      </p>
                    </div>
                  </div>

                  <div className={css.step}>
                    <div className={css.stepNumber}>2</div>
                    <div className={css.stepContent}>
                      <h3 className={css.stepTitle}>
                        <FormattedMessage id="WelcomePage.customerStep2Title" />
                      </h3>
                      <p className={css.stepDescription}>
                        <FormattedMessage id="WelcomePage.customerStep2Description" />
                      </p>
                    </div>
                  </div>

                  <div className={css.step}>
                    <div className={css.stepNumber}>3</div>
                    <div className={css.stepContent}>
                      <h3 className={css.stepTitle}>
                        <FormattedMessage id="WelcomePage.customerStep3Title" />
                      </h3>
                      <p className={css.stepDescription}>
                        <FormattedMessage id="WelcomePage.customerStep3Description" />
                      </p>
                    </div>
                  </div>
                </div>

                <div className={css.actions}>
                  <NamedLink name="SearchPage" className={css.primaryActionLink}>
                    <PrimaryButton className={css.primaryAction}>
                      <FormattedMessage id="WelcomePage.findTasks" />
                    </PrimaryButton>
                  </NamedLink>
                  <NamedLink name="ProfileSettingsPage" className={css.secondaryActionLink}>
                    <SecondaryButton className={css.secondaryAction}>
                      <FormattedMessage id="WelcomePage.completeProfile" />
                    </SecondaryButton>
                  </NamedLink>
                </div>
              </div>
            )}

            <div className={css.footer}>
              <NamedLink name="LandingPage" className={css.skipLink}>
                <FormattedMessage id="WelcomePage.skipToHome" />
              </NamedLink>
            </div>
          </div>
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => {
  const { currentUser } = state.user;
  return {
    scrollingDisabled: isScrollingDisabled(state),
    currentUser,
  };
};

const WelcomePage = compose(connect(mapStateToProps))(WelcomePageComponent);

export default WelcomePage;

