import React, { useState } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { useHistory } from 'react-router-dom';

import { useConfiguration } from '../../context/configurationContext';
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

const errorMessageFor = (httpStatus, data) => {
  if (httpStatus === 403 && data?.error === 'wrong_password') {
    return 'Неверный пароль.';
  }
  if (httpStatus === 401) {
    return 'Сессия истекла. Войдите заново и повторите.';
  }
  return 'Не удалось удалить аккаунт. Попробуйте ещё раз или напишите на info@youdu.ae.';
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
        setError(errorMessageFor(response.status, data));
      }
    } catch (e) {
      setStatus(STATUS.IDLE);
      setError(errorMessageFor(0));
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
        <p className={css.lead}>Аккаунт удалён.</p>
        <p className={css.text}>Письмо с подтверждением отправлено на ваш e-mail.</p>
        <PrimaryButton type="button" className={css.button} onClick={leave}>
          На главную
        </PrimaryButton>
      </div>
    ) : (
      <div className={css.result}>
        <p className={css.lead}>Запрос принят.</p>
        <p className={css.text}>
          Мы удалим аккаунт в течение 30 дней и пришлём письмо, когда это будет сделано.
        </p>
      </div>
    );

  const renderForm = () => (
    <form className={css.form} onSubmit={handleSubmit}>
      <ul className={css.consequences}>
        <li>Аккаунт, профиль и ваши задания будут удалены безвозвратно.</li>
        <li>
          Сообщения и отзывы, которые вы отправляли, останутся у получателей, но ваш профиль
          будет показан как удалённый.
        </li>
        <li>Незавершённые сделки не смогут продолжиться.</li>
      </ul>

      {signsInWithProvider ? (
        <p className={css.text}>
          Вы входите через Google или Apple, поэтому пароль не нужен. Мы получим ваш запрос и
          удалим аккаунт в течение 30 дней.
        </p>
      ) : (
        <label className={css.field}>
          <span className={css.label}>Пароль для подтверждения</span>
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
        <span>Я понимаю, что удаление необратимо</span>
      </label>

      {error ? <p className={css.error}>{error}</p> : null}

      <PrimaryButton
        type="submit"
        className={css.deleteButton}
        disabled={!canSubmit}
        inProgress={status === STATUS.SUBMITTING}
      >
        {signsInWithProvider ? 'Отправить запрос на удаление' : 'Удалить аккаунт'}
      </PrimaryButton>
    </form>
  );

  const isDone = status === STATUS.DELETED || status === STATUS.REQUESTED;

  return (
    <Page title="Удаление аккаунта | YouDu" scrollingDisabled={scrollingDisabled}>
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
          <H3 as="h1">Удаление аккаунта</H3>
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
