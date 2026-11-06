import React from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { Page, LayoutSingleColumn, NamedLink } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';
import appStoreBadgeRu from '../../assets/app-store-badge-ru.svg';
import appStoreBadgeEn from '../../assets/app-store-badge-en.svg';

import css from './AppDownloadPage.module.css';

export const APP_STORE_URL = 'https://apps.apple.com/app/id6808781959';
const COVER_PATH = '/static/blog/youdu-ios-app.jpg';

export const AppDownloadPageComponent = props => {
  const { scrollingDisabled } = props;
  const intl = useIntl();
  const config = useConfiguration();

  const title = intl.formatMessage({ id: 'AppDownloadPage.title' });
  const description = intl.formatMessage({ id: 'AppDownloadPage.description' });
  // Мессенджеры загружают картинку превью только по абсолютному адресу
  const previewImages = [
    { url: `${config.marketplaceRootURL}${COVER_PATH}`, width: 1200, height: 630 },
  ];
  const appStoreBadge = intl.locale === 'en' ? appStoreBadgeEn : appStoreBadgeRu;

  return (
    <Page
      title={title}
      description={description}
      facebookImages={previewImages}
      twitterImages={previewImages}
      scrollingDisabled={scrollingDisabled}
    >
      <LayoutSingleColumn topbar={<TopbarContainer />} footer={<FooterContainer />}>
        <div className={css.root}>
          <div className={css.content}>
            <img className={css.cover} src={COVER_PATH} alt="" width="1200" height="630" />
            <h1 className={css.title}>
              <FormattedMessage id="AppDownloadPage.heading" />
            </h1>
            <p className={css.description}>{description}</p>
            <a className={css.badgeLink} href={APP_STORE_URL}>
              <img
                className={css.badge}
                src={appStoreBadge}
                alt={intl.formatMessage({ id: 'FooterCustom.appStoreBadgeAlt' })}
              />
            </a>
            <p className={css.webNote}>
              <FormattedMessage
                id="AppDownloadPage.webNote"
                values={{
                  link: (
                    <NamedLink name="NewListingPage">
                      <FormattedMessage id="AppDownloadPage.webLink" />
                    </NamedLink>
                  ),
                }}
              />
            </p>
          </div>
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => ({
  scrollingDisabled: isScrollingDisabled(state),
});

const AppDownloadPage = compose(connect(mapStateToProps))(AppDownloadPageComponent);

export default AppDownloadPage;
