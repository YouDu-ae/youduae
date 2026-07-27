/**
 * API для системы тикетов поддержки
 * Интеграция с Telegram для уведомлений и ответов
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_SUPPORT_CHAT_ID = process.env.TELEGRAM_SUPPORT_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

let db = null;
const getDb = () => {
  if (!db && process.env.DATABASE_URL) {
    db = require('../db');
  }
  return db;
};

/**
 * Send ticket notification to Telegram
 */
async function sendTicketToTelegram(ticket, message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_SUPPORT_CHAT_ID) {
    console.log('⚠️ Telegram support chat not configured');
    return null;
  }

  const priorityEmoji = {
    urgent: '🔴',
    high: '🟠',
    normal: '🟡',
    low: '🟢',
  };

  const categoryLabels = {
    general: 'Общий вопрос',
    payment: 'Оплата',
    listing: 'Задание',
    account: 'Аккаунт',
    technical: 'Технический',
    complaint: 'Жалоба',
  };

  const text = `📩 <b>Новый тикет ${ticket.ticket_id}</b>

${priorityEmoji[ticket.priority] || '🟡'} Приоритет: ${ticket.priority}
📁 Категория: ${categoryLabels[ticket.category] || ticket.category}
${ticket.related_listing_id ? `🔗 Задание: ${ticket.related_listing_id}\n` : ''}
👤 <b>${ticket.user_name || 'Гость'}</b>
📧 ${ticket.user_email}

<b>Тема:</b> ${ticket.subject}

<b>Сообщение:</b>
${message}

━━━━━━━━━━━━━━━
<i>Ответьте на это сообщение (reply), чтобы отправить ответ пользователю</i>`;

  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_SUPPORT_CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    
    if (data.ok && data.result) {
      // Save Telegram message ID to ticket
      const database = getDb();
      if (database) {
        await database.updateTicketTelegramId(ticket.ticket_id, data.result.message_id.toString());
      }
      return data.result.message_id;
    }
    
    console.error('Telegram API error:', data);
    return null;
  } catch (error) {
    console.error('Error sending ticket to Telegram:', error);
    return null;
  }
}

/**
 * Send admin reply notification to Telegram (for thread)
 */
async function sendReplyNotificationToTelegram(ticketId, adminName, replyText) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_SUPPORT_CHAT_ID) return null;

  const text = `✅ <b>Ответ отправлен</b>

🎫 Тикет: ${ticketId}
👤 Админ: ${adminName}

${replyText.substring(0, 200)}${replyText.length > 200 ? '...' : ''}`;

  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_SUPPORT_CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
    });
  } catch (error) {
    console.error('Error sending reply notification:', error);
  }
}

/**
 * POST /api/support/create
 * Создание нового тикета
 */
async function createTicket(req, res) {
  try {
    const { subject, message, category, relatedListingId, priority, userEmail, userName, userId } = req.body;

    if (!subject || !message || !userEmail) {
      return res.status(400).json({ error: 'subject, message, and userEmail are required' });
    }

    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const ticket = await database.createTicket({
      subject,
      message,
      category: category || 'general',
      relatedListingId,
      priority: priority || 'normal',
      userEmail,
      userName,
      userId,
    });

    console.log(`🎫 Ticket created: ${ticket.ticket_id}`);

    // Send to Telegram
    await sendTicketToTelegram(ticket, message);

    res.json({
      success: true,
      ticketId: ticket.ticket_id,
      message: 'Ваше обращение принято. Мы ответим в ближайшее время.',
    });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
}

/**
 * GET /api/support/ticket/:ticketId
 * Получение тикета по ID
 */
async function getTicket(req, res) {
  try {
    const { ticketId } = req.params;

    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const ticket = await database.getTicketById(ticketId);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('Error getting ticket:', error);
    res.status(500).json({ error: 'Failed to get ticket' });
  }
}

/**
 * GET /api/support/my-tickets
 * Получение тикетов текущего пользователя
 */
async function getMyTickets(req, res) {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const tickets = await database.getTicketsByUserId(userId);

    res.json({ tickets });
  } catch (error) {
    console.error('Error getting user tickets:', error);
    res.status(500).json({ error: 'Failed to get tickets' });
  }
}

/**
 * POST /api/support/reply
 * Добавление ответа к тикету (от пользователя)
 */
async function addUserReply(req, res) {
  try {
    const { ticketId, message, userName, userEmail } = req.body;

    if (!ticketId || !message) {
      return res.status(400).json({ error: 'ticketId and message are required' });
    }

    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const ticket = await database.getTicketById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    await database.addTicketMessage(ticketId, {
      senderType: 'user',
      senderName: userName || userEmail || 'Пользователь',
      message,
    });

    // Notify admin in Telegram
    await sendTicketToTelegram(
      { ...ticket, ticket_id: ticketId },
      `📝 <b>Новый ответ от пользователя:</b>\n\n${message}`
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error adding user reply:', error);
    res.status(500).json({ error: 'Failed to add reply' });
  }
}

/**
 * POST /api/support/admin/reply
 * Добавление ответа от админа
 */
async function addAdminReply(req, res) {
  try {
    const { ticketId, message, adminName } = req.body;

    if (!ticketId || !message) {
      return res.status(400).json({ error: 'ticketId and message are required' });
    }

    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const ticket = await database.getTicketById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    await database.addTicketMessage(ticketId, {
      senderType: 'admin',
      senderName: adminName || 'Поддержка YouDu',
      message,
    });

    // TODO: Send email to user
    console.log(`📧 Would send email to ${ticket.user_email}: ${message.substring(0, 50)}...`);

    res.json({ success: true });
  } catch (error) {
    console.error('Error adding admin reply:', error);
    res.status(500).json({ error: 'Failed to add reply' });
  }
}

/**
 * POST /api/support/admin/close
 * Закрытие тикета
 */
async function closeTicket(req, res) {
  try {
    const { ticketId } = req.body;

    if (!ticketId) {
      return res.status(400).json({ error: 'ticketId is required' });
    }

    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not available' });
    }

    await database.updateTicketStatus(ticketId, 'closed');

    res.json({ success: true });
  } catch (error) {
    console.error('Error closing ticket:', error);
    res.status(500).json({ error: 'Failed to close ticket' });
  }
}

/**
 * GET /api/support/admin/open
 * Получение открытых тикетов (для админа)
 */
async function getOpenTickets(req, res) {
  try {
    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const tickets = await database.getOpenTickets();

    res.json({ tickets });
  } catch (error) {
    console.error('Error getting open tickets:', error);
    res.status(500).json({ error: 'Failed to get tickets' });
  }
}

/**
 * GET /api/support/stats
 * Статистика тикетов
 */
async function getStats(req, res) {
  try {
    const database = getDb();
    if (!database) {
      return res.json({ open: 0, pending: 0, closed: 0, total: 0 });
    }

    const stats = await database.getTicketStats();

    res.json({
      open: parseInt(stats.open_count) || 0,
      pending: parseInt(stats.pending_count) || 0,
      closed: parseInt(stats.closed_count) || 0,
      total: parseInt(stats.total_count) || 0,
    });
  } catch (error) {
    console.error('Error getting ticket stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
}

/**
 * Handle Telegram reply to ticket
 * Called from telegram-bot.js when admin replies to a ticket message
 */
async function handleTelegramReply(replyToMessageId, adminName, replyText) {
  try {
    const database = getDb();
    if (!database) return { success: false, error: 'Database not available' };

    // Find ticket by Telegram message ID
    const ticket = await database.getTicketByTelegramMessageId(replyToMessageId.toString());
    
    if (!ticket) {
      console.log(`⚠️ No ticket found for Telegram message ${replyToMessageId}`);
      return { success: false, error: 'Ticket not found' };
    }

    // Add admin reply to ticket
    await database.addTicketMessage(ticket.ticket_id, {
      senderType: 'admin',
      senderName: adminName,
      message: replyText,
      telegramMessageId: null,
    });

    console.log(`✅ Admin reply added to ticket ${ticket.ticket_id}`);

    // TODO: Send email notification to user
    console.log(`📧 Would send email to ${ticket.user_email}`);

    return { success: true, ticketId: ticket.ticket_id, userEmail: ticket.user_email };
  } catch (error) {
    console.error('Error handling Telegram reply:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  createTicket,
  getTicket,
  getMyTickets,
  addUserReply,
  addAdminReply,
  closeTicket,
  getOpenTickets,
  getStats,
  handleTelegramReply,
  sendTicketToTelegram,
};
