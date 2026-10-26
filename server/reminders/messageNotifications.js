/**
 * Tells people about new offers and chat messages, whichever side wrote and
 * from wherever — the site, the app or Console.
 *
 * Chat messages and offers go to the recipient only, by Telegram and push.
 * Before this the app asked the server to notify after sending, which reached
 * both parties including the sender, and the site never asked, so replies
 * written on the site notified nobody. Reviews are pushed to the reviewed party
 * the same way. A new message also brings a conversation that either party
 * hid in the app back to their chat lists, and is noted for the recipient's
 * unread count, the app's icon badge (api-util/unreadConversations).
 *
 * E-mail: Sharetribe mails offers, messages and the process letters of later
 * steps (chosen, declined, completed, reviews) only to verified addresses, and
 * most people who sign up by e-mail never verify. For them the letter comes
 * from here (dealEmails); verified addresses are left to Sharetribe.
 *
 * An offer is a new transaction plus, usually, the specialist's opening
 * message written in the same second. That message is part of the offer, not
 * a chat reply: the author hears about the offer once, from handleOffer.
 *
 * Roles are inverted in YouDu: the task author is the Sharetribe provider and
 * sees the deal under /sale/:id, the specialist is the customer (/order/:id).
 */

const { notifyNewMessage, notifyNewOffer } = require('../api/telegram-bot');
const {
  sendNewMessageNotification,
  sendNewOfferNotification,
  sendReviewNotification,
} = require('../api/send-notification');
const { sendDealEmail, TRANSITION_LETTERS } = require('../api-util/dealEmails');

const CURSOR_NAME = 'message-notifications';
const EVENT_TYPES = 'message/created,transaction/initiated,transaction/transitioned';
const PREVIEW_LENGTH = 100;
// After an outage, hours-old news is no longer news.
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
// The opening message of an offer is written right after the offer itself.
const OFFER_MESSAGE_WINDOW_MS = 2 * 60 * 1000;
// Sharetribe checks each uploaded file before it opens, usually within
// seconds; a photo still unchecked after this long is taken as lost.
const PHOTO_WAIT_MS = 30 * 60 * 1000;
const PHOTO_INCLUDE = ['publicFileAttachments', 'publicFileAttachments.file'];

// The second review publishes both; a first one stays hidden until then.
const REVIEW_TRANSITIONS = {
  'transition/review-1-by-provider': { published: false },
  'transition/review-1-by-customer': { published: false },
  'transition/review-2-by-provider': { published: true },
  'transition/review-2-by-customer': { published: true },
};

const uuidOf = id => id?.uuid || id || null;
const idOf = ref => uuidOf(ref?.data?.id);

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
 * 'none' without photos, 'ready' once every photo opens, 'failed' when one
 * never will, otherwise 'waiting'.
 */
const photoState = (message, included) => {
  const refs = message?.relationships?.publicFileAttachments?.data || [];
  if (refs.length === 0) return 'none';
  const find = (type, id) => included.find(item => item.type === type && uuidOf(item.id) === id);
  const states = refs.map(ref => {
    const attachment = find('fileAttachment', uuidOf(ref.id));
    const file =
      attachment &&
      !attachment.attributes?.deleted &&
      find('file', idOf(attachment.relationships?.file));
    return file && !file.attributes?.deleted ? file.attributes?.state : 'verificationFailed';
  });
  if (states.includes('verificationFailed')) return 'failed';
  return states.every(state => state === 'available') ? 'ready' : 'waiting';
};

const loadMessages = async (integrationSdk, messageIds, include) => {
  const response = await integrationSdk.messages.query({ ids: messageIds.join(','), include });
  const included = response.data.included || [];
  return (response.data.data || []).map(message => ({
    message,
    messageId: uuidOf(message.id),
    photos: photoState(message, included),
  }));
};

// Without an answer the notice goes out at once, as before photos were checked.
const photosOf = async (integrationSdk, messageId, log) => {
  try {
    const [found] = await loadMessages(integrationSdk, [messageId], PHOTO_INCLUDE);
    return found?.photos || 'none';
  } catch (error) {
    log(`[messages] ${messageId}: фото не проверены — ${error.message}`);
    return 'none';
  }
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

const deliver = async (transactionId, deliveries) => {
  const results = await Promise.allSettled(deliveries);
  results
    .filter(r => r.status === 'rejected')
    .forEach(r => console.error(`[messages] ${transactionId}: доставка не удалась — ${r.reason?.message}`));
  return results;
};

const handleMessage = async ({
  integrationSdk,
  message,
  messageId,
  rootUrl,
  db,
  log = console.log,
  photosChecked = false,
}) => {
  const transactionId = idOf(message?.relationships?.transaction);
  const senderId = idOf(message?.relationships?.sender);
  if (!transactionId || !senderId || !messageId) return 'incomplete';

  const deal = await loadDeal(integrationSdk, transactionId);
  const recipient = recipientOf(deal, senderId);
  if (!recipient) return 'no-recipient';
  if (db && (await db.hasBlocked(recipient.id, senderId))) return 'blocked';

  const sentAt = new Date(message.attributes.createdAt).getTime();
  const dealCreatedAt = new Date(deal.transaction.attributes.createdAt).getTime();
  if (recipient.role === 'provider' && sentAt - dealCreatedAt <= OFFER_MESSAGE_WINDOW_MS) {
    return 'offer-text';
  }

  if (!photosChecked) {
    const photos = await photosOf(integrationSdk, messageId, log);
    if (photos === 'failed') return 'photo-failed';
    if (photos === 'waiting') {
      await db.waitForMessagePhotos(messageId);
      return 'waiting-for-photo';
    }
  }

  // The cursor moves only after a whole page, so a crash halfway through or a
  // second poller would replay messages; the claim keeps each to one notice.
  const claim = {
    reminderType: 'chat-message',
    subjectId: messageId,
    recipientUserId: recipient.id,
  };
  if (db && !(await db.claimReminder(claim))) return 'already-sent';
  // After the claim, so a replayed message cannot bring back a conversation
  // that was hidden again since. Failing here must not cost the notice.
  if (db) {
    await db
      .unhideConversationForAll(transactionId)
      .catch(error =>
        console.error(`[messages] ${transactionId}: диалог не вернулся в список — ${error.message}`)
      );
    // Before the push, whose icon badge counts this message.
    await db
      .recordReceivedMessage({
        userId: recipient.id,
        transactionId,
        senderId,
        sentAt,
        lastTransition: deal.transaction.attributes.lastTransition,
      })
      .catch(error =>
        console.error(
          `[messages] ${transactionId}: сообщение не попало в счётчик — ${error.message}`
        )
      );
  }

  const senderName = displayName(recipient.sender.user);
  const preview = String(message.attributes?.content || '').slice(0, PREVIEW_LENGTH) || 'Новое сообщение';
  const url = conversationUrl(rootUrl, transactionId, recipient.role);

  let pushedAt = null;
  const deliveries = [
    notifyNewMessage(recipient.id, { senderName, messagePreview: preview, conversationUrl: url }),
    sendNewMessageNotification({
      recipientId: recipient.id,
      senderId,
      senderName,
      preview,
      transactionId,
      messageId,
      messageCreatedAt: new Date(sentAt).toISOString(),
    }).finally(() => {
      pushedAt = Date.now();
    }),
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
  const [, push] = await deliver(transactionId, deliveries);
  const accepted = push.status === 'fulfilled' ? push.value?.sent || 0 : 0;
  const seconds = ((pushedAt - sentAt) / 1000).toFixed(1);
  const waited = photosChecked ? ' (ждали проверки фото)' : '';
  log(
    `[messages] ${messageId}: push через ${seconds} с после сообщения${waited}, FCM принял для ${accepted} устр.`
  );
  return 'notified';
};

/**
 * The app creates offers straight through the Marketplace API, bypassing our
 * server, so this is the one place that sees every offer.
 */
const handleOffer = async ({ integrationSdk, transactionRef, rootUrl, db }) => {
  if (transactionRef?.attributes?.lastTransition !== 'transition/inquire') return 'not-offer';

  const transactionId = transactionRef.id?.uuid || transactionRef.id;
  const deal = await loadDeal(integrationSdk, transactionId);
  const author = deal.provider;
  if (!author || !deal.listing) return 'incomplete';
  if (db && deal.customer && (await db.hasBlocked(author.id, deal.customer.id))) return 'blocked';

  const claim = { reminderType: 'new-offer', subjectId: transactionId, recipientUserId: author.id };
  if (db && !(await db.claimReminder(claim))) return 'already-sent';

  const offer = deal.transaction.attributes.protectedData?.offer || {};
  const listingTitle = deal.listing.attributes.title;
  const listingId = deal.listing.id?.uuid || deal.listing.id;
  const executorName = displayName(deal.customer?.user);
  const offerPrice = offer.price ? `${offer.price} ${offer.currency || 'AED'}` : null;
  const listingUrl = `${rootUrl}/l/${listingId}`;

  const deliveries = [
    notifyNewOffer(author.id, { listingTitle, executorName, offerPrice, listingUrl }),
    sendNewOfferNotification({
      recipientId: author.id,
      senderId: deal.customer?.id,
      executorName,
      listingTitle,
      listingId,
      transactionId,
      price: offerPrice,
    }),
  ];
  if (needsOwnEmail(author.user)) {
    deliveries.push(
      sendDealEmail('offer', author.user.attributes.email, {
        recipientName: displayName(author.user),
        listingTitle,
        executorName,
        price: offer.price,
        currency: offer.currency,
        comment: offer.comment,
        listingUrl,
      })
    );
  }
  await deliver(transactionId, deliveries);
  return 'notified';
};

/**
 * A letter about a deal step for an unverified address, and a push to whoever
 * was just reviewed.
 */
const handleTransition = async ({ integrationSdk, transactionRef, rootUrl, db }) => {
  const transition = transactionRef?.attributes?.lastTransition;
  const transactionId = transactionRef?.id?.uuid || transactionRef?.id;
  // The unread count follows the step, since the app shows chats only at some.
  if (db && transactionId && transition) {
    await db
      .setReceivedMessageTransition(transactionId, transition)
      .catch(error =>
        console.error(
          `[messages] ${transactionId}: шаг сделки не попал в счётчик — ${error.message}`
        )
      );
  }

  const spec = TRANSITION_LETTERS[transition];
  if (!spec) return 'no-letter';

  const deal = await loadDeal(integrationSdk, transactionId);
  const recipient = deal[spec.to];
  const other = deal[spec.to === 'customer' ? 'provider' : 'customer'];
  if (!recipient) return 'incomplete';

  const deliveries = [];
  const review = REVIEW_TRANSITIONS[transition];
  const claim = {
    reminderType: 'review-push',
    subjectId: `${transactionId}:${transition}`,
    recipientUserId: recipient.id,
  };
  if (review && (!db || (await db.claimReminder(claim)))) {
    deliveries.push(
      sendReviewNotification({
        recipientId: recipient.id,
        reviewerId: other?.id,
        reviewerName: displayName(other?.user),
        transactionId,
        published: review.published,
      })
    );
  }
  if (needsOwnEmail(recipient.user)) {
    deliveries.push(
      sendDealEmail('transition', recipient.user.attributes.email, {
        transition,
        recipientName: displayName(recipient.user),
        otherName: displayName(other?.user),
        listingTitle: deal.listing?.attributes?.title || 'Задание',
        transactionId,
      })
    );
  }
  if (deliveries.length === 0) return 'sharetribe-mails';

  await deliver(transactionId, deliveries);
  return 'notified';
};

const handleEvent = ({ integrationSdk, event, rootUrl, now, db, log }) => {
  const { eventType, resource, resourceId, createdAt } = event.attributes;
  if (now - new Date(createdAt).getTime() > MAX_AGE_MS) return 'stale';
  if (eventType === 'message/created') {
    return handleMessage({
      integrationSdk,
      message: resource,
      messageId: uuidOf(resourceId),
      rootUrl,
      db,
      log,
    });
  }
  if (eventType === 'transaction/initiated') {
    return handleOffer({ integrationSdk, transactionRef: resource, rootUrl, db });
  }
  if (eventType === 'transaction/transitioned') {
    return handleTransition({ integrationSdk, transactionRef: resource, rootUrl, db });
  }
  return 'ignored';
};

/**
 * Tells about the messages held back for their photos once Sharetribe has
 * checked them, with one query a tick for all of them.
 */
const processPhotoWaits = async ({ integrationSdk, db, rootUrl, now, log }) => {
  const waits = await db.getMessagePhotoWaits();
  if (waits.length === 0) return 0;

  const found = await loadMessages(integrationSdk, waits.map(wait => wait.messageId), [
    'sender',
    'transaction',
    ...PHOTO_INCLUDE,
  ]);
  let notified = 0;
  for (const { messageId, waitingSince } of waits) {
    const item = found.find(candidate => candidate.messageId === messageId);
    const photos = item && !item.message.attributes?.deleted ? item.photos : 'failed';
    if (photos === 'waiting' && now - new Date(waitingSince).getTime() < PHOTO_WAIT_MS) continue;

    await db.stopWaitingForMessagePhotos(messageId);
    if (photos === 'failed' || photos === 'waiting') {
      const why =
        photos === 'failed' ? 'не прошло проверку' : `не проверено за ${PHOTO_WAIT_MS / 60000} мин`;
      log(`[messages] ${messageId}: фото ${why}, уведомления не будет`);
      continue;
    }
    try {
      const outcome = await handleMessage({
        integrationSdk,
        message: item.message,
        messageId,
        rootUrl,
        db,
        log,
        photosChecked: true,
      });
      if (outcome === 'notified') notified += 1;
    } catch (error) {
      log(`[messages] ${messageId}: сбой — ${error.message}`);
    }
  }
  return notified;
};

/**
 * @returns {Promise<{events: number, notified: number, failed: number, fullPage: boolean}>}
 */
const processMessageEvents = async ({ integrationSdk, db, log = console.log, now = Date.now() }) => {
  const rootUrl = process.env.REACT_APP_MARKETPLACE_ROOT_URL || 'https://youdu.ae';
  const notifiedAfterPhotos = await processPhotoWaits({
    integrationSdk,
    db,
    rootUrl,
    now,
    log,
  }).catch(error => {
    log(`[messages] ожидание фото: сбой — ${error.message}`);
    return 0;
  });
  const cursor = await db.getOrStartEventCursor(CURSOR_NAME);
  const position =
    cursor.sequenceId !== null
      ? { startAfterSequenceId: cursor.sequenceId }
      : { createdAtStart: new Date(cursor.updatedAt) };

  const response = await integrationSdk.events.query({ ...position, eventTypes: EVENT_TYPES });
  const events = response?.data?.data || [];
  const result = {
    events: events.length,
    notified: notifiedAfterPhotos,
    failed: 0,
    fullPage: false,
  };

  for (const event of events) {
    try {
      const outcome = await handleEvent({ integrationSdk, event, rootUrl, now, db, log });
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
