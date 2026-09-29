/**
 * Reporting and blocking users — App Store rule 1.2 for apps with user
 * content (chats, profiles, offers).
 *
 * POST /api/moderation/report  { reportedUserId, reason, comment?, transactionId? }
 *   Stores the report and alerts the admin in Telegram right away.
 * GET  /api/moderation/blocks  → { blockedUserIds }
 * POST /api/moderation/blocks  { userId, blocked }
 *
 * The acting user always comes from the session (requireUser).
 */

const db = require('../db');
const { notifyAdminUserReport } = require('./telegram-bot');

const REASONS = ['spam', 'abuse', 'fraud', 'inappropriate', 'other'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_COMMENT_LENGTH = 500;

const reportUser = async (req, res) => {
  const { reportedUserId, reason, comment, transactionId } = req.body || {};
  const reporterId = req.authUserId;

  if (!UUID.test(String(reportedUserId || '')) || reportedUserId === reporterId) {
    return res.status(400).json({ error: 'reportedUserId is required' });
  }
  if (!REASONS.includes(reason)) {
    return res.status(400).json({ error: 'Unknown reason' });
  }
  const safeTransactionId = UUID.test(String(transactionId || '')) ? transactionId : null;
  const safeComment = typeof comment === 'string' ? comment.trim().slice(0, MAX_COMMENT_LENGTH) : '';

  try {
    const reportId = await db.createUserReport({
      reporterId,
      reportedId: reportedUserId,
      reason,
      comment: safeComment,
      transactionId: safeTransactionId,
    });
    // The report is stored either way; a Telegram failure must not lose it.
    await notifyAdminUserReport({
      reportId,
      reporterId,
      reportedId: reportedUserId,
      reason,
      comment: safeComment,
      transactionId: safeTransactionId,
    }).catch(error => console.error('Report alert failed:', error.message));

    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error('❌ report-user failed:', error.message);
    return res.status(500).json({ error: 'Could not send the report' });
  }
};

const getBlocks = async (req, res) => {
  try {
    const blockedUserIds = await db.getBlockedUserIds(req.authUserId);
    return res.status(200).json({ blockedUserIds });
  } catch (error) {
    console.error('❌ get-blocks failed:', error.message);
    return res.status(500).json({ error: 'Could not load blocked users' });
  }
};

const setBlock = async (req, res) => {
  const { userId, blocked } = req.body || {};
  if (!UUID.test(String(userId || '')) || userId === req.authUserId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  try {
    await db.setUserBlocked(req.authUserId, userId, blocked !== false);
    const blockedUserIds = await db.getBlockedUserIds(req.authUserId);
    return res.status(200).json({ blockedUserIds });
  } catch (error) {
    console.error('❌ set-block failed:', error.message);
    return res.status(500).json({ error: 'Could not update the block' });
  }
};

module.exports = { reportUser, getBlocks, setBlock, REASONS };
