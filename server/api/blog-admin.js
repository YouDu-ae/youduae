const { v4: uuidv4 } = require('uuid');

const ADMIN_PASSWORD = process.env.BLOG_ADMIN_PASSWORD || 'youdu-blog-2026';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

// In-memory store for 2FA codes and rate limiting
const authCodes = new Map(); // { sessionId: { code, expiresAt, verified } }
const loginAttempts = new Map(); // { ip: { count, resetAt } }

const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 60 * 1000; // 1 minute
const CODE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// Generate 6-digit code
const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send Telegram message
const sendTelegramMessage = async (chatId, text) => {
  if (!TELEGRAM_BOT_TOKEN || !chatId) {
    console.warn('⚠️ Telegram not configured for 2FA');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
        }),
      }
    );
    return response.ok;
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
    return false;
  }
};

// Check rate limit
const checkRateLimit = (ip) => {
  const now = Date.now();
  const attempts = loginAttempts.get(ip);

  if (!attempts || now > attempts.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
    return true;
  }

  if (attempts.count >= MAX_ATTEMPTS) {
    return false;
  }

  attempts.count++;
  return true;
};

// Step 1: Verify password and send 2FA code
const authenticate = async (req, res) => {
  const { password } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  // Rate limiting
  if (!checkRateLimit(ip)) {
    console.log(`🚫 Rate limit exceeded for IP: ${ip}`);
    await sendTelegramMessage(
      TELEGRAM_ADMIN_CHAT_ID,
      `🚨 <b>Блог Админка - Превышен лимит попыток</b>\n\nIP: <code>${ip}</code>\nПопыток: ${MAX_ATTEMPTS}+`
    );
    return res.status(429).json({ 
      error: 'Too many attempts. Please try again in 1 minute.' 
    });
  }

  // Check password
  if (password !== ADMIN_PASSWORD) {
    console.log(`❌ Invalid password attempt from IP: ${ip}`);
    await sendTelegramMessage(
      TELEGRAM_ADMIN_CHAT_ID,
      `⚠️ <b>Блог Админка - Неверный пароль</b>\n\nIP: <code>${ip}</code>\nВремя: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Dubai' })}`
    );
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Generate session and 2FA code
  const sessionId = uuidv4();
  const code = generateCode();
  const expiresAt = Date.now() + CODE_EXPIRY_MS;

  authCodes.set(sessionId, { code, expiresAt, verified: false });

  // Send code via Telegram
  const sent = await sendTelegramMessage(
    TELEGRAM_ADMIN_CHAT_ID,
    `🔐 <b>Код для входа в админку блога</b>\n\n<code>${code}</code>\n\nДействителен 5 минут.\nIP: <code>${ip}</code>`
  );

  if (!sent) {
    // If Telegram fails, allow access without 2FA (fallback)
    console.warn('⚠️ Telegram 2FA failed, allowing access');
    authCodes.set(sessionId, { code: null, expiresAt, verified: true });
    return res.json({ success: true, sessionId, require2FA: false });
  }

  console.log(`✅ 2FA code sent for session: ${sessionId}`);
  res.json({ 
    success: true, 
    sessionId, 
    require2FA: true,
    message: 'Код отправлен в Telegram' 
  });
};

// Step 2: Verify 2FA code
const verify2FA = async (req, res) => {
  const { sessionId, code } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  if (!sessionId || !code) {
    return res.status(400).json({ error: 'Session ID and code are required' });
  }

  const session = authCodes.get(sessionId);

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  if (Date.now() > session.expiresAt) {
    authCodes.delete(sessionId);
    return res.status(401).json({ error: 'Code expired. Please login again.' });
  }

  if (session.code !== code) {
    console.log(`❌ Invalid 2FA code for session: ${sessionId}`);
    await sendTelegramMessage(
      TELEGRAM_ADMIN_CHAT_ID,
      `⚠️ <b>Блог Админка - Неверный 2FA код</b>\n\nIP: <code>${ip}</code>`
    );
    return res.status(401).json({ error: 'Invalid code' });
  }

  // Mark as verified
  session.verified = true;
  authCodes.set(sessionId, session);

  // Notify about successful login
  await sendTelegramMessage(
    TELEGRAM_ADMIN_CHAT_ID,
    `✅ <b>Успешный вход в админку блога</b>\n\nIP: <code>${ip}</code>\nВремя: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Dubai' })}`
  );

  console.log(`✅ 2FA verified for session: ${sessionId}`);
  res.json({ success: true, verified: true });
};

// Middleware to check if session is verified (for API calls)
const checkSession = (req, res, next) => {
  const sessionId = req.headers['x-session-id'];
  
  if (!sessionId) {
    return res.status(401).json({ error: 'No session' });
  }

  const session = authCodes.get(sessionId);
  
  if (!session || !session.verified || Date.now() > session.expiresAt) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  // Extend session on activity
  session.expiresAt = Date.now() + CODE_EXPIRY_MS;
  authCodes.set(sessionId, session);

  next();
};

const getArticles = (db) => async (req, res) => {
  try {
    const result = await db.pool.query(`
      SELECT * FROM blog_articles 
      ORDER BY created_at DESC
    `);
    res.json({ articles: result.rows });
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
};

const createArticle = (db) => async (req, res) => {
  try {
    console.log('📝 Creating article, body:', JSON.stringify(req.body, null, 2));
    
    const {
      title_ru,
      title_en,
      slug,
      category_id,
      description_ru,
      description_en,
      content_ru,
      content_en,
      image,
      gallery,
      read_time,
      author_name,
      featured,
      status,
    } = req.body;

    // Auto-generate title from content if not provided
    let finalTitle = title_ru;
    if (!finalTitle && content_ru) {
      const h2Match = content_ru.match(/<h2[^>]*>([^<]+)<\/h2>/i);
      if (h2Match) {
        finalTitle = h2Match[1].trim();
      } else {
        // Take first 100 chars of text content
        finalTitle = content_ru.replace(/<[^>]+>/g, '').substring(0, 100).trim() || 'Без названия';
      }
      console.log('📝 Auto-generated title:', finalTitle);
    }

    // Auto-generate slug from title if not provided
    let finalSlug = slug;
    if (!finalSlug && finalTitle) {
      finalSlug = finalTitle
        .toLowerCase()
        .replace(/[а-яё]/g, (char) => {
          const map = {
            'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
            'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
            'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
            'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
            'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
          };
          return map[char] || char;
        })
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 100) + '-' + Date.now();
      console.log('📝 Auto-generated slug:', finalSlug);
    }

    if (!finalTitle || !finalSlug) {
      console.log('❌ Validation failed: title_ru=', finalTitle, 'slug=', finalSlug);
      return res.status(400).json({ error: 'Заполните заголовок статьи или добавьте контент' });
    }

    const id = finalSlug;
    
    const existingResult = await db.pool.query(
      'SELECT id FROM blog_articles WHERE slug = $1',
      [finalSlug]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'Статья с таким slug уже существует. Измените заголовок.' });
    }

    const result = await db.pool.query(`
      INSERT INTO blog_articles (
        id, slug, category_id, title_ru, title_en, 
        description_ru, description_en, content_ru, content_en,
        image, read_time, author_name, featured, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      id, finalSlug, category_id || 'cases', finalTitle, title_en || '',
      description_ru || '', description_en || '', content_ru || '', content_en || '',
      image || '', read_time || 5, author_name || '', featured || false, status || 'draft'
    ]);

    if (gallery && gallery.length > 0) {
      await saveGallery(db, id, gallery);
    }

    console.log('✅ Article created:', id);
    res.json({ article: result.rows[0] });
  } catch (error) {
    console.error('Error creating article:', error);
    res.status(500).json({ error: 'Failed to create article', message: error.message });
  }
};

const updateArticle = (db) => async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title_ru,
      title_en,
      slug,
      category_id,
      description_ru,
      description_en,
      content_ru,
      content_en,
      image,
      gallery,
      read_time,
      author_name,
      featured,
      status,
    } = req.body;

    const result = await db.pool.query(`
      UPDATE blog_articles SET
        slug = $2,
        category_id = $3,
        title_ru = $4,
        title_en = $5,
        description_ru = $6,
        description_en = $7,
        content_ru = $8,
        content_en = $9,
        image = $10,
        read_time = $11,
        author_name = $12,
        featured = $13,
        status = $14,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [
      id, slug, category_id, title_ru, title_en || '',
      description_ru || '', description_en || '', content_ru || '', content_en || '',
      image || '', read_time || 5, author_name || '', featured || false, status || 'draft'
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    if (gallery) {
      await saveGallery(db, id, gallery);
    }

    console.log('✅ Article updated:', id);
    res.json({ article: result.rows[0] });
  } catch (error) {
    console.error('Error updating article:', error);
    res.status(500).json({ error: 'Failed to update article', message: error.message });
  }
};

const deleteArticle = (db) => async (req, res) => {
  try {
    const { id } = req.params;

    await db.pool.query('DELETE FROM blog_article_gallery WHERE article_id = $1', [id]);
    const result = await db.pool.query('DELETE FROM blog_articles WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    console.log('✅ Article deleted:', id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(500).json({ error: 'Failed to delete article' });
  }
};

const publishArticle = (db) => async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.pool.query(`
      UPDATE blog_articles 
      SET status = 'published', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    console.log('✅ Article published:', id);
    res.json({ article: result.rows[0] });
  } catch (error) {
    console.error('Error publishing article:', error);
    res.status(500).json({ error: 'Failed to publish article' });
  }
};

const saveGallery = async (db, articleId, gallery) => {
  try {
    await db.pool.query(`
      CREATE TABLE IF NOT EXISTS blog_article_gallery (
        id SERIAL PRIMARY KEY,
        article_id VARCHAR(100) REFERENCES blog_articles(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.pool.query('DELETE FROM blog_article_gallery WHERE article_id = $1', [articleId]);

    for (let i = 0; i < gallery.length; i++) {
      await db.pool.query(
        'INSERT INTO blog_article_gallery (article_id, image_url, sort_order) VALUES ($1, $2, $3)',
        [articleId, gallery[i], i]
      );
    }
  } catch (error) {
    console.error('Error saving gallery:', error);
  }
};

module.exports = {
  authenticate,
  verify2FA,
  checkSession,
  getArticles,
  createArticle,
  updateArticle,
  deleteArticle,
  publishArticle,
};
