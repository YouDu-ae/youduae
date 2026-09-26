/**
 * Tells the recipient of every chat message that it arrived, via Telegram and
 * push, whichever side of the deal wrote and from wherever — the site, the app
 * or Console.
 *
 * Before this the app asked the server to notify after sending, which reached
 * both parties including the sender, and the site never asked at all, so
 * replies written on the site notified nobody.
 *
 * Roles are inverted in YouDu: the task author is the Sharetribe provider and
 * sees the deal under /sale/:id, the specialist is the customer (/order/:id).
 */

const { notifyNewMessage } = require('../api/telegram-bot');
const { sendNewMessageNotification } = require('../api/send-notification');

const CURSOR_NAME = 'message-notifications';
const PREVIEW_LENGTH = 100;
// After an outage, hours-old messages are no longer news.
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

const idOf = ref => {
  const id = ref?.data?.id;
  return id?.uuid || id || null;
};

const displayName = user =>
  user?.attributes?.profile?.displayName || user?.attributes?.profile?.firstName || 'Пользователь';

/**
 * Who gets told about a message, or null when there is nobody to tell.
 */
const recipientOf = (transaction, included, senderId) => {
  const customerId = idOf(transaction?.relationships?.customer);
  const providerId = idOf(transaction?.relationships?.provider);
  const findUser = id => included.find(item => item.type === 'user' && (item.id?.uuid || item.id) === id);

  if (senderId === customerId && providerId) {
    return { id: providerId, role: 'provider', senderName: displayName(findUser(customerId)) };
  }
  if (senderId === providerId && customerId) {
    return { id: customerId, role: 'customer', senderName: displayName(findUser(providerId)) };
  }
  return null;
};

const conversationUrl = (rootUrl, transactionId, role) =>
  `${rootUrl}/${role === 'provider' ? 'sale' : 'order'}/${transactionId}`;

const notifyAboutMessage = async ({ integrationSdk, event, rootUrl, now }) => {
  const message = event.attributes.resource;
  const createdAt = new Date(message?.attributes?.createdAt || event.attributes.createdAt);
  if (now - createdAt.getTime() > MAX_AGE_MS) return 'stale';

  const transactionId = idOf(message?.relationships?.transaction);
  const senderId = idOf(message?.relationships?.sender);
  if (!transactionId || !senderId) return 'incomplete';

  const response = await integrationSdk.transactions.show({
    id: transactionId,
    include: ['customer', 'provider'],
  });
  const recipient = recipientOf(response.data.data, response.data.included || [], senderId);
  if (!recipient) return 'no-recipient';

  const preview = String(message.attributes?.content || '').slice(0, PREVIEW_LENGTH) || 'Новое сообщение';
  await Promise.allSettled([
    notifyNewMessage(recipient.id, {
      senderName: recipient.senderName,
      messagePreview: preview,
      conversationUrl: conversationUrl(rootUrl, transactionId, recipient.role),
    }),
    sendNewMessageNotification(recipient.id, recipient.senderName, preview, transactionId),
  ]);
  return 'notified';
};

/**
 * @returns {Promise<{events: number, notified: number, failed: number, fullPage: boolean}>}
 */
const processMessageEvents = async ({ integrationSdk, db, log = console.log, now = Date.now() }) => {
  const rootUrl = process.env.REACT_APP_MARKETPLACE_ROOT_URL || 'https://youdu.ae';
  const cursor = await db.getOrStartEventCursor(CURSOR_NAME);
  const position =
    cursor.sequenceId !== null
      ? { startAfterSequenceId: cursor.sequenceId }
      : { createdAtStart: new Date(cursor.updatedAt) };

  const response = await integrationSdk.events.query({ ...position, eventTypes: 'message/created' });
  const events = response?.data?.data || [];
  const result = { events: events.length, notified: 0, failed: 0, fullPage: false };

  for (const event of events) {
    try {
      const outcome = await notifyAboutMessage({ integrationSdk, event, rootUrl, now });
      if (outcome === 'notified') result.notified += 1;
    } catch (error) {
      // One deal that cannot be read must not hold up the others.
      result.failed += 1;
      log(`[messages] ${event.attributes?.resourceId}: сбой — ${error.message}`);
    }
  }

  const last = events[events.length - 1];
  if (last) {
    await db.saveEventCursor(CURSOR_NAME, last.attributes.sequenceId);
  }

  const perPage = response?.data?.meta?.perPage;
  result.fullPage = events.length > 0 && events.length === perPage;
  return result;
};

module.exports = { processMessageEvents, recipientOf, conversationUrl, CURSOR_NAME };
