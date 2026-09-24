import React, { useState } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { useHistory } from 'react-router-dom';

import { useConfiguration } from '../../context/configurationContext';
import { useIntl } from '../../util/reactIntl';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { showCreateListingLinkForUser, showPaymentDetailsForUser } from '../../util/userHelpers';

import { Page, UserNav, H3, LayoutSideNavigation, PrimaryButton } from '../../components';

import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import FooterContainer from '../../containers/FooterContainer/FooterContainer';

import css from './DeleteAccountPage.module.css';

const STATUS = {
  IDLE: 'idle',
  SUBMITTING: 'submitting',
  DELETED: 'deleted',
  REQUESTED: 'requested',
};

const errorMessageIdFor = (httpStatus, data) => {
  if (httpStatus === 403 && data?.error === 'wrong_password') {
    return 'DeleteAccountPage.errorWrongPassword';
  }
  if (httpStatus === 401) {
    return 'DeleteAccountPage.errorSessionExpired';
  }
  return 'DeleteAccountPage.errorGeneric';
};

/**
 * Account deletion.
 *
 * Sharetribe deletes a user only with their current password. People who sign
 * in with Google or Apple have none, so for them the page sends a request that
 * an operator completes in Console within 30 days.
 */
export const DeleteAccountPageComponent = props => {
  const config = useConfiguration();
  const history = useHistory();
  const intl = useIntl();
  const { currentUser, scrollingDisabled, onLogout } = props;

  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState(STATUS.IDLE);
  const [error, setError] = useState(null);

  const identityProviders = currentUser?.attributes?.identityProviders || [];
  const signsInWithProvider = identityProviders.length > 0;
  const canSubmit =
    confirmed && status === STATUS.IDLE && (signsInWithProvider || password.length > 0);

  const handleSubmit = async event => {
    event.preventDefault();
    if (!canSubmit) return;

    setStatus(STATUS.SUBMITTING);
    setError(null);

    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          signsInWithProvider ? { source: 'web' } : { currentPassword: password, source: 'web' }
        ),
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 200) {
        setStatus(STATUS.DELETED);
      } else if (response.status === 202) {
        setStatus(STATUS.REQUESTED);
      } else {
        setStatus(STATUS.IDLE);
        setError(errorMessageIdFor(response.status, data));
      }
    } catch (e) {
      setStatus(STATUS.IDLE);
      setError(errorMessageIdFor(0));
    }
  };

  // The account no longer exists, so the session has to go with it.
  const leave = () => onLogout().finally(() => history.push('/'));

  const showManageListingsLink = showCreateListingLinkForUser(config, currentUser);
  const { showPayoutDetails, showPaymentMethods } = showPaymentDetailsForUser(config, currentUser);
  const accountSettingsNavProps = {
    currentPage: 'DeleteAccountPage',
    showPaymentMethods,
    showPayoutDetails,
  };

  const renderResult = () =>
    status === STATUS.DELETED ? (
      <div className={css.result}>
        <p className={css.lead}>{intl.formatMessage({ id: 'DeleteAccountPage.deletedTitle' })}</p>
        <p className={css.text}>{intl.formatMessage({ id: 'DeleteAccountPage.deletedText' })}</p>
        <PrimaryButton type="button" className={css.button} onClick={leave}>
          {intl.formatMessage({ id: 'DeleteAccountPage.goHome' })}
        </PrimaryButton>
      </div>
    ) : (
      <div className={css.result}>
        <p className={css.lead}>{intl.formatMessage({ id: 'DeleteAccountPage.requestedTitle' })}</p>
        <p className={css.text}>{intl.formatMessage({ id: 'DeleteAccountPage.requestedText' })}</p>
      </div>
    );

  const renderForm = () => (
    <form className={css.form} onSubmit={handleSubmit}>
      <ul className={css.consequences}>
        <li>{intl.formatMessage({ id: 'DeleteAccountPage.consequenceAccount' })}</li>
        <li>{intl.formatMessage({ id: 'DeleteAccountPage.consequenceMessages' })}</li>
        <li>{intl.formatMessage({ id: 'DeleteAccountPage.consequenceTransactions' })}</li>
      </ul>

      {signsInWithProvider ? (
        <p className={css.text}>
          {intl.formatMessage({ id: 'DeleteAccountPage.providerSignInNote' })}
        </p>
      ) : (
        <label className={css.field}>
          <span className={css.label}>
            {intl.formatMessage({ id: 'DeleteAccountPage.passwordLabel' })}
          </span>
          <input
            type="password"
            className={css.input}
            value={password}
            autoComplete="current-password"
            onChange={e => setPassword(e.target.value)}
          />
        </label>
      )}

      <label className={css.checkbox}>
        <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
        <span>{intl.formatMessage({ id: 'DeleteAccountPage.confirmCheckbox' })}</span>
      </label>

      {error ? <p className={css.error}>{intl.formatMessage({ id: error })}</p> : null}

      <PrimaryButton
        type="submit"
        className={css.deleteButton}
        disabled={!canSubmit}
        inProgress={status === STATUS.SUBMITTING}
      >
        {intl.formatMessage({
          id: signsInWithProvider
            ? 'DeleteAccountPage.submitRequest'
            : 'DeleteAccountPage.submitDelete',
        })}
      </PrimaryButton>
    </form>
  );

  const isDone = status === STATUS.DELETED || status === STATUS.REQUESTED;

  return (
    <Page
      title={intl.formatMessage({ id: 'DeleteAccountPage.schemaTitle' })}
      scrollingDisabled={scrollingDisabled}
    >
      <LayoutSideNavigation
        topbar={
          <>
            <TopbarContainer
              desktopClassName={css.desktopTopbar}
              mobileClassName={css.mobileTopbar}
            />
            <UserNav currentPage="DeleteAccountPage" showManageListingsLink={showManageListingsLink} />
          </>
        }
        sideNav={null}
        useAccountSettingsNav
        accountSettingsNavProps={accountSettingsNavProps}
        footer={<FooterContainer />}
      >
        <div className={css.content}>
          <H3 as="h1">{intl.formatMessage({ id: 'DeleteAccountPage.heading' })}</H3>
          {currentUser?.id ? (isDone ? renderResult() : renderForm()) : null}
        </div>
      </LayoutSideNavigation>
    </Page>
  );
};

const mapStateToProps = state => ({
  currentUser: state.user.currentUser,
  scrollingDisabled: isScrollingDisabled(state),
});

const mapDispatchToProps = dispatch => ({
  onLogout: () => dispatch(logout()),
});

const DeleteAccountPage = compose(connect(mapStateToProps, mapDispatchToProps))(
  DeleteAccountPageComponent
);

export default DeleteAccountPage;
