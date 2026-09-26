import React, { useEffect, useState } from 'react';
import { FormattedMessage } from '../../util/reactIntl';

import css from './EmailVerificationBanner.module.css';

// Paths with their own verification prompt or resend button.
const HIDDEN_ON = ['/welcome', '/verify-email', '/account/contact-details'];
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;
const snoozeKey = userId => `emailVerifyBannerHiddenUntil:${userId}`;

const isSnoozed = userId => {
  try {
    return Number(window.localStorage.getItem(snoozeKey(userId))) > Date.now();
  } catch (e) {
    return false;
  }
};

/**
 * A slim strip under the topbar for signed-in users whose e-mail is not
 * verified: Sharetribe mails offers, replies and deal updates only to verified
 * addresses. "Later" hides it for three days on this device.
 *
 * Rendered only after mount, since the snooze lives in localStorage and the
 * server cannot know it.
 */
const EmailVerificationBanner = props => {
  const { currentUser, pathname, onResend, inProgress, error } = props;
  const [mounted, setMounted] = useState(false);
  const [snoozed, setSnoozed] = useState(false);
  const [resent, setResent] = useState(false);

  const userId = currentUser?.id?.uuid;
  const email = currentUser?.attributes?.email;
  const needsVerification = !!email && currentUser?.attributes?.emailVerified === false;

  useEffect(() => {
    setMounted(true);
    if (userId) setSnoozed(isSnoozed(userId));
  }, [userId]);

  const hiddenHere = HIDDEN_ON.some(path => (pathname || '').startsWith(path));
  if (!mounted || !needsVerification || snoozed || hiddenHere) return null;

  const snooze = () => {
    try {
      window.localStorage.setItem(snoozeKey(userId), String(Date.now() + SNOOZE_MS));
    } catch (e) {
      // Private mode: the strip just hides for this page view.
    }
    setSnoozed(true);
  };

  const resend = () => {
    onResend().then(() => setResent(true));
  };

  return (
    <div className={css.root} role="status">
      <div className={css.content}>
        <p className={css.text}>
          {resent && !error ? (
            <FormattedMessage
              id="EmailVerificationBanner.resent"
              values={{ email: <strong>{email}</strong> }}
            />
          ) : (
            <FormattedMessage id="EmailVerificationBanner.text" />
          )}
        </p>
        <div className={css.actions}>
          {resent && !error ? null : (
            <button
              type="button"
              className={css.resendButton}
              onClick={resend}
              disabled={inProgress}
            >
              <FormattedMessage
                id={inProgress ? 'EmailVerificationBanner.sending' : 'EmailVerificationBanner.resend'}
              />
            </button>
          )}
          <button type="button" className={css.laterButton} onClick={snooze}>
            <FormattedMessage id="EmailVerificationBanner.later" />
          </button>
        </div>
      </div>
      {error ? (
        <p className={css.error}>
          <FormattedMessage id="EmailVerificationBanner.error" />
        </p>
      ) : null}
    </div>
  );
};

export default EmailVerificationBanner;
