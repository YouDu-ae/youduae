/**
 * Conversations a person removed from their chat list in the app.
 *
 * GET  /api/conversations/hidden                  → { hiddenConversations }
 * POST /api/conversations/hide    { transactionId } → { hiddenConversations }
 * POST /api/conversations/unhide  { transactionId } → { hiddenConversations }
 *
 * hiddenConversations is { transactionId: hiddenAtMs }. Sharetribe cannot
 * delete a transaction, so the conversation stays there for the other party
 * and only drops out of this person's list; a new message in it brings it back
 * (server/reminders/messageNotifications.js).
 *
 * The acting user always comes from the session (requireUser).
 */

const db = require('../db');
const { createIntegrationSdk } = require('../reminders/context');

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
    const hiddenConversations = await db.getHiddenConversations(req.authUserId);
    return res.status(200).json({ hiddenConversations });
  } catch (error) {
    console.error('❌ unhide-conversation failed:', error.message);
    return res.status(500).json({ error: 'Could not show the conversation' });
  }
};

module.exports = { getHidden, hide, unhide };
