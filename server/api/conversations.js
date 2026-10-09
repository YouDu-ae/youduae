/**
 * The app's chat list: conversations a person removed from it, and the ones
 * holding a message they have not read.
 *
 * GET  /api/conversations/hidden                  → { hiddenConversations }
 * POST /api/conversations/hide    { transactionId } → { hiddenConversations }
 * POST /api/conversations/unhide  { transactionId } → { hiddenConversations }
 * GET  /api/conversations/unread                  → { unreadCount, unreadTransactionIds }
 *
 * hiddenConversations is { transactionId: hiddenAtMs }. Sharetribe cannot
 * delete a transaction, so the conversation stays there for the other party
 * and only drops out of this person's list; a new message in it brings it back
 * (server/reminders/messageNotifications.js).
 *
 * The unread count is the one the icon badge shows (api-util/unreadConversations).
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

const isParty = async (transactionId, userId) => {
  const integrationSdk = createIntegrationSdk();
  if (!integrationSdk) throw new Error('Integration API credentials not configured');
  try {
    const response = await integrationSdk.transactions.show({
      id: transactionId,
      include: ['customer', 'provider'],
    });
    const { customer, provider } = response.data.data.relationships || {};
    return uuidOf(customer) === userId || uuidOf(provider) === userId;
  } catch (error) {
    if (error.status === 404) return false;
    throw error;
  }
};

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

const getUnread = async (req, res) => {
  try {
    const unreadTransactionIds = await getUnreadConversations(req.authUserId);
    return res.status(200).json({ unreadCount: unreadTransactionIds.length, unreadTransactionIds });
  } catch (error) {
    console.error('❌ unread-conversations failed:', error.message);
    return res.status(500).json({ error: 'Could not count unread conversations' });
  }
};

module.exports = { getHidden, hide, unhide, getUnread };
