/**
 * POST /api/notify-new-message — kept only for installed app builds, which
 * call it after sending a message.
 *
 * The event poller (server/reminders/messageNotifications.js) now notifies the
 * recipient of every message, from any client. Sending from here as well would
 * notify twice, and this endpoint used to notify the sender too and needed no
 * sign-in, so anyone could spam a deal's parties.
 */
module.exports = (req, res) => {
  res.status(200).json({ success: true, message: 'Notifications are sent by the server' }).end();
};
