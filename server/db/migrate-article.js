/**
 * Migration script to add initial article to database
 * Run with: heroku run node server/db/migrate-article.js -a youdu
 */

require('../env').configureEnv();
const db = require('./index');

const article = {
  id: 'youdu-mobile-app',
  slug: 'youdu-zapuskaet-mobilnoe-prilozhenie',
  category: 'telegram-news',
  title: {
    ru: 'YouDu запускает мобильное приложение для iOS',
    en: 'YouDu Launches Mobile App for iOS'
  },
  description: {
    ru: 'Мы активно работаем над мобильной версией маркетплейса услуг YouDu — это главный приоритет развития платформы в 2026 году.',
    en: 'We are actively working on the mobile version of YouDu marketplace — this is the main development priority in 2026.'
  },
  content: {
    ru: '<p>Мы активно работаем над мобильной версией маркетплейса услуг YouDu.ae — это главный приоритет развития платформы в 2026 году.</p><h2>Что изменится для заказчиков</h2><ul><li>Публикация задания за 20 секунд (вместо 2-3 минут с компьютера)</li><li>Мгновенные push-уведомления об откликах</li><li>Удобный чат с исполнителями</li></ul><h2>Что изменится для специалистов</h2><ul><li>Быстрый отклик на новые заказы</li><li>Уведомления о заданиях в вашей категории</li><li>Управление профилем на ходу</li></ul><p>Делимся первым дизайном главного экрана. Впереди ещё много работы, но фундамент готов.</p><p>Вопросы и пожелания — пишите в комментарии в нашем <a href="https://t.me/youdu_uae">Telegram</a>!</p>',
    en: '<p>We are actively working on the mobile version of YouDu.ae marketplace — this is the main development priority in 2026.</p><h2>What will change for clients</h2><ul><li>Post a task in 20 seconds (instead of 2-3 minutes from computer)</li><li>Instant push notifications about responses</li><li>Convenient chat with specialists</li></ul><h2>What will change for specialists</h2><ul><li>Quick response to new orders</li><li>Notifications about tasks in your category</li><li>Profile management on the go</li></ul><p>We share the first design of the main screen. There is still a lot of work ahead, but the foundation is ready.</p><p>Questions and suggestions — write in the comments in our <a href="https://t.me/youdu_uae">Telegram</a>!</p>'
  },
  image: '/static/blog/mobile-app.jpg',
  readTime: 2,
  featured: true,
  status: 'published'
};

async function migrate() {
  try {
    console.log('Starting migration...');
    
    // Check if article exists
    const existing = await db.getArticleBySlug(article.slug);
    if (existing) {
      console.log('Article already exists, skipping');
      process.exit(0);
    }
    
    // Create article
    await db.createArticle(article);
    console.log('Article created successfully!');
    
    // Verify
    const created = await db.getArticleBySlug(article.slug);
    console.log('Verified:', created ? 'OK' : 'FAILED');
    
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
