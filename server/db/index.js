const { Pool } = require('pg');

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
        featured BOOLEAN DEFAULT FALSE,
        status VARCHAR(20) DEFAULT 'draft',
        telegram_message_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

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
    `);
    
    console.log('Database tables initialized');
    
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
};
