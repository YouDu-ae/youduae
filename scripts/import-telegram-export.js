#!/usr/bin/env node
/**
 * Импорт постов из экспорта Telegram Desktop
 * 
 * Как использовать:
 * 1. Откройте Telegram Desktop
 * 2. Зайдите в группу youdu_uae
 * 3. Нажмите ⋮ → Export chat history
 * 4. Выберите JSON формат, снимите галочки с media (или оставьте)
 * 5. Экспортируйте в папку
 * 6. Запустите: node scripts/import-telegram-export.js путь/к/result.json
 */

const fs = require('fs');
const path = require('path');

// Конфигурация
const ADMIN_IDS = []; // Добавьте ID админов группы (можно оставить пустым для импорта всех)
const ADMIN_NAMES = ['YouDu', 'Admin']; // Или фильтровать по имени
const MIN_MESSAGE_LENGTH = 100; // Минимальная длина поста для импорта
const BLOG_DATA_PATH = path.join(__dirname, '../src/data/blog');

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

function extractTitle(text) {
  // Берём первую строку или первые 60 символов
  const firstLine = text.split('\n')[0].replace(/[#*_]/g, '').trim();
  return firstLine.length > 60 ? firstLine.substring(0, 57) + '...' : firstLine;
}

function textToHtml(text) {
  // Конвертируем Telegram разметку в HTML
  let html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // **bold**
    .replace(/__(.*?)__/g, '<em>$1</em>') // __italic__
    .replace(/\n\n/g, '</p><p>') // Параграфы
    .replace(/\n/g, '<br/>'); // Переносы строк
  
  return `<p>${html}</p>`;
}

function categorizePost(text) {
  const lower = text.toLowerCase();
  
  if (lower.includes('кейс') || lower.includes('проект') || lower.includes('результат')) {
    return 'cases';
  }
  if (lower.includes('совет') || lower.includes('как выбрать') || lower.includes('сколько стоит')) {
    return 'client-guide';
  }
  if (lower.includes('заработ') || lower.includes('специалист') || lower.includes('мастер')) {
    return 'specialist-guide';
  }
  return 'uae-life';
}

function estimateReadTime(text) {
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

function processExport(exportPath) {
  console.log(`📂 Читаю файл: ${exportPath}`);
  
  const data = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  const messages = data.messages || [];
  
  console.log(`📝 Найдено сообщений: ${messages.length}`);
  
  // Фильтруем сообщения
  const filtered = messages.filter(msg => {
    // Только текстовые сообщения
    if (!msg.text || typeof msg.text === 'object') return false;
    
    // Минимальная длина
    const textLength = typeof msg.text === 'string' ? msg.text.length : 0;
    if (textLength < MIN_MESSAGE_LENGTH) return false;
    
    // Фильтр по админам (если указаны)
    if (ADMIN_IDS.length > 0 && !ADMIN_IDS.includes(msg.from_id)) return false;
    if (ADMIN_NAMES.length > 0 && !ADMIN_NAMES.some(name => 
      msg.from?.toLowerCase().includes(name.toLowerCase())
    )) return false;
    
    return true;
  });
  
  console.log(`✅ После фильтрации: ${filtered.length} постов`);
  
  if (filtered.length === 0) {
    console.log('⚠️ Нет постов для импорта. Проверьте фильтры ADMIN_IDS/ADMIN_NAMES');
    return;
  }
  
  // Читаем текущий articles.json
  const articlesPath = path.join(BLOG_DATA_PATH, 'articles.json');
  const articlesData = JSON.parse(fs.readFileSync(articlesPath, 'utf8'));
  const existingIds = new Set(articlesData.articles.map(a => a.id));
  
  const newArticles = [];
  const newContents = [];
  
  filtered.forEach((msg, index) => {
    const text = typeof msg.text === 'string' ? msg.text : 
      msg.text.map(t => typeof t === 'string' ? t : t.text || '').join('');
    
    const title = extractTitle(text);
    let slug = slugify(title);
    
    // Уникальный slug
    let counter = 1;
    while (existingIds.has(slug)) {
      slug = `${slugify(title)}-${counter}`;
      counter++;
    }
    existingIds.add(slug);
    
    const date = msg.date ? msg.date.split('T')[0] : new Date().toISOString().split('T')[0];
    
    const metadata = {
      id: slug,
      slug: slug,
      category: categorizePost(text),
      title: {
        ru: title,
        en: title // TODO: перевести
      },
      description: {
        ru: text.substring(0, 155) + '...',
        en: text.substring(0, 155) + '...'
      },
      image: '/static/blog/default-post.jpg',
      readTime: estimateReadTime(text),
      createdAt: date,
      author: null,
      relatedCategory: null,
      featured: false,
      _telegramMessageId: msg.id // Для отслеживания дубликатов
    };
    
    const content = {
      id: slug,
      content: {
        ru: textToHtml(text),
        en: textToHtml(text)
      },
      gallery: [],
      tags: []
    };
    
    // Если есть фото в сообщении
    if (msg.photo) {
      metadata.image = `/static/blog/telegram-${msg.id}.jpg`;
      console.log(`📷 Сообщение ${msg.id} содержит фото: ${msg.photo}`);
    }
    
    newArticles.push(metadata);
    newContents.push(content);
    
    console.log(`  ${index + 1}. "${title.substring(0, 40)}..." → ${slug}`);
  });
  
  // Сохраняем
  console.log('\n💾 Сохраняю...');
  
  // Добавляем в articles.json
  articlesData.articles = [...newArticles, ...articlesData.articles];
  fs.writeFileSync(articlesPath, JSON.stringify(articlesData, null, 2), 'utf8');
  console.log(`✅ Обновлён articles.json (добавлено ${newArticles.length} статей)`);
  
  // Создаём файлы контента
  const articlesDir = path.join(BLOG_DATA_PATH, 'articles');
  if (!fs.existsSync(articlesDir)) {
    fs.mkdirSync(articlesDir, { recursive: true });
  }
  
  newContents.forEach(content => {
    const filePath = path.join(articlesDir, `${content.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
  });
  console.log(`✅ Созданы файлы контента в articles/`);
  
  console.log('\n🎉 Импорт завершён!');
  console.log('📌 Не забудьте:');
  console.log('   1. Проверить и отредактировать статьи');
  console.log('   2. Добавить изображения в public/static/blog/');
  console.log('   3. Сделать git commit и push');
}

// Запуск
const exportPath = process.argv[2];
if (!exportPath) {
  console.log('❌ Укажите путь к файлу экспорта');
  console.log('   Использование: node scripts/import-telegram-export.js путь/к/result.json');
  console.log('');
  console.log('   Как получить файл:');
  console.log('   1. Откройте Telegram Desktop');
  console.log('   2. Зайдите в группу');
  console.log('   3. ⋮ → Export chat history → JSON');
  process.exit(1);
}

processExport(exportPath);
