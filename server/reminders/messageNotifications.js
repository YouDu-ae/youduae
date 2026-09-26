/**
 * Tells people about new offers and chat messages, whichever side wrote and
 * from wherever — the site, the app or Console.
 *
 * Chat messages go to the recipient only, by Telegram and push. Before this
 * the app asked the server to notify after sending, which reached both parties
 * including the sender, and the site never asked, so replies written on the
 * site notified nobody.
 *
 * E-mail: Sharetribe mails offers and messages only to verified addresses, and
 * most people who sign up by e-mail never verify. For them the letter comes
 * from here (dealEmails); verified addresses are left to Sharetribe.
 *
 * An offer is a new transaction plus, usually, the specialist's opening
 * message written in the same second. That message is part of the offer, not
 * a chat reply, and the offer already has its own Telegram (initiate-privileged).
 *
 * Roles are inverted in YouDu: the task author is the Sharetribe provider and
 * sees the deal under /sale/:id, the specialist is the customer (/order/:id).
 */

const { notifyNewMessage } = require('../api/telegram-bot');
const { sendNewMessageNotification } = require('../api/send-notification');
const { sendDealEmail } = require('../api-util/dealEmails');

const CURSOR_NAME = 'message-notifications';
const EVENT_TYPES = 'message/created,transaction/initiated';
const PREVIEW_LENGTH = 100;
// After an outage, hours-old news is no longer news.
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
// The opening message of an offer is written right after the offer itself.
const OFFER_MESSAGE_WINDOW_MS = 2 * 60 * 1000;

const idOf = ref => {
  const id = ref?.data?.id;
  return id?.uuid || id || null;
};

const displayName = user =>
  user?.attributes?.profile?.displayName || user?.attributes?.profile?.firstName || 'Пользователь';

const needsOwnEmail = user =>
  !!user?.attributes?.email && user.attributes.emailVerified === false && !user.attributes.deleted;

const conversationUrl = (rootUrl, transactionId, role) =>
  `${rootUrl}/${role === 'provider' ? 'sale' : 'order'}/${transactionId}`;

const loadDeal = async (integrationSdk, transactionId) => {
  const response = await integrationSdk.transactions.show({
    id: transactionId,
    include: ['customer', 'provider', 'listing'],
  });
  const transaction = response.data.data;
  const included = response.data.included || [];
  const find = (type, id) => included.find(item => item.type === type && (item.id?.uuid || item.id) === id);
  const customerId = idOf(transaction.relationships?.customer);
  const providerId = idOf(transaction.relationships?.provider);
  return {
    transaction,
    customer: customerId ? { id: customerId, user: find('user', customerId) } : null,
    provider: providerId ? { id: providerId, user: find('user', providerId) } : null,
    listing: find('listing', idOf(transaction.relationships?.listing)),
  };
};

/**
 * Who gets told about a message, or null when there is nobody to tell.
 */
const recipientOf = (deal, senderId) => {
  if (deal.customer && deal.provider && senderId === deal.customer.id) {
    return { ...deal.provider, role: 'provider', sender: deal.customer };
  }
  if (deal.customer && deal.provider && senderId === deal.provider.id) {
    return { ...deal.customer, role: 'customer', sender: deal.provider };
  }
  return null;
};

const handleMessage = async ({ integrationSdk, message, rootUrl }) => {
  const transactionId = idOf(message?.relationships?.transaction);
  const senderId = idOf(message?.relationships?.sender);
  if (!transactionId || !senderId) return 'incomplete';

  const deal = await loadDeal(integrationSdk, transactionId);
  const recipient = recipientOf(deal, senderId);
  if (!recipient) return 'no-recipient';

  const sentAt = new Date(message.attributes.createdAt).getTime();
  const dealCreatedAt = new Date(deal.transaction.attributes.createdAt).getTime();
  if (recipient.role === 'provider' && sentAt - dealCreatedAt <= OFFER_MESSAGE_WINDOW_MS) {
    return 'offer-text';
  }

  const senderName = displayName(recipient.sender.user);
  const preview = String(message.attributes?.content || '').slice(0, PREVIEW_LENGTH) || 'Новое сообщение';
  const url = conversationUrl(rootUrl, transactionId, recipient.role);

  const deliveries = [
    notifyNewMessage(recipient.id, { senderName, messagePreview: preview, conversationUrl: url }),
    sendNewMessageNotification(recipient.id, senderName, preview, transactionId),
  ];
  if (needsOwnEmail(recipient.user)) {
    deliveries.push(
      sendDealEmail('message', recipient.user.attributes.email, {
        recipientName: displayName(recipient.user),
        senderName,
        listingTitle: deal.listing?.attributes?.title,
        preview,
        conversationUrl: url,
      })
    );
  }
  const results = await Promise.allSettled(deliveries);
  results
    .filter(r => r.status === 'rejected')
    .forEach(r => console.error(`[messages] ${transactionId}: доставка не удалась — ${r.reason?.message}`));
  return 'notified';
};

const handleOffer = async ({ integrationSdk, transactionRef, rootUrl }) => {
  if (transactionRef?.attributes?.lastTransition !== 'transition/inquire') return 'not-offer';

  const deal = await loadDeal(integrationSdk, transactionRef.id?.uuid || transactionRef.id);
  const author = deal.provider;
  if (!author || !needsOwnEmail(author.user) || !deal.listing) return 'sharetribe-mails';

  const offer = deal.transaction.attributes.protectedData?.offer || {};
  await sendDealEmail('offer', author.user.attributes.email, {
    recipientName: displayName(author.user),
    listingTitle: deal.listing.attributes.title,
    executorName: displayName(deal.customer?.user),
    price: offer.price,
    currency: offer.currency,
    comment: offer.comment,
    listingUrl: `${rootUrl}/l/${deal.listing.id?.uuid || deal.listing.id}`,
  });
  return 'notified';
};

const handleEvent = ({ integrationSdk, event, rootUrl, now }) => {
  const { eventType, resource, createdAt } = event.attributes;
  if (now - new Date(createdAt).getTime() > MAX_AGE_MS) return 'stale';
  if (eventType === 'message/created') return handleMessage({ integrationSdk, message: resource, rootUrl });
  if (eventType === 'transaction/initiated') {
    return handleOffer({ integrationSdk, transactionRef: resource, rootUrl });
  }
  return 'ignored';
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

  const response = await integrationSdk.events.query({ ...position, eventTypes: EVENT_TYPES });
  const events = response?.data?.data || [];
  const result = { events: events.length, notified: 0, failed: 0, fullPage: false };

  for (const event of events) {
    try {
      const outcome = await handleEvent({ integrationSdk, event, rootUrl, now });
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
