/**
 * The app's chat list: conversations a person removed from it, and the ones
 * holding a message they have not read.
 *
 * GET  /api/conversations/hidden                  → { hiddenConversations }
 * POST /api/conversations/hide    { transactionId } → { hiddenConversations }
 * POST /api/conversations/unhide  { transactionId } → { hiddenConversations }
 * GET  /api/conversations/deleted                 → { deletedConversations }
 * POST /api/conversations/delete  { counterpartyId, transactionId, until? }
 *                                                  → { deletedConversations }
 * GET  /api/conversations/unread
 *   → { unreadCount, unreadCounterpartyIds, unreadTransactionIds, unreadConversations,
 *       viewedTransactions }
 *
 * unreadConversations is [{ transactionId, counterpartyId, lastMessageAt }],
 * lastMessageAt in ms: a chat the app has read since the count was made, up to
 * that message, is no longer unread. viewedTransactions is { transactionId: ms },
 * the read marks from every device and the site, so a phone can clear what was
 * read elsewhere.
 *
 * hiddenConversations is { transactionId: hiddenAtMs }. Sharetribe cannot
 * delete a transaction, so the conversation stays there for the other party
 * and only drops out of this person's list; a new message in it brings it back
 * (server/reminders/messageNotifications.js).
 *
 * deletedConversations is { counterpartyId: deletedUntilMs }: the app's chat
 * with a person spans all deals with them, and deleting it hides every
 * message sent up to that time, in all those deals, for this person only.
 * A later message starts a clean chat. transactionId is any deal between the
 * two, as proof that they talked; until is the ISO time of the newest message
 * the person saw, so one that arrived while they were deleting survives. It
 * defaults to now.
 *
 * The unread count is the one the icon badge shows: people, not deals
 * (api-util/unreadConversations).
 *
 * The acting user always comes from the session (requireUser).
 */

const db = require('../db');
const { createIntegrationSdk } = require('../reminders/context');
const { getUnreadConversations } = require('../api-util/unreadConversations');
const { sendBadgeUpdate } = require('./send-notification');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const uuidOf = ref => {
  const id = ref?.data?.id;
  return id?.uuid || id || null;
};

/** The ids of the deal's two parties; none when Sharetribe does not know it. */
const partiesOf = async transactionId => {
  const integrationSdk = createIntegrationSdk();
  if (!integrationSdk) throw new Error('Integration API credentials not configured');
  try {
    const response = await integrationSdk.transactions.show({
      id: transactionId,
      include: ['customer', 'provider'],
    });
    const { customer, provider } = response.data.data.relationships || {};
    return [uuidOf(customer), uuidOf(provider)].filter(Boolean);
  } catch (error) {
    if (error.status === 404) return [];
    throw error;
  }
};

const isParty = async (transactionId, userId) =>
  (await partiesOf(transactionId)).includes(userId);

const validTransactionId = req => {
  const { transactionId } = req.body || {};
  return UUID.test(String(transactionId || '')) ? transactionId : null;
};

const getHidden = async (req, res) => {
  try {
    const hiddenConversations = await db.getHiddenConversations(req.authUserId);
    return res.status(200).json({ hiddenConversations });
  } catch (error) {
    console.error('❌ get-hidden-conversations failed:', error.message);
    return res.status(500).json({ error: 'Could not load hidden conversations' });
  }
};

const hide = async (req, res) => {
  const transactionId = validTransactionId(req);
  if (!transactionId) {
    return res.status(400).json({ error: 'transactionId is required' });
  }
  try {
    // Only one's own conversations, so the list cannot fill up with other ids.
    if (!(await isParty(transactionId, req.authUserId))) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    await db.hideConversation(req.authUserId, transactionId);
    // A hidden conversation no longer counts as unread.
    sendBadgeUpdate(req.authUserId);
    const hiddenConversations = await db.getHiddenConversations(req.authUserId);
    return res.status(200).json({ hiddenConversations });
  } catch (error) {
    console.error('❌ hide-conversation failed:', error.message);
    return res.status(500).json({ error: 'Could not hide the conversation' });
  }
};

const unhide = async (req, res) => {
  const transactionId = validTransactionId(req);
  if (!transactionId) {
    return res.status(400).json({ error: 'transactionId is required' });
  }
  try {
    await db.unhideConversation(req.authUserId, transactionId);
    sendBadgeUpdate(req.authUserId);
    const hiddenConversations = await db.getHiddenConversations(req.authUserId);
    return res.status(200).json({ hiddenConversations });
  } catch (error) {
    console.error('❌ unhide-conversation failed:', error.message);
    return res.status(500).json({ error: 'Could not show the conversation' });
  }
};

const getDeleted = async (req, res) => {
  try {
    const deletedConversations = await db.getDeletedConversations(req.authUserId);
    return res.status(200).json({ deletedConversations });
  } catch (error) {
    console.error('❌ get-deleted-conversations failed:', error.message);
    return res.status(500).json({ error: 'Could not load deleted conversations' });
  }
};

const deleteHistory = async (req, res) => {
  const transactionId = validTransactionId(req);
  const { counterpartyId, until } = req.body || {};
  if (!transactionId || !UUID.test(String(counterpartyId || ''))) {
    return res.status(400).json({ error: 'counterpartyId and transactionId are required' });
  }
  const now = Date.now();
  const seenUntil = until == null ? now : Date.parse(until);
  if (Number.isNaN(seenUntil)) {
    return res.status(400).json({ error: 'until must be an ISO date' });
  }
  try {
    // Only someone the user dealt with, so the list cannot fill up with other ids.
    const parties = await partiesOf(transactionId);
    if (
      counterpartyId === req.authUserId ||
      !parties.includes(req.authUserId) ||
      !parties.includes(counterpartyId)
    ) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    await db.deleteConversationHistory(
      req.authUserId,
      counterpartyId,
      new Date(Math.min(seenUntil, now))
    );
    // A deleted chat no longer counts as unread.
    sendBadgeUpdate(req.authUserId);
    const deletedConversations = await db.getDeletedConversations(req.authUserId);
    return res.status(200).json({ deletedConversations });
  } catch (error) {
    console.error('❌ delete-conversation failed:', error.message);
    return res.status(500).json({ error: 'Could not delete the conversation' });
  }
};

const getUnread = async (req, res) => {
  try {
    const {
      transactionIds,
      counterpartyIds,
      conversations,
      viewedTransactions,
    } = await getUnreadConversations(req.authUserId);
    return res.status(200).json({
      unreadCount: counterpartyIds.length,
      unreadCounterpartyIds: counterpartyIds,
      unreadTransactionIds: transactionIds,
      unreadConversations: conversations,
      viewedTransactions,
    });
  } catch (error) {
    console.error('❌ unread-conversations failed:', error.message);
    return res.status(500).json({ error: 'Could not count unread conversations' });
  }
};

module.exports = { getHidden, hide, unhide, getDeleted, deleteHistory, getUnread };
