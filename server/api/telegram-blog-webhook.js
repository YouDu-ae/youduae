/**
 * Webhook для автоматического сбора постов админов из Telegram группы
 * 
 * Настройка:
 * 1. Добавьте бота @YouDuAE_bot в группу youdu_uae
 * 2. Дайте боту права на чтение сообщений
 * 3. Настройте webhook: POST /api/telegram/blog-webhook
 * 
 * Посты сохраняются в pending_posts.json для последующего одобрения
 */

const fs = require('fs');
const path = require('path');

// ID администраторов группы (получить через getChat или вручную)
const ADMIN_USER_IDS = process.env.TELEGRAM_BLOG_ADMIN_IDS 
  ? process.env.TELEGRAM_BLOG_ADMIN_IDS.split(',').map(id => parseInt(id.trim()))
  : [];

// Минимальная длина поста для сохранения
const MIN_POST_LENGTH = 100;

// Путь к файлу с ожидающими постами
const PENDING_POSTS_PATH = path.join(__dirname, '../../src/data/blog/pending_posts.json');

// ID группы youdu_uae (можно получить через getChat)
const YOUDU_GROUP_ID = process.env.TELEGRAM_BLOG_GROUP_ID || null;

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[а-яё]/g, char => {
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
    .substring(0, 50);
}

function loadPendingPosts() {
  try {
    if (fs.existsSync(PENDING_POSTS_PATH)) {
      return JSON.parse(fs.readFileSync(PENDING_POSTS_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading pending posts:', e);
  }
  return { posts: [] };
}

function savePendingPosts(data) {
  fs.writeFileSync(PENDING_POSTS_PATH, JSON.stringify(data, null, 2), 'utf8');
}

async function handleBlogWebhook(req, res) {
  try {
    const update = req.body;
    
    // Только сообщения
    if (!update.message) {
      return res.sendStatus(200);
    }
    
    const message = update.message;
    const chat = message.chat;
    const from = message.from;
    const text = message.text || message.caption || '';
    
    // Проверяем что это нужная группа (если указана)
    if (YOUDU_GROUP_ID && chat.id.toString() !== YOUDU_GROUP_ID) {
      return res.sendStatus(200);
    }
    
    // Проверяем что это группа или супергруппа
    if (chat.type !== 'group' && chat.type !== 'supergroup') {
      return res.sendStatus(200);
    }
    
    // Проверяем что отправитель - админ
    if (ADMIN_USER_IDS.length > 0 && !ADMIN_USER_IDS.includes(from.id)) {
      console.log(`📝 Пропуск поста от не-админа: ${from.first_name} (${from.id})`);
      return res.sendStatus(200);
    }
    
    // Проверяем длину текста
    if (text.length < MIN_POST_LENGTH) {
      return res.sendStatus(200);
    }
    
    // Проверяем на хештег #noblog для исключения
    if (text.includes('#noblog') || text.includes('#нетблог')) {
      console.log('📝 Пост исключён по хештегу #noblog');
      return res.sendStatus(200);
    }
    
    console.log(`📝 Новый пост от ${from.first_name}: "${text.substring(0, 50)}..."`);
    
    // Создаём черновик поста
    const title = text.split('\n')[0].replace(/[#*_]/g, '').trim().substring(0, 60);
    const slug = slugify(title) + '-' + Date.now().toString(36);
    
    const pendingPost = {
      id: slug,
      telegramMessageId: message.message_id,
      telegramChatId: chat.id,
      title: title,
      text: text,
      author: {
        telegramId: from.id,
        name: `${from.first_name || ''} ${from.last_name || ''}`.trim(),
        username: from.username || null
      },
      date: new Date(message.date * 1000).toISOString(),
      hasPhoto: !!message.photo,
      photoFileId: message.photo ? message.photo[message.photo.length - 1].file_id : null,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    // Сохраняем в pending
    const pending = loadPendingPosts();
    
    // Проверяем на дубликат
    const isDuplicate = pending.posts.some(p => p.telegramMessageId === message.message_id);
    if (isDuplicate) {
      console.log('📝 Дубликат поста, пропускаем');
      return res.sendStatus(200);
    }
    
    pending.posts.unshift(pendingPost);
    savePendingPosts(pending);
    
    console.log(`✅ Пост добавлен в очередь: ${slug}`);
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Blog webhook error:', error);
    res.sendStatus(200);
  }
}

/**
 * API: Получить список ожидающих постов
 */
async function getPendingPosts(req, res) {
  try {
    const pending = loadPendingPosts();
    res.json(pending);
  } catch (error) {
    console.error('Error getting pending posts:', error);
    res.status(500).json({ error: 'Failed to get pending posts' });
  }
}

/**
 * API: Одобрить пост (переместить в блог)
 */
async function approvePost(req, res) {
  try {
    const { postId, category, relatedCategoryId } = req.body;
    
    if (!postId) {
      return res.status(400).json({ error: 'postId is required' });
    }
    
    const pending = loadPendingPosts();
    const postIndex = pending.posts.findIndex(p => p.id === postId);
    
    if (postIndex === -1) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    const post = pending.posts[postIndex];
    
    // Читаем articles.json
    const articlesPath = path.join(__dirname, '../../src/data/blog/articles.json');
    const articlesData = JSON.parse(fs.readFileSync(articlesPath, 'utf8'));
    
    // Создаём метаданные статьи
    const articleMetadata = {
      id: post.id,
      slug: post.id,
      category: category || 'uae-life',
      title: {
        ru: post.title,
        en: post.title
      },
      description: {
        ru: post.text.substring(0, 155) + '...',
        en: post.text.substring(0, 155) + '...'
      },
      image: '/static/blog/default-post.jpg',
      readTime: Math.max(1, Math.ceil(post.text.split(/\s+/).length / 200)),
      createdAt: post.date.split('T')[0],
      author: null,
      relatedCategory: relatedCategoryId ? {
        id: relatedCategoryId,
        name: { ru: relatedCategoryId, en: relatedCategoryId }
      } : null,
      featured: false
    };
    
    // Добавляем в articles.json
    articlesData.articles.unshift(articleMetadata);
    fs.writeFileSync(articlesPath, JSON.stringify(articlesData, null, 2), 'utf8');
    
    // Создаём файл контента
    const contentPath = path.join(__dirname, '../../src/data/blog/articles', `${post.id}.json`);
    const content = {
      id: post.id,
      content: {
        ru: `<p>${post.text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`,
        en: `<p>${post.text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`
      },
      gallery: [],
      tags: []
    };
    fs.writeFileSync(contentPath, JSON.stringify(content, null, 2), 'utf8');
    
    // Удаляем из pending
    pending.posts.splice(postIndex, 1);
    savePendingPosts(pending);
    
    console.log(`✅ Пост одобрен: ${post.id}`);
    
    res.json({ success: true, articleId: post.id });
  } catch (error) {
    console.error('Error approving post:', error);
    res.status(500).json({ error: 'Failed to approve post' });
  }
}

/**
 * API: Отклонить пост
 */
async function rejectPost(req, res) {
  try {
    const { postId } = req.body;
    
    if (!postId) {
      return res.status(400).json({ error: 'postId is required' });
    }
    
    const pending = loadPendingPosts();
    const postIndex = pending.posts.findIndex(p => p.id === postId);
    
    if (postIndex === -1) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    pending.posts.splice(postIndex, 1);
    savePendingPosts(pending);
    
    console.log(`❌ Пост отклонён: ${postId}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error rejecting post:', error);
    res.status(500).json({ error: 'Failed to reject post' });
  }
}

module.exports = {
  handleBlogWebhook,
  getPendingPosts,
  approvePost,
  rejectPost
};
