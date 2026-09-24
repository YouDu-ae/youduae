/**
 * POST /api/account/delete — deletes the signed-in user's account.
 *
 * The site authenticates with the session cookie, the iOS app with a Bearer
 * token; both reach the same flow.
 *
 * Sharetribe deletes a user only with their current password (checked on
 * production: without it the API answers validation-missing-key, even with a
 * trusted token). So:
 * - with a password the account is deleted at once;
 * - without one — everyone who signs in with Apple or Google — the request is
 *   recorded and an operator deletes the account in Console. Apple allows a
 *   manual deletion as long as the person starts it in the app, is told how
 *   long it takes and is told when it is done; the confirmation letter is sent
 *   by the event consumer in reminders/accountDeletions.
 *
 * Body: { currentPassword?, appleAuthorizationCode?, appleClientId?, source? }
 */

const db = require('../db');
const { getTrustedSdk } = require('../api-util/sdk');
const { trustedSdkFromBearer } = require('../api-util/mobileSdk');
const { revokeAppleAuthorization } = require('../api-util/appleRevoke');
const { sendAccountEmail } = require('../api-util/accountEmails');
const { notifyAdminAccountDeletionRequest } = require('./telegram-bot');

const DELETION_DAYS = 30;

const hasBearer = req => (req.headers.authorization || '').startsWith('Bearer ');

// Side effects around deletion are best effort: none of them may stop the
// account from being deleted or the request from being recorded.
const attempt = async (label, action) => {
  try {
    return await action();
  } catch (error) {
    console.error(`⚠️ delete-account: ${label} failed:`, error.message);
    return null;
  }
};

module.exports = async (req, res) => {
  const { currentPassword, appleAuthorizationCode, appleClientId, source } = req.body || {};

  let trustedSdk;
  let user;
  try {
    trustedSdk = hasBearer(req) ? await trustedSdkFromBearer(req) : await getTrustedSdk(req);
    const me = await trustedSdk.currentUser.show();
    user = me.data.data;
  } catch (error) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userId = user.id.uuid;
  const email = user.attributes.email;
  const origin = source === 'ios' ? 'приложение iOS' : 'сайт';

  // Codes from Apple live five minutes, so revoke while this one is fresh,
  // whichever deletion path follows.
  if (typeof appleAuthorizationCode === 'string' && appleAuthorizationCode) {
    const outcome = await attempt('Apple revoke', () =>
      revokeAppleAuthorization({
        authorizationCode: appleAuthorizationCode,
        clientId: appleClientId || 'ae.youdu.mobile',
      })
    );
    console.log(`🍎 delete-account: Apple revoke for ${userId}:`, JSON.stringify(outcome));
  }

  if (typeof currentPassword === 'string' && currentPassword) {
    try {
      await trustedSdk.currentUser.delete({ currentPassword }, { expand: true });
    } catch (error) {
      if (error.status === 403) {
        return res.status(403).json({ error: 'wrong_password' });
      }
      console.error('❌ delete-account: Sharetribe refused deletion:', error.status, error.data);
      return res.status(500).json({ error: 'deletion_failed' });
    }

    await attempt('local cleanup', () => db.deleteUserLocalData(userId));
    await attempt('confirmation letter', () => sendAccountEmail('deleted', email));
    console.log(`🗑 delete-account: ${userId} deleted by the user (${origin})`);
    return res.status(200).json({ status: 'deleted' });
  }

  try {
    const isNew = await db.recordDeletionRequest({ userId, email, method: 'manual' });
    if (isNew) {
      await attempt('admin alert', () =>
        notifyAdminAccountDeletionRequest({ userId, email, source: origin })
      );
      await attempt('request letter', () => sendAccountEmail('requested', email));
    }
    console.log(`🗑 delete-account: ${userId} asked for deletion (${origin}), new=${isNew}`);
    return res.status(202).json({ status: 'requested', withinDays: DELETION_DAYS });
  } catch (error) {
    console.error('❌ delete-account: could not record the request:', error.message);
    return res.status(500).json({ error: 'request_failed' });
  }
};
