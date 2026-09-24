const { Pool } = require('pg');
const { createContextViews } = require('./contextViews');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

const initDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS blog_categories (
        id VARCHAR(50) PRIMARY KEY,
        name_ru VARCHAR(255) NOT NULL,
        name_en VARCHAR(255) NOT NULL,
        description_ru TEXT,
        description_en TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS blog_articles (
        id VARCHAR(100) PRIMARY KEY,
        slug VARCHAR(255) UNIQUE NOT NULL,
        category_id VARCHAR(50) REFERENCES blog_categories(id),
        title_ru VARCHAR(500) NOT NULL,
        title_en VARCHAR(500),
        description_ru TEXT,
        description_en TEXT,
        content_ru TEXT,
        content_en TEXT,
        image VARCHAR(500),
        read_time INTEGER DEFAULT 2,
        author_name VARCHAR(255),
        author_avatar VARCHAR(500),
        keywords TEXT,
        featured BOOLEAN DEFAULT FALSE,
        status VARCHAR(20) DEFAULT 'draft',
        telegram_message_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Add keywords column if not exists (migration)
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='blog_articles' AND column_name='keywords') THEN
          ALTER TABLE blog_articles ADD COLUMN keywords TEXT;
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS blog_pending_posts (
        id VARCHAR(100) PRIMARY KEY,
        telegram_message_id VARCHAR(100),
        telegram_chat_id VARCHAR(100),
        sender_name VARCHAR(255),
        sender_id VARCHAR(100),
        text TEXT NOT NULL,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending'
      );

      CREATE INDEX IF NOT EXISTS idx_articles_category ON blog_articles(category_id);
      CREATE INDEX IF NOT EXISTS idx_articles_status ON blog_articles(status);
      CREATE INDEX IF NOT EXISTS idx_articles_created ON blog_articles(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_pending_status ON blog_pending_posts(status);

      -- Listing ID counter table
      CREATE TABLE IF NOT EXISTS listing_id_counter (
        id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
        current_value INTEGER NOT NULL DEFAULT 0,
        prefix VARCHAR(10) NOT NULL DEFAULT 'YD',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Listing ID mapping (links public ID to Sharetribe UUID)
      CREATE TABLE IF NOT EXISTS listing_id_mapping (
        public_id VARCHAR(20) PRIMARY KEY,
        sharetribe_uuid VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_listing_mapping_uuid ON listing_id_mapping(sharetribe_uuid);

      -- Support tickets table
      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        ticket_id VARCHAR(20) UNIQUE NOT NULL,
        user_id VARCHAR(100),
        user_email VARCHAR(255) NOT NULL,
        user_name VARCHAR(255),
        subject VARCHAR(500) NOT NULL,
        category VARCHAR(50) DEFAULT 'general',
        related_listing_id VARCHAR(20),
        status VARCHAR(20) DEFAULT 'open',
        priority VARCHAR(20) DEFAULT 'normal',
        telegram_message_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP
      );

      -- Ticket messages (conversation thread)
      CREATE TABLE IF NOT EXISTS ticket_messages (
        id SERIAL PRIMARY KEY,
        ticket_id VARCHAR(20) REFERENCES support_tickets(ticket_id),
        sender_type VARCHAR(20) NOT NULL,
        sender_name VARCHAR(255),
        message TEXT NOT NULL,
        telegram_message_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Ticket ID counter
      CREATE TABLE IF NOT EXISTS ticket_id_counter (
        id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
        current_value INTEGER NOT NULL DEFAULT 0,
        prefix VARCHAR(10) NOT NULL DEFAULT 'TK',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id);
      CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
      CREATE INDEX IF NOT EXISTS idx_tickets_created ON support_tickets(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);

      -- Telegram subscribers. Mirrors who linked the bot so notifications no
      -- longer require scanning every marketplace user through the
      -- Integration API, which silently capped the audience at 100 users.
      CREATE TABLE IF NOT EXISTS telegram_subscribers (
        user_id VARCHAR(100) PRIMARY KEY,
        chat_id VARCHAR(100) NOT NULL,
        telegram_username VARCHAR(255),
        display_name VARCHAR(255),
        user_type VARCHAR(20),
        categories TEXT[] NOT NULL DEFAULT '{}',
        notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        failure_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_tg_subscribers_categories
        ON telegram_subscribers USING GIN (categories);
      CREATE INDEX IF NOT EXISTS idx_tg_subscribers_active
        ON telegram_subscribers (is_active, notifications_enabled);

      -- Every reminder the scheduler has already sent. The unique key is what
      -- keeps a nagging bot from existing: a reminder is claimed here before it
      -- is sent, so a re-run, an overlapping run, or a retry stays silent.
      -- subject_id is whatever makes the reminder unique for its type — a
      -- listing id for per-task reminders, a date for daily digests.
      CREATE TABLE IF NOT EXISTS reminder_log (
        id SERIAL PRIMARY KEY,
        reminder_type VARCHAR(50) NOT NULL,
        subject_id VARCHAR(100) NOT NULL,
        recipient_user_id VARCHAR(100) NOT NULL,
        details JSONB,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (reminder_type, subject_id, recipient_user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_reminder_log_sent
        ON reminder_log (reminder_type, sent_at);

      -- One row per conversation in the voice task-intake pilot. It is the
      -- per-user daily budget (the IP rate limiter cannot tell users apart),
      -- the proof that a tool call belongs to a session its caller opened, and
      -- the pilot's own funnel: how many conversations ended in a draft.
      CREATE TABLE IF NOT EXISTS voice_sessions (
        session_id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        draft_ready_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_started
        ON voice_sessions (user_id, started_at);

      -- Where each consumer of Sharetribe events stopped reading. Events are
      -- strictly ordered by sequence_id, so resuming after the stored value
      -- neither skips nor repeats one across restarts. A NULL sequence_id means
      -- the consumer has started but seen nothing yet; it then reads from
      -- updated_at, so switching a consumer on never replays old history.
      CREATE TABLE IF NOT EXISTS event_cursors (
        name VARCHAR(50) PRIMARY KEY,
        sequence_id BIGINT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Account deletions. Sharetribe cannot delete a user without their
      -- password, and people who sign in with Apple or Google have none, so
      -- their deletion is a request an operator completes in Console. The
      -- e-mail is kept only until the confirmation letter goes out.
      CREATE TABLE IF NOT EXISTS account_deletion_requests (
        user_id VARCHAR(100) PRIMARY KEY,
        email VARCHAR(255),
        method VARCHAR(20) NOT NULL,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );

      -- Consent to send voice to OpenAI, required before every voice session.
      -- version names the consent text the person accepted, so a changed text
      -- can ask again; withdrawn_at keeps the record that consent once existed.
      CREATE TABLE IF NOT EXISTS voice_consents (
        user_id VARCHAR(100) PRIMARY KEY,
        version VARCHAR(20) NOT NULL,
        consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        withdrawn_at TIMESTAMPTZ
      );

      -- Every Sharetribe event, kept past Sharetribe's 90-day retention.
      -- Append-only: rows are never updated, only removed with the user they
      -- mention when that user deletes their account. user_ids lists every
      -- user an event refers to so that removal can find them.
      CREATE TABLE IF NOT EXISTS marketplace_events (
        sequence_id BIGINT PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        resource_type VARCHAR(30),
        resource_id VARCHAR(100),
        source VARCHAR(50),
        created_at TIMESTAMPTZ NOT NULL,
        user_ids TEXT[] NOT NULL DEFAULT '{}',
        payload JSONB NOT NULL,
        archived_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_marketplace_events_resource
        ON marketplace_events (resource_type, resource_id, sequence_id);
      CREATE INDEX IF NOT EXISTS idx_marketplace_events_type_time
        ON marketplace_events (event_type, created_at);
      CREATE INDEX IF NOT EXISTS idx_marketplace_events_users
        ON marketplace_events USING GIN (user_ids);

      -- Point-in-time copies of listings and transactions, for history that
      -- predates the event archive. A transaction carries its own dated
      -- transitions, so one copy preserves its whole lifecycle.
      CREATE TABLE IF NOT EXISTS marketplace_snapshots (
        resource_type VARCHAR(30) NOT NULL,
        resource_id VARCHAR(100) NOT NULL,
        taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        user_ids TEXT[] NOT NULL DEFAULT '{}',
        payload JSONB NOT NULL,
        PRIMARY KEY (resource_type, resource_id, taken_at)
      );

      CREATE INDEX IF NOT EXISTS idx_marketplace_snapshots_users
        ON marketplace_snapshots USING GIN (user_ids);
    `);
    
    console.log('Database tables initialized');

    try {
      await createContextViews(client);
    } catch (error) {
      // Analytics views must never keep the site from starting.
      console.error('Context views not created:', error.message);
    }
    
    const categoriesResult = await client.query('SELECT COUNT(*) FROM blog_categories');
    if (parseInt(categoriesResult.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO blog_categories (id, name_ru, name_en, description_ru, description_en, sort_order) VALUES
        ('all', 'Все статьи', 'All Articles', NULL, NULL, 0),
        ('telegram-news', 'Телеграм новости', 'Telegram News', 'Новости проекта YouDu ОАЭ из Telegram-канала', 'YouDu UAE project news from Telegram channel', 1),
        ('cases', 'Реальные проекты', 'Real Projects', 'Кейсы завершённых работ с фото, бюджетом и отзывами', 'Case studies with photos, budgets and reviews', 2),
        ('client-guide', 'Гид клиента', 'Client Guide', 'Практические советы по выбору услуг и специалистов', 'Practical tips for choosing services and specialists', 3),
        ('specialist-guide', 'Гид специалиста', 'Specialist Guide', 'Как успешно работать на YouDu и привлекать клиентов', 'How to work successfully on YouDu and attract clients', 4),
        ('uae-life', 'Жизнь в ОАЭ', 'Life in UAE', 'Полезная информация о жизни в Эмиратах', 'Useful information about life in the Emirates', 5)
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log('Default categories inserted');
    }
    
  } finally {
    client.release();
  }
};

const getCategories = async () => {
  const result = await pool.query(
    'SELECT id, name_ru, name_en, description_ru, description_en FROM blog_categories WHERE id != $1 ORDER BY sort_order',
    ['all']
  );
  return result.rows.map(row => ({
    id: row.id,
    name: { ru: row.name_ru, en: row.name_en },
    description: row.description_ru ? { ru: row.description_ru, en: row.description_en } : undefined,
  }));
};

const getArticles = async (categoryId = null, status = 'published') => {
  let query = `
    SELECT id, slug, category_id, title_ru, title_en, description_ru, description_en, 
           image, read_time, author_name, author_avatar, featured, created_at
    FROM blog_articles 
    WHERE status = $1
  `;
  const params = [status];
  
  if (categoryId && categoryId !== 'all') {
    query += ' AND category_id = $2';
    params.push(categoryId);
  }
  
  query += ' ORDER BY created_at DESC';
  
  const result = await pool.query(query, params);
  return result.rows.map(row => ({
    id: row.id,
    slug: row.slug,
    category: row.category_id,
    title: { ru: row.title_ru, en: row.title_en || row.title_ru },
    description: { ru: row.description_ru, en: row.description_en || row.description_ru },
    image: row.image,
    readTime: row.read_time,
    author: row.author_name ? { name: row.author_name, avatar: row.author_avatar } : null,
    featured: row.featured,
    createdAt: row.created_at.toISOString().split('T')[0],
  }));
};

const getArticleBySlug = async (slug) => {
  const result = await pool.query(
    `SELECT * FROM blog_articles WHERE slug = $1 AND status = 'published'`,
    [slug]
  );
  
  if (result.rows.length === 0) return null;
  
  const row = result.rows[0];
  return {
    id: row.id,
    slug: row.slug,
    category: row.category_id,
    title: { ru: row.title_ru, en: row.title_en || row.title_ru },
    description: { ru: row.description_ru, en: row.description_en || row.description_ru },
    content: { ru: row.content_ru, en: row.content_en || row.content_ru },
    image: row.image,
    readTime: row.read_time,
    keywords: row.keywords || '',
    author: row.author_name ? { name: row.author_name, avatar: row.author_avatar } : null,
    featured: row.featured,
    createdAt: row.created_at.toISOString().split('T')[0],
  };
};

const createArticle = async (article) => {
  const result = await pool.query(
    `INSERT INTO blog_articles 
     (id, slug, category_id, title_ru, title_en, description_ru, description_en, 
      content_ru, content_en, image, read_time, author_name, author_avatar, featured, status, telegram_message_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING *`,
    [
      article.id,
      article.slug,
      article.category,
      article.title?.ru || article.title,
      article.title?.en,
      article.description?.ru || article.description,
      article.description?.en,
      article.content?.ru || article.content,
      article.content?.en,
      article.image,
      article.readTime || 2,
      article.author?.name,
      article.author?.avatar,
      article.featured || false,
      article.status || 'draft',
      article.telegramMessageId,
    ]
  );
  return result.rows[0];
};

const addPendingPost = async (post) => {
  const result = await pool.query(
    `INSERT INTO blog_pending_posts (id, telegram_message_id, telegram_chat_id, sender_name, sender_id, text)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING
     RETURNING *`,
    [post.id, post.telegramMessageId, post.telegramChatId, post.senderName, post.senderId, post.text]
  );
  return result.rows[0];
};

const getPendingPosts = async () => {
  const result = await pool.query(
    `SELECT * FROM blog_pending_posts WHERE status = 'pending' ORDER BY received_at DESC`
  );
  return result.rows.map(row => ({
    id: row.id,
    telegramMessageId: row.telegram_message_id,
    telegramChatId: row.telegram_chat_id,
    senderName: row.sender_name,
    senderId: row.sender_id,
    text: row.text,
    receivedAt: row.received_at,
  }));
};

const approvePendingPost = async (postId, categoryId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const postResult = await client.query(
      'SELECT * FROM blog_pending_posts WHERE id = $1',
      [postId]
    );
    
    if (postResult.rows.length === 0) {
      throw new Error('Post not found');
    }
    
    const post = postResult.rows[0];
    const text = post.text;
    
    const slug = text.substring(0, 50)
      .toLowerCase()
      .replace(/[^a-zа-яё0-9\s]/gi, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[а-яё]/g, char => {
        const map = {'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};
        return map[char] || char;
      }) + '-' + Date.now();
    
    const title = text.split('\n')[0].substring(0, 100) || 'Новость из Telegram';
    const description = text.substring(0, 200);
    const content = `<p>${text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
    const readTime = Math.max(1, Math.ceil(text.length / 1000));
    
    const articleId = `tg-${post.telegram_message_id || Date.now()}`;
    
    await client.query(
      `INSERT INTO blog_articles 
       (id, slug, category_id, title_ru, description_ru, content_ru, read_time, status, telegram_message_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'published', $8)`,
      [articleId, slug, categoryId, title, description, content, readTime, post.telegram_message_id]
    );
    
    await client.query(
      'UPDATE blog_pending_posts SET status = $1 WHERE id = $2',
      ['approved', postId]
    );
    
    await client.query('COMMIT');
    
    return { success: true, slug };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const rejectPendingPost = async (postId) => {
  await pool.query(
    'UPDATE blog_pending_posts SET status = $1 WHERE id = $2',
    ['rejected', postId]
  );
  return { success: true };
};

// ============================================
// LISTING PUBLIC ID FUNCTIONS
// ============================================

/**
 * Generate next public ID for a listing (YD-00001 format)
 * Uses atomic increment to prevent race conditions
 */
const generateListingPublicId = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Ensure counter exists
    await client.query(`
      INSERT INTO listing_id_counter (id, current_value, prefix)
      VALUES ('default', 0, 'YD')
      ON CONFLICT (id) DO NOTHING
    `);
    
    // Atomic increment and get new value
    const result = await client.query(`
      UPDATE listing_id_counter 
      SET current_value = current_value + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = 'default'
      RETURNING current_value, prefix
    `);
    
    await client.query('COMMIT');
    
    const { current_value, prefix } = result.rows[0];
    const publicId = `${prefix}-${String(current_value).padStart(5, '0')}`;
    
    return publicId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Save mapping between public ID and Sharetribe UUID
 */
const saveListingIdMapping = async (publicId, sharetribeUuid) => {
  await pool.query(
    `INSERT INTO listing_id_mapping (public_id, sharetribe_uuid)
     VALUES ($1, $2)
     ON CONFLICT (public_id) DO UPDATE SET sharetribe_uuid = $2`,
    [publicId, sharetribeUuid]
  );
  return { success: true };
};

/**
 * Get Sharetribe UUID by public ID
 */
const getSharetribeUuidByPublicId = async (publicId) => {
  const result = await pool.query(
    'SELECT sharetribe_uuid FROM listing_id_mapping WHERE public_id = $1',
    [publicId]
  );
  return result.rows[0]?.sharetribe_uuid || null;
};

/**
 * Get public ID by Sharetribe UUID
 */
const getPublicIdBySharetribeUuid = async (sharetribeUuid) => {
  const result = await pool.query(
    'SELECT public_id FROM listing_id_mapping WHERE sharetribe_uuid = $1',
    [sharetribeUuid]
  );
  return result.rows[0]?.public_id || null;
};

/**
 * Get current counter value (for stats)
 */
const getListingIdCounter = async () => {
  const result = await pool.query(
    'SELECT current_value FROM listing_id_counter WHERE id = $1',
    ['default']
  );
  return result.rows[0]?.current_value || 0;
};

// ============================================
// SUPPORT TICKET FUNCTIONS
// ============================================

/**
 * Generate next ticket ID (TK-00001 format)
 */
const generateTicketId = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(`
      INSERT INTO ticket_id_counter (id, current_value, prefix)
      VALUES ('default', 0, 'TK')
      ON CONFLICT (id) DO NOTHING
    `);
    
    const result = await client.query(`
      UPDATE ticket_id_counter 
      SET current_value = current_value + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = 'default'
      RETURNING current_value, prefix
    `);
    
    await client.query('COMMIT');
    
    const { current_value, prefix } = result.rows[0];
    return `${prefix}-${String(current_value).padStart(5, '0')}`;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Create a new support ticket
 */
const createTicket = async (ticketData) => {
  const ticketId = await generateTicketId();
  
  const result = await pool.query(
    `INSERT INTO support_tickets 
     (ticket_id, user_id, user_email, user_name, subject, category, related_listing_id, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      ticketId,
      ticketData.userId || null,
      ticketData.userEmail,
      ticketData.userName || null,
      ticketData.subject,
      ticketData.category || 'general',
      ticketData.relatedListingId || null,
      ticketData.priority || 'normal',
    ]
  );
  
  // Add initial message
  if (ticketData.message) {
    await pool.query(
      `INSERT INTO ticket_messages (ticket_id, sender_type, sender_name, message)
       VALUES ($1, 'user', $2, $3)`,
      [ticketId, ticketData.userName || ticketData.userEmail, ticketData.message]
    );
  }
  
  return result.rows[0];
};

/**
 * Get ticket by ID
 */
const getTicketById = async (ticketId) => {
  const ticketResult = await pool.query(
    'SELECT * FROM support_tickets WHERE ticket_id = $1',
    [ticketId]
  );
  
  if (ticketResult.rows.length === 0) return null;
  
  const messagesResult = await pool.query(
    'SELECT * FROM ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC',
    [ticketId]
  );
  
  return {
    ...ticketResult.rows[0],
    messages: messagesResult.rows,
  };
};

/**
 * Get tickets by user ID
 */
const getTicketsByUserId = async (userId) => {
  const result = await pool.query(
    'SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
};

/**
 * Get all open tickets (for admin)
 */
const getOpenTickets = async () => {
  const result = await pool.query(
    `SELECT * FROM support_tickets 
     WHERE status IN ('open', 'pending') 
     ORDER BY 
       CASE priority 
         WHEN 'urgent' THEN 1 
         WHEN 'high' THEN 2 
         WHEN 'normal' THEN 3 
         WHEN 'low' THEN 4 
       END,
       created_at ASC`
  );
  return result.rows;
};

/**
 * Add message to ticket
 */
const addTicketMessage = async (ticketId, messageData) => {
  const result = await pool.query(
    `INSERT INTO ticket_messages 
     (ticket_id, sender_type, sender_name, message, telegram_message_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      ticketId,
      messageData.senderType, // 'user' or 'admin'
      messageData.senderName,
      messageData.message,
      messageData.telegramMessageId || null,
    ]
  );
  
  // Update ticket status and timestamp
  await pool.query(
    `UPDATE support_tickets 
     SET updated_at = CURRENT_TIMESTAMP,
         status = CASE WHEN $2 = 'admin' THEN 'pending' ELSE status END
     WHERE ticket_id = $1`,
    [ticketId, messageData.senderType]
  );
  
  return result.rows[0];
};

/**
 * Update ticket status
 */
const updateTicketStatus = async (ticketId, status) => {
  const closedAt = status === 'closed' ? 'CURRENT_TIMESTAMP' : 'NULL';
  
  await pool.query(
    `UPDATE support_tickets 
     SET status = $1, 
         updated_at = CURRENT_TIMESTAMP,
         closed_at = ${status === 'closed' ? 'CURRENT_TIMESTAMP' : 'NULL'}
     WHERE ticket_id = $2`,
    [status, ticketId]
  );
  
  return { success: true };
};

/**
 * Update ticket with Telegram message ID
 */
const updateTicketTelegramId = async (ticketId, telegramMessageId) => {
  await pool.query(
    'UPDATE support_tickets SET telegram_message_id = $1 WHERE ticket_id = $2',
    [telegramMessageId, ticketId]
  );
  return { success: true };
};

/**
 * Find ticket by Telegram message ID
 */
const getTicketByTelegramMessageId = async (telegramMessageId) => {
  const result = await pool.query(
    'SELECT * FROM support_tickets WHERE telegram_message_id = $1',
    [telegramMessageId]
  );
  return result.rows[0] || null;
};

/**
 * Get ticket stats
 */
const getTicketStats = async () => {
  const result = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'open') as open_count,
      COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
      COUNT(*) FILTER (WHERE status = 'closed') as closed_count,
      COUNT(*) as total_count
    FROM support_tickets
  `);
  return result.rows[0];
};

// ============================================
// TELEGRAM SUBSCRIBER FUNCTIONS
// ============================================

/**
 * Record or refresh a subscriber. Called when someone links the bot and
 * whenever their service categories change.
 */
const upsertTelegramSubscriber = async subscriber => {
  const {
    userId,
    chatId,
    telegramUsername = null,
    displayName = null,
    userType = null,
    categories = [],
  } = subscriber;

  const result = await pool.query(
    `INSERT INTO telegram_subscribers
       (user_id, chat_id, telegram_username, display_name, user_type, categories,
        is_active, failure_count, last_error, last_synced_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE, 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE SET
       chat_id = EXCLUDED.chat_id,
       telegram_username = COALESCE(EXCLUDED.telegram_username, telegram_subscribers.telegram_username),
       display_name = COALESCE(EXCLUDED.display_name, telegram_subscribers.display_name),
       user_type = COALESCE(EXCLUDED.user_type, telegram_subscribers.user_type),
       categories = EXCLUDED.categories,
       is_active = TRUE,
       failure_count = 0,
       last_error = NULL,
       last_synced_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [userId, String(chatId), telegramUsername, displayName, userType, categories]
  );
  return result.rows[0];
};

/**
 * Update only the categories, leaving the Telegram link untouched. Used when a
 * specialist edits their profile.
 */
const updateTelegramSubscriberCategories = async (userId, categories) => {
  const result = await pool.query(
    `UPDATE telegram_subscribers
     SET categories = $2, last_synced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1
     RETURNING *`,
    [userId, categories]
  );
  return result.rows[0] || null;
};

const getTelegramSubscriber = async userId => {
  const result = await pool.query('SELECT * FROM telegram_subscribers WHERE user_id = $1', [
    userId,
  ]);
  return result.rows[0] || null;
};

/**
 * Everyone who should hear about a new task in the given category.
 * The GIN index on categories keeps this fast as the audience grows.
 */
const getTelegramSubscribersByCategory = async categoryId => {
  const result = await pool.query(
    `SELECT user_id, chat_id, display_name
     FROM telegram_subscribers
     WHERE is_active
       AND notifications_enabled
       AND categories && ARRAY[$1]::TEXT[]`,
    [categoryId]
  );
  return result.rows.map(row => ({
    userId: row.user_id,
    chatId: row.chat_id,
    displayName: row.display_name,
  }));
};

/**
 * Reserve the right to send one reminder, returning false if it already went out.
 *
 * The insert is the lock: the unique constraint means only the first caller for
 * a given (type, subject, recipient) gets a row back, so two overlapping
 * scheduler runs cannot both decide to notify the same person about the same
 * thing. Callers must release the claim if delivery fails.
 */
const claimReminder = async ({ reminderType, subjectId, recipientUserId, details = null }) => {
  const result = await pool.query(
    `INSERT INTO reminder_log (reminder_type, subject_id, recipient_user_id, details)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (reminder_type, subject_id, recipient_user_id) DO NOTHING
     RETURNING id`,
    [reminderType, subjectId, recipientUserId, details]
  );
  return result.rowCount > 0;
};

/**
 * Give the claim back so a later run can retry, e.g. when Telegram was down.
 */
const releaseReminder = async ({ reminderType, subjectId, recipientUserId }) => {
  await pool.query(
    `DELETE FROM reminder_log
     WHERE reminder_type = $1 AND subject_id = $2 AND recipient_user_id = $3`,
    [reminderType, subjectId, recipientUserId]
  );
};

const getReminderStats = async () => {
  const result = await pool.query(
    `SELECT reminder_type,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE sent_at > NOW() - INTERVAL '7 days')::int AS last_week,
            MAX(sent_at) AS last_sent
     FROM reminder_log
     GROUP BY reminder_type
     ORDER BY reminder_type`
  );
  return result.rows;
};

const recordVoiceSession = async ({ sessionId, userId }) => {
  await pool.query(
    `INSERT INTO voice_sessions (session_id, user_id) VALUES ($1, $2)
     ON CONFLICT (session_id) DO NOTHING`,
    [sessionId, userId]
  );
};

/**
 * Conversations the user started in the last 24 hours. A rolling window rather
 * than a calendar day, so the budget cannot be doubled around midnight.
 */
const countRecentVoiceSessions = async userId => {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM voice_sessions
     WHERE user_id = $1 AND started_at > NOW() - INTERVAL '24 hours'`,
    [userId]
  );
  return result.rows[0].count;
};

/** True when the user accepted this version of the consent text and kept it. */
const hasVoiceConsent = async (userId, version) => {
  const result = await pool.query(
    `SELECT 1 FROM voice_consents
     WHERE user_id = $1 AND version = $2 AND withdrawn_at IS NULL`,
    [userId, version]
  );
  return result.rowCount > 0;
};

const grantVoiceConsent = async (userId, version) => {
  await pool.query(
    `INSERT INTO voice_consents (user_id, version, consented_at, withdrawn_at)
     VALUES ($1, $2, NOW(), NULL)
     ON CONFLICT (user_id) DO UPDATE
       SET version = EXCLUDED.version, consented_at = NOW(), withdrawn_at = NULL`,
    [userId, version]
  );
};

const withdrawVoiceConsent = async userId => {
  await pool.query(
    `UPDATE voice_consents SET withdrawn_at = NOW()
     WHERE user_id = $1 AND withdrawn_at IS NULL`,
    [userId]
  );
};

const getVoiceSession = async sessionId => {
  const result = await pool.query(
    `SELECT session_id, user_id, started_at, draft_ready_at
     FROM voice_sessions WHERE session_id = $1`,
    [sessionId]
  );
  return result.rows[0] || null;
};

const markVoiceDraftReady = async sessionId => {
  await pool.query(
    `UPDATE voice_sessions SET draft_ready_at = COALESCE(draft_ready_at, NOW())
     WHERE session_id = $1`,
    [sessionId]
  );
};

// pg returns BIGINT as a string; sequence ids stay far below 2^53.
const toCursor = row =>
  row
    ? {
        sequenceId: row.sequence_id === null ? null : Number(row.sequence_id),
        updatedAt: row.updated_at,
      }
    : null;

/**
 * The consumer's cursor, created on first use with no sequence id so that it
 * starts from the present rather than from the marketplace's whole history.
 */
const getOrStartEventCursor = async name => {
  await pool.query(
    `INSERT INTO event_cursors (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
    [name]
  );
  const result = await pool.query(
    `SELECT sequence_id, updated_at FROM event_cursors WHERE name = $1`,
    [name]
  );
  return toCursor(result.rows[0]);
};

const saveEventCursor = async (name, sequenceId) => {
  await pool.query(
    `UPDATE event_cursors SET sequence_id = $2, updated_at = NOW() WHERE name = $1`,
    [name, sequenceId]
  );
};

/**
 * Stores a page of events in one transaction and returns how many were new.
 * A user/deleted event also removes what the archive already held about that
 * user, since events arrive in order and the rest of their history is in.
 */
const archiveMarketplaceEvents = async rows => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let inserted = 0;
    for (const row of rows) {
      const result = await client.query(
        `INSERT INTO marketplace_events
           (sequence_id, event_type, resource_type, resource_id, source, created_at, user_ids, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (sequence_id) DO NOTHING`,
        [
          row.sequenceId,
          row.eventType,
          row.resourceType,
          row.resourceId,
          row.source,
          row.createdAt,
          row.userIds,
          JSON.stringify(row.payload),
        ]
      );
      inserted += result.rowCount;
      if (row.deletedUserId) {
        await client.query(
          `DELETE FROM marketplace_events
           WHERE $1 = ANY(user_ids) AND event_type <> 'user/deleted'`,
          [row.deletedUserId]
        );
        await client.query('DELETE FROM marketplace_snapshots WHERE $1 = ANY(user_ids)', [
          row.deletedUserId,
        ]);
      }
    }
    await client.query('COMMIT');
    return inserted;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const saveMarketplaceSnapshots = async rows => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      await client.query(
        `INSERT INTO marketplace_snapshots (resource_type, resource_id, taken_at, user_ids, payload)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [row.resourceType, row.resourceId, row.takenAt, row.userIds, JSON.stringify(row.payload)]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Records a deletion request. Returns true only the first time, so a repeated
 * tap does not alert the operator twice.
 */
const recordDeletionRequest = async ({ userId, email, method }) => {
  const result = await pool.query(
    `INSERT INTO account_deletion_requests (user_id, email, method)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING user_id`,
    [userId, email, method]
  );
  return result.rowCount > 0;
};

/**
 * Marks the user's deletion done and forgets their e-mail, returning it for
 * the confirmation letter if a request was still open.
 */
const completeDeletionRequest = async userId => {
  const pending = await pool.query(
    `SELECT email FROM account_deletion_requests
     WHERE user_id = $1 AND completed_at IS NULL`,
    [userId]
  );
  await pool.query(
    `UPDATE account_deletion_requests SET completed_at = NOW(), email = NULL
     WHERE user_id = $1 AND completed_at IS NULL`,
    [userId]
  );
  return pending.rows[0] ? { email: pending.rows[0].email } : null;
};

/**
 * Removes everything YouDu's own database holds about a user. Sharetribe erases
 * its side on deletion but knows nothing of these tables.
 */
const deleteUserLocalData = async userId => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM ticket_messages WHERE ticket_id IN
         (SELECT ticket_id FROM support_tickets WHERE user_id = $1)`,
      [userId]
    );
    await client.query('DELETE FROM support_tickets WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM telegram_subscribers WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM voice_sessions WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM voice_consents WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM reminder_log WHERE recipient_user_id = $1', [userId]);
    await client.query(
      `DELETE FROM marketplace_events WHERE $1 = ANY(user_ids) AND event_type <> 'user/deleted'`,
      [userId]
    );
    await client.query('DELETE FROM marketplace_snapshots WHERE $1 = ANY(user_ids)', [userId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Stop sending to a chat that Telegram rejects, e.g. after the user blocks the
 * bot. Keeping the row preserves history and lets a re-link revive it.
 */
const deactivateTelegramSubscriber = async (userId, reason = null) => {
  await pool.query(
    `UPDATE telegram_subscribers
     SET is_active = FALSE,
         failure_count = failure_count + 1,
         last_error = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1`,
    [userId, reason]
  );
  return { success: true };
};

const deactivateTelegramSubscriberByChatId = async (chatId, reason = null) => {
  const result = await pool.query(
    `UPDATE telegram_subscribers
     SET is_active = FALSE,
         failure_count = failure_count + 1,
         last_error = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE chat_id = $1
     RETURNING user_id`,
    [String(chatId), reason]
  );
  return result.rows[0]?.user_id || null;
};

const removeTelegramSubscriber = async userId => {
  await pool.query('DELETE FROM telegram_subscribers WHERE user_id = $1', [userId]);
  return { success: true };
};

const getTelegramSubscriberStats = async () => {
  const result = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE is_active AND notifications_enabled) AS active,
      COUNT(*) FILTER (WHERE NOT is_active) AS inactive,
      COUNT(*) FILTER (WHERE categories = '{}') AS without_categories
    FROM telegram_subscribers
  `);
  return result.rows[0];
};

module.exports = {
  pool,
  initDatabase,
  getCategories,
  getArticles,
  getArticleBySlug,
  createArticle,
  addPendingPost,
  getPendingPosts,
  approvePendingPost,
  rejectPendingPost,
  // Listing public ID functions
  generateListingPublicId,
  saveListingIdMapping,
  getSharetribeUuidByPublicId,
  getPublicIdBySharetribeUuid,
  getListingIdCounter,
  // Support ticket functions
  createTicket,
  getTicketById,
  getTicketsByUserId,
  getOpenTickets,
  addTicketMessage,
  updateTicketStatus,
  updateTicketTelegramId,
  getTicketByTelegramMessageId,
  getTicketStats,
  // Reminder scheduler functions
  claimReminder,
  releaseReminder,
  getReminderStats,
  // Telegram subscriber functions
  upsertTelegramSubscriber,
  updateTelegramSubscriberCategories,
  getTelegramSubscriber,
  getTelegramSubscribersByCategory,
  deactivateTelegramSubscriber,
  deactivateTelegramSubscriberByChatId,
  removeTelegramSubscriber,
  getTelegramSubscriberStats,
  // Voice intake pilot functions
  recordVoiceSession,
  hasVoiceConsent,
  grantVoiceConsent,
  withdrawVoiceConsent,
  countRecentVoiceSessions,
  getVoiceSession,
  markVoiceDraftReady,
  // Sharetribe event consumers
  getOrStartEventCursor,
  saveEventCursor,
  archiveMarketplaceEvents,
  saveMarketplaceSnapshots,
  // Account deletion
  recordDeletionRequest,
  completeDeletionRequest,
  deleteUserLocalData,
};
