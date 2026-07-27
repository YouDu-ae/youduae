/**
 * Telegram Bot Integration for YouDu Notifications
 * 
 * Handles:
 * - Webhook from Telegram (user messages)
 * - Account linking via verification code
 * - Sending notifications to users
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// SEO optimizer
const { optimizeForSEO } = require('./seo-optimizer');

// Blog integration settings
const TELEGRAM_BLOG_ADMIN_IDS = process.env.TELEGRAM_BLOG_ADMIN_IDS 
  ? process.env.TELEGRAM_BLOG_ADMIN_IDS.split(',').map(id => parseInt(id.trim()))
  : [];
const TELEGRAM_BLOG_GROUP_ID = process.env.TELEGRAM_BLOG_GROUP_ID || null;
const MIN_BLOG_POST_LENGTH = 100;

// Initialize Sharetribe Integration SDK
const integrationSdk = sharetribeIntegrationSdk.createInstance({
  clientId: process.env.INTEGRATION_API_CLIENT_ID,
  clientSecret: process.env.INTEGRATION_API_CLIENT_SECRET,
});

// In-memory store for pending verifications (in production, use Redis)
const pendingVerifications = new Map();

// Blog posts pending file path
const PENDING_POSTS_PATH = path.join(__dirname, '../../src/data/blog/pending_posts.json');

// Database connection for blog
let db = null;
const getDb = () => {
  if (!db && process.env.DATABASE_URL) {
    db = require('../db');
  }
  return db;
};

/**
 * Slugify text for URL
 */
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

/**
 * Publish blog post from Telegram group directly (auto-publish for admins)
 * Includes AI-powered SEO optimization
 */
async function publishBlogPostFromTelegram(message) {
  try {
    const text = message.text || message.caption || '';
    const from = message.from;
    
    console.log('📝 Starting SEO optimization for blog post...');
    
    // AI-powered SEO optimization
    const seoData = await optimizeForSEO(text);
    
    const title = seoData.title;
    const description = seoData.description;
    const content = seoData.content;
    const keywords = seoData.keywords;
    
    const slug = slugify(title.ru) + '-' + Date.now().toString(36);
    const readTime = Math.max(1, Math.ceil(text.length / 1000));
    const articleId = `tg-${message.message_id}-${Date.now()}`;
    
    console.log(`📝 SEO optimized by: ${seoData.optimizedBy}`);
    
    const database = getDb();
    
    if (database) {
      // Publish directly to database with SEO-optimized content
      await database.createArticle({
        id: articleId,
        slug: slug,
        category: 'telegram-news',
        title: title,
        description: description,
        content: content,
        image: '/static/blog/default-telegram.jpg',
        readTime: readTime,
        featured: false,
        status: 'published',
        telegramMessageId: message.message_id.toString(),
      });
      
      console.log(`✅ Blog post AUTO-PUBLISHED to database: ${slug} (SEO: ${seoData.optimizedBy})`);
      return { success: true, slug, method: 'database', seoOptimizedBy: seoData.optimizedBy };
    } else {
      // Fallback to file-based storage
      const articlesPath = path.join(__dirname, '../../src/data/blog/articles.json');
      const articlesData = JSON.parse(fs.readFileSync(articlesPath, 'utf8'));
      
      const articleMetadata = {
        id: articleId,
        slug: slug,
        category: 'telegram-news',
        title: title,
        description: description,
        image: '/static/blog/default-telegram.jpg',
        readTime: readTime,
        createdAt: new Date().toISOString().split('T')[0],
        author: null,
        featured: false
      };
      
      articlesData.articles.unshift(articleMetadata);
      fs.writeFileSync(articlesPath, JSON.stringify(articlesData, null, 2), 'utf8');
      
      // Create content file
      const contentPath = path.join(__dirname, '../../src/data/blog/articles', `${slug}.json`);
      const contentData = {
        id: articleId,
        content: content
      };
      fs.writeFileSync(contentPath, JSON.stringify(contentData, null, 2), 'utf8');
      
      console.log(`✅ Blog post AUTO-PUBLISHED to files: ${slug} (SEO: ${seoData.optimizedBy})`);
      return { success: true, slug, method: 'file', seoOptimizedBy: seoData.optimizedBy };
    }
  } catch (error) {
    console.error('Error publishing blog post:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send message via Telegram Bot API
 */
async function sendTelegramMessage(chatId, text, options = {}) {
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        ...options,
      }),
    });
    
    const data = await response.json();
    if (!data.ok) {
      console.error('Telegram API error:', data);
    }
    return data;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return null;
  }
}

/**
 * Generate verification code for account linking
 */
function generateVerificationCode() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Handle incoming Telegram webhook
 */
async function handleWebhook(req, res) {
  try {
    const update = req.body;
    
    if (!update.message) {
      return res.sendStatus(200);
    }
    
    const message = update.message;
    const chat = message.chat;
    const chatId = chat.id;
    const chatType = chat.type; // 'private', 'group', 'supergroup'
    const text = message.text || message.caption || '';
    const from = message.from;
    const firstName = from.first_name || '';
    const username = from.username || '';
    
    console.log(`Telegram message from ${firstName} (@${username}) in ${chatType}: ${text.substring(0, 50)}...`);
    
    // ========================================
    // BLOG INTEGRATION: Handle group messages
    // ========================================
    if (chatType === 'group' || chatType === 'supergroup') {
      // Check if this is the target group (if specified)
      if (TELEGRAM_BLOG_GROUP_ID && chatId.toString() !== TELEGRAM_BLOG_GROUP_ID) {
        return res.sendStatus(200);
      }
      
      // Check if sender is an admin
      // ID 1087968824 = GroupAnonymousBot (anonymous admin posts)
      // ID 136817688 = Channel bot (forwarded from channel)
      const isAnonymousAdmin = from.id === 1087968824 || from.id === 136817688;
      const isKnownAdmin = TELEGRAM_BLOG_ADMIN_IDS.length === 0 || TELEGRAM_BLOG_ADMIN_IDS.includes(from.id);
      const isAdmin = isAnonymousAdmin || isKnownAdmin;
      
      // Check minimum length
      const hasMinLength = text.length >= MIN_BLOG_POST_LENGTH;
      
      // Check for exclusion hashtag
      const isExcluded = text.includes('#noblog') || text.includes('#нетблог');
      
      console.log(`📝 Group message: from=${from.id}, isAdmin=${isAdmin}, length=${text.length}, excluded=${isExcluded}`);
      
      if (isAdmin && hasMinLength && !isExcluded) {
        // Auto-publish blog post from admin (no moderation needed)
        publishBlogPostFromTelegram(message).then(result => {
          if (result.success) {
            console.log(`📝 Blog post from admin ${firstName || 'Anonymous'} AUTO-PUBLISHED: ${result.slug}`);
          } else {
            console.error(`❌ Failed to publish blog post: ${result.error}`);
          }
        });
      }
      
      // Don't respond to group messages
      return res.sendStatus(200);
    }
    
    // ========================================
    // PRIVATE CHAT: Handle bot commands
    // ========================================
    
    // Handle /start command with deep link
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      
      if (parts.length > 1) {
        // Deep link: /start CODE_userId
        const payload = parts[1];
        const [code, userId] = payload.split('_');
        
        if (code && userId) {
          // Verify the code and link account
          await handleAccountLinking(chatId, code, userId, firstName);
        } else {
          await sendWelcomeMessage(chatId, firstName);
        }
      } else {
        await sendWelcomeMessage(chatId, firstName);
      }
    }
    // Handle verification code input
    else if (/^\d{6}$/.test(text)) {
      await handleVerificationCode(chatId, text, firstName);
    }
    // Handle other commands
    else if (text === '/help') {
      await sendHelpMessage(chatId);
    }
    else if (text === '/status') {
      await sendStatusMessage(chatId);
    }
    else if (text === '/myid') {
      await sendTelegramMessage(chatId, `🆔 Ваш Chat ID: <code>${chatId}</code>\n\nИспользуйте этот ID для настройки уведомлений администратора.`);
    }
    else {
      await sendUnknownCommandMessage(chatId);
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Telegram webhook error:', error);
    res.sendStatus(200); // Always return 200 to Telegram
  }
}

/**
 * Send welcome message
 */
async function sendWelcomeMessage(chatId, firstName) {
  const message = `👋 Привет, ${firstName}!

Я бот <b>YouDu</b> — буду присылать уведомления о новых откликах, сообщениях и заданиях.

🔗 <b>Чтобы подключить уведомления:</b>
1. Зайдите на сайт youdu.ae
2. Откройте Настройки профиля
3. Нажмите "Подключить Telegram"
4. Введите код, который там появится

Или просто отправьте мне 6-значный код из настроек.

💡 Команды:
/help — помощь
/status — статус подключения`;

  await sendTelegramMessage(chatId, message);
}

/**
 * Send help message
 */
async function sendHelpMessage(chatId) {
  const message = `📚 <b>Помощь</b>

Этот бот присылает уведомления с сайта youdu.ae:
• 📬 Новые отклики на ваши задания
• ✅ Когда вас выбрали исполнителем
• 💬 Новые сообщения в чатах
• 📋 Новые задания в ваших категориях

<b>Как подключить:</b>
1. Зайдите на youdu.ae
2. Настройки → Уведомления
3. Нажмите "Подключить Telegram"
4. Отправьте мне код

<b>Команды:</b>
/start — начать
/status — проверить подключение
/help — эта справка`;

  await sendTelegramMessage(chatId, message);
}

/**
 * Check connection status
 */
async function sendStatusMessage(chatId) {
  try {
    // Search for user with this chatId
    const usersResponse = await integrationSdk.users.query({
      perPage: 100,
    });
    
    const users = usersResponse.data.data;
    const linkedUser = users.find(user => {
      const privateData = user.attributes.profile.privateData || {};
      return privateData.telegramChatId === chatId.toString();
    });
    
    if (linkedUser) {
      const displayName = linkedUser.attributes.profile.displayName || 'Пользователь';
      await sendTelegramMessage(chatId, 
        `✅ <b>Подключено!</b>\n\nВаш аккаунт: ${displayName}\n\nВы будете получать уведомления о новых откликах, сообщениях и заданиях.`
      );
    } else {
      await sendTelegramMessage(chatId,
        `❌ <b>Не подключено</b>\n\nВаш Telegram не привязан к аккаунту YouDu.\n\nЗайдите на youdu.ae → Настройки → Подключить Telegram`
      );
    }
  } catch (error) {
    console.error('Error checking status:', error);
    await sendTelegramMessage(chatId, '⚠️ Ошибка проверки статуса. Попробуйте позже.');
  }
}

/**
 * Handle unknown command
 */
async function sendUnknownCommandMessage(chatId) {
  await sendTelegramMessage(chatId,
    `🤔 Не понял команду.\n\nЕсли хотите привязать аккаунт — отправьте 6-значный код из настроек на youdu.ae\n\n/help — справка`
  );
}

/**
 * Handle verification code from user
 */
async function handleVerificationCode(chatId, code, firstName) {
  // Check if code exists in pending verifications
  const verification = pendingVerifications.get(code);
  
  if (!verification) {
    await sendTelegramMessage(chatId,
      `❌ Код не найден или истёк.\n\nПолучите новый код в настройках на youdu.ae`
    );
    return;
  }
  
  // Check if code expired (10 minutes)
  if (Date.now() - verification.createdAt > 10 * 60 * 1000) {
    pendingVerifications.delete(code);
    await sendTelegramMessage(chatId,
      `⏰ Код истёк.\n\nПолучите новый код в настройках на youdu.ae`
    );
    return;
  }
  
  try {
    // Update user's privateData with telegramChatId
    await integrationSdk.users.updateProfile({
      id: verification.userId,
      privateData: {
        telegramChatId: chatId.toString(),
        telegramUsername: firstName,
        telegramLinkedAt: new Date().toISOString(),
      },
    });
    
    // Remove used code
    pendingVerifications.delete(code);
    
    await sendTelegramMessage(chatId,
      `✅ <b>Отлично, ${firstName}!</b>\n\nВаш Telegram успешно привязан к аккаунту YouDu.\n\nТеперь вы будете получать уведомления:\n• 📬 Новые отклики\n• ✅ Принятие откликов\n• 💬 Новые сообщения`
    );
    
    console.log(`Telegram linked: chatId=${chatId}, userId=${verification.userId}`);
  } catch (error) {
    console.error('Error linking Telegram:', error);
    await sendTelegramMessage(chatId,
      `⚠️ Ошибка привязки аккаунта. Попробуйте позже.`
    );
  }
}

/**
 * Handle account linking via deep link
 */
async function handleAccountLinking(chatId, code, userId, firstName) {
  // For deep link, code might be the full verification
  await handleVerificationCode(chatId, code, firstName);
}

/**
 * API: Generate verification code for user
 */
async function generateCode(req, res) {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    // Generate new code
    const code = generateVerificationCode();
    
    // Store with expiration
    pendingVerifications.set(code, {
      userId,
      createdAt: Date.now(),
    });
    
    // Clean up old codes (older than 10 minutes)
    for (const [key, value] of pendingVerifications.entries()) {
      if (Date.now() - value.createdAt > 10 * 60 * 1000) {
        pendingVerifications.delete(key);
      }
    }
    
    // Generate deep link
    const botUsername = 'YouDuAE_bot';
    const deepLink = `https://t.me/${botUsername}?start=${code}_${userId}`;
    
    res.json({
      code,
      deepLink,
      expiresIn: 600, // 10 minutes
    });
  } catch (error) {
    console.error('Error generating code:', error);
    res.status(500).json({ error: 'Failed to generate code' });
  }
}

/**
 * API: Check if user has Telegram linked
 */
async function checkTelegramStatus(req, res) {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    const userResponse = await integrationSdk.users.show({
      id: userId,
    });
    
    const privateData = userResponse.data.data.attributes.profile.privateData || {};
    const isLinked = !!privateData.telegramChatId;
    
    res.json({
      isLinked,
      linkedAt: privateData.telegramLinkedAt || null,
    });
  } catch (error) {
    console.error('Error checking Telegram status:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
}

/**
 * API: Unlink Telegram from user account
 */
async function unlinkTelegram(req, res) {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    // Get current user to find chatId
    const userResponse = await integrationSdk.users.show({
      id: userId,
    });
    
    const privateData = userResponse.data.data.attributes.profile.privateData || {};
    const chatId = privateData.telegramChatId;
    
    // Remove telegramChatId from user
    await integrationSdk.users.updateProfile({
      id: userId,
      privateData: {
        telegramChatId: null,
        telegramUsername: null,
        telegramLinkedAt: null,
      },
    });
    
    // Notify user in Telegram
    if (chatId) {
      await sendTelegramMessage(chatId,
        `🔓 Ваш Telegram отключён от аккаунта YouDu.\n\nВы больше не будете получать уведомления.\n\nЧтобы подключить снова — зайдите в настройки на youdu.ae`
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error unlinking Telegram:', error);
    res.status(500).json({ error: 'Failed to unlink' });
  }
}

// ============================================
// NOTIFICATION FUNCTIONS
// ============================================

/**
 * Send notification about new offer/response
 */
async function notifyNewOffer(userId, data) {
  const chatId = await getUserTelegramChatId(userId);
  if (!chatId) return false;
  
  const { listingTitle, executorName, offerPrice, listingUrl } = data;
  
  const message = `📬 <b>Новый отклик!</b>

<b>${executorName}</b> откликнулся на ваше задание:
"${listingTitle}"

💰 Цена: ${offerPrice || 'Не указана'}

<a href="${listingUrl}">Открыть задание →</a>`;

  return await sendTelegramMessage(chatId, message);
}

/**
 * Send notification when offer is accepted
 */
async function notifyOfferAccepted(userId, data) {
  const chatId = await getUserTelegramChatId(userId);
  if (!chatId) return false;
  
  const { listingTitle, customerName, listingUrl } = data;
  
  const message = `✅ <b>Вас выбрали!</b>

<b>${customerName}</b> выбрал вас исполнителем:
"${listingTitle}"

<a href="${listingUrl}">Открыть задание →</a>`;

  return await sendTelegramMessage(chatId, message);
}

/**
 * Send notification when offer is declined
 */
async function notifyOfferDeclined(userId, data) {
  const chatId = await getUserTelegramChatId(userId);
  if (!chatId) return false;
  
  const { listingTitle } = data;
  
  const message = `❌ <b>Отклик отклонён</b>

К сожалению, ваш отклик на задание "${listingTitle}" был отклонён.

Не расстраивайтесь — на YouDu много других заданий!`;

  return await sendTelegramMessage(chatId, message);
}

/**
 * Send notification about new message
 */
async function notifyNewMessage(userId, data) {
  const chatId = await getUserTelegramChatId(userId);
  if (!chatId) return false;
  
  const { senderName, messagePreview, conversationUrl } = data;
  
  const message = `💬 <b>Новое сообщение</b>

От: <b>${senderName}</b>
"${messagePreview}"

<a href="${conversationUrl}">Ответить →</a>`;

  return await sendTelegramMessage(chatId, message);
}

/**
 * Send notification about new listing in user's category
 */
async function notifyNewListing(userId, data) {
  const chatId = await getUserTelegramChatId(userId);
  if (!chatId) return false;
  
  const { listingTitle, category, price, listingUrl } = data;
  
  const message = `📋 <b>Новое задание</b>

"${listingTitle}"
📁 ${category}
💰 ${price || 'Цена договорная'}

<a href="${listingUrl}">Откликнуться →</a>`;

  return await sendTelegramMessage(chatId, message);
}

/**
 * Get user's Telegram chatId from Sharetribe
 */
async function getUserTelegramChatId(userId) {
  try {
    const userResponse = await integrationSdk.users.show({
      id: userId,
    });
    
    const privateData = userResponse.data.data.attributes.profile.privateData || {};
    return privateData.telegramChatId || null;
  } catch (error) {
    console.error('Error getting user Telegram chatId:', error);
    return null;
  }
}

/**
 * Get all executors (customers) with Telegram linked in a specific category
 */
async function getExecutorsWithTelegramByCategory(categoryId) {
  try {
    // Get all users
    const usersResponse = await integrationSdk.users.query({
      perPage: 100,
    });
    
    const users = usersResponse.data.data;
    
    // Filter users who:
    // 1. Have serviceCategories including this category
    // 2. Have Telegram linked (telegramChatId in privateData)
    const executors = users.filter(user => {
      const publicData = user.attributes?.profile?.publicData || {};
      const privateData = user.attributes?.profile?.privateData || {};
      
      const serviceCategories = publicData.serviceCategories || [];
      const hasTelegram = !!privateData.telegramChatId;
      const hasCategory = Array.isArray(serviceCategories) && serviceCategories.includes(categoryId);
      
      return hasTelegram && hasCategory;
    });
    
    return executors.map(user => ({
      userId: user.id.uuid,
      chatId: user.attributes.profile.privateData.telegramChatId,
      displayName: user.attributes.profile.displayName,
    }));
  } catch (error) {
    console.error('Error getting executors by category:', error);
    return [];
  }
}

/**
 * Notify all executors in a category about new listing
 */
async function notifyNewListingToCategory(data) {
  const { categoryId, categoryName, listingTitle, price, listingUrl, listingId } = data;
  
  try {
    const executors = await getExecutorsWithTelegramByCategory(categoryId);
    
    if (executors.length === 0) {
      console.log(`📱 No executors with Telegram in category ${categoryId}`);
      return { sent: 0, total: 0 };
    }
    
    console.log(`📱 Sending new listing notification to ${executors.length} executors in ${categoryId}`);
    
    const message = `📋 <b>Новое задание!</b>

"${listingTitle}"
📁 ${categoryName}
💰 ${price || 'Цена договорная'}

<a href="${listingUrl}">Откликнуться →</a>`;

    let sent = 0;
    
    for (const executor of executors) {
      try {
        await sendTelegramMessage(executor.chatId, message);
        sent++;
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (err) {
        console.error(`Failed to notify ${executor.userId}:`, err.message);
      }
    }
    
    console.log(`📱 Sent ${sent}/${executors.length} notifications for listing ${listingId}`);
    return { sent, total: executors.length };
  } catch (error) {
    console.error('Error notifying category executors:', error);
    return { sent: 0, total: 0, error: error.message };
  }
}

/**
 * Send notification to admin about new portfolio photos for moderation
 */
async function notifyAdminPortfolioModeration(data) {
  if (!TELEGRAM_ADMIN_CHAT_ID) {
    console.log('⚠️ TELEGRAM_ADMIN_CHAT_ID not set, skipping admin notification');
    return false;
  }
  
  const { userId, userName, photosCount, profileUrl, consoleUrl } = data;
  
  const message = `📸 <b>Новые фото на модерацию!</b>

👤 Пользователь: <b>${userName}</b>
🖼 Фото: ${photosCount} шт.

<a href="${profileUrl}">Профиль пользователя →</a>
<a href="${consoleUrl}">Открыть Console →</a>

⏰ Ожидает модерации`;

  return await sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, message);
}

/**
 * Setup Telegram webhook
 */
async function setupWebhook(webhookUrl) {
  try {
    const response = await fetch(`${TELEGRAM_API}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message'],
      }),
    });
    
    const data = await response.json();
    console.log('Telegram webhook setup:', data);
    return data;
  } catch (error) {
    console.error('Error setting up webhook:', error);
    return null;
  }
}

module.exports = {
  handleWebhook,
  generateCode,
  checkTelegramStatus,
  unlinkTelegram,
  setupWebhook,
  // Notification functions
  notifyNewOffer,
  notifyOfferAccepted,
  notifyOfferDeclined,
  notifyNewMessage,
  notifyNewListing,
  notifyNewListingToCategory,
  notifyAdminPortfolioModeration,
  getExecutorsWithTelegramByCategory,
  sendTelegramMessage,
  getUserTelegramChatId,
};
