import React, { useEffect } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import loadable from '@loadable/component';

import { propTypes } from '../../util/types';

import {
  sendVerificationEmail,
  hasCurrentUserErrors,
  fetchCurrentUserNotifications,
} from '../../ducks/user.duck';
import { logout, authenticationInProgress } from '../../ducks/auth.duck';
import { manageDisableScrolling } from '../../ducks/ui.duck';

// Replies arrive while the page stays open, and nothing else reloads the badge.
const NOTIFICATION_REFRESH_MS = 60 * 1000;

const TopbarCustom = loadable(() => import(/* webpackChunkName: "TopbarCustom" */ '../TopbarCustom/TopbarCustom'));

/**
 * Topbar container component, which is connected to Redux Store.
 * @component
 * @param {Object} props
 * @param {number} props.notificationCount number of notifications
 * @param {Function} props.onLogout logout function
 * @param {Function} props.onManageDisableScrolling manage disable scrolling function
 * @param {Function} props.onResendVerificationEmail resend verification email function
 * @param {Object} props.sendVerificationEmailInProgress send verification email in progress
 * @param {Object} props.sendVerificationEmailError send verification email error
 * @param {boolean} props.hasGenericError has generic error
 * @returns {JSX.Element}
 */
export const TopbarContainerComponent = props => {
  const {
    notificationCount = 0,
    hasGenericError,
    isAuthenticated,
    currentUser,
    onRefreshNotifications,
    ...rest
  } = props;

  useEffect(() => {
    if (!isAuthenticated || !onRefreshNotifications) return undefined;

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') onRefreshNotifications();
    };
    const timer = window.setInterval(refreshIfVisible, NOTIFICATION_REFRESH_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [isAuthenticated, onRefreshNotifications]);

  return (
    <TopbarCustom 
      isAuthenticated={isAuthenticated}
      currentUser={currentUser}
      notificationCount={notificationCount}
      {...rest}
    />
  );
};

const mapStateToProps = state => {
  // Topbar needs isAuthenticated and isLoggedInAs
  const { isAuthenticated, isLoggedInAs, logoutError, authScopes } = state.auth;
  // Topbar needs user info.
  const {
    currentUser,
    currentUserHasListings,
    currentUserHasOrders,
    currentUserNotificationCount: notificationCount,
    sendVerificationEmailInProgress,
    sendVerificationEmailError,
  } = state.user;
  const hasGenericError = !!(logoutError || hasCurrentUserErrors(state));
  return {
    authInProgress: authenticationInProgress(state),
    currentUser,
    currentUserHasListings,
    currentUserHasOrders,
    notificationCount,
    isAuthenticated,
    isLoggedInAs,
    authScopes,
    sendVerificationEmailInProgress,
    sendVerificationEmailError,
    hasGenericError,
  };
};

const mapDispatchToProps = dispatch => ({
  onLogout: historyPush => dispatch(logout(historyPush)),
  onManageDisableScrolling: (componentId, disableScrolling) =>
    dispatch(manageDisableScrolling(componentId, disableScrolling)),
  onResendVerificationEmail: () => dispatch(sendVerificationEmail()),
  onRefreshNotifications: () => dispatch(fetchCurrentUserNotifications()),
});

// Note: it is important that the withRouter HOC is **outside** the
// connect HOC, otherwise React Router won't rerender any Route
// components since connect implements a shouldComponentUpdate
// lifecycle hook.
//
// See: https://github.com/ReactTraining/react-router/issues/4671
const TopbarContainer = compose(
  withRouter,
  connect(
    mapStateToProps,
    mapDispatchToProps
  )
)(TopbarContainerComponent);

export default TopbarContainer;
