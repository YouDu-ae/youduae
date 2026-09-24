import React from 'react';
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { Page, LayoutSingleColumn, PrimaryButton, IconSuccess, NamedLink } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './ListingCreatedPage.module.css';

const ListingCreatedPage = () => {
  const intl = useIntl();
  const title = intl.formatMessage({ id: 'ListingCreatedPage.pageTitle' });

  return (
    <Page title={title} scrollingDisabled={false}>
      <LayoutSingleColumn
        topbar={<TopbarContainer />}
        footer={<FooterContainer />}
      >
        <div className={css.root}>
          <div className={css.content}>
            {/* Success Icon */}
            <div className={css.iconWrapper}>
              <IconSuccess className={css.icon} />
            </div>
            
            {/* Main Title */}
            <h1 className={css.title}>
              <FormattedMessage id="ListingCreatedPage.heading" /> 🎉
            </h1>
            
            {/* Moderation Notice */}
            <div className={css.moderationNotice}>
              <div className={css.moderationIcon}>⏳</div>
              <div className={css.moderationText}>
                <h3><FormattedMessage id="ListingCreatedPage.moderationTitle" /></h3>
                <p>
                  <FormattedMessage id="ListingCreatedPage.moderationText" />
                </p>
              </div>
            </div>
            
            {/* Info Box */}
            <div className={css.infoBox}>
              <div className={css.infoIcon}>💡</div>
              <div className={css.infoContent}>
                <p className={css.infoTitle}><FormattedMessage id="ListingCreatedPage.infoTitle" /></p>
                <p className={css.infoDescription}>
                  <FormattedMessage
                    id="ListingCreatedPage.infoDescription"
                    values={{ b: chunks => <strong>{chunks}</strong> }}
                  />
                </p>
              </div>
            </div>

            {/* Success Steps */}
            <div className={css.successSteps}>
              <div className={css.step}>
                <div className={css.stepNumber}>✓</div>
                <div className={css.stepContent}>
                  <h4><FormattedMessage id="ListingCreatedPage.stepSignupTitle" /></h4>
                  <p><FormattedMessage id="ListingCreatedPage.stepSignupText" /></p>
                </div>
              </div>
              <div className={css.step}>
                <div className={css.stepNumber}>✓</div>
                <div className={css.stepContent}>
                  <h4><FormattedMessage id="ListingCreatedPage.stepCreatedTitle" /></h4>
                  <p><FormattedMessage id="ListingCreatedPage.stepCreatedText" /></p>
                </div>
              </div>
              <div className={css.step}>
                <div className={css.stepNumber}>⏳</div>
                <div className={css.stepContent}>
                  <h4><FormattedMessage id="ListingCreatedPage.stepModerationTitle" /></h4>
                  <p><FormattedMessage id="ListingCreatedPage.stepModerationText" /></p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className={css.actions}>
              <NamedLink 
                name="ManageListingsPage"
                className={css.primaryButton}
              >
                <PrimaryButton>
                  <FormattedMessage id="ListingCreatedPage.goToMyTasks" />
                </PrimaryButton>
              </NamedLink>
              
              <NamedLink 
                name="LandingPage" 
                className={css.secondaryLink}
              >
                <FormattedMessage id="ListingCreatedPage.backToHome" />
              </NamedLink>
            </div>
          </div>
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default ListingCreatedPage;

