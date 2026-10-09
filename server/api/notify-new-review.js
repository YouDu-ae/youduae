/**
 * POST /api/notify-new-review — kept only for installed app builds, which
 * call it after leaving a review.
 *
 * The event poller (server/reminders/messageNotifications.js) now tells the
 * reviewed party about every review. This endpoint used to push whatever name
 * and rating the caller sent to any user, without checking the sign-in.
 */
module.exports = (req, res) => {
  res.status(200).json({ success: true, message: 'Notifications are sent by the server' }).end();
};
