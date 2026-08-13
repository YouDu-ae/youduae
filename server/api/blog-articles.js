/**
 * API для получения статей блога
 * Использует PostgreSQL на продакшене, файлы для локальной разработки
 */

const fs = require('fs');
const path = require('path');

const ARTICLES_PATH = path.join(__dirname, '../../src/data/blog/articles.json');

// Продакшен отдаёт статику из build/, локальная разработка — из public/
const COVERS_DIRS = [
  path.join(__dirname, '../../build/static/blog'),
  path.join(__dirname, '../../public/static/blog'),
];
const COVERS_PREFIX = '/static/blog/';
const COVERS_TTL = 5 * 60 * 1000;

let coversCache = { names: null, readAt: 0 };

const availableCovers = () => {
  if (coversCache.names && Date.now() - coversCache.readAt < COVERS_TTL) {
    return coversCache.names;
  }

  const names = new Set();
  COVERS_DIRS.forEach(dir => {
    try {
      fs.readdirSync(dir).forEach(name => names.add(name));
    } catch (e) {
      // Папки нет в этом окружении — просто пропускаем
    }
  });

  coversCache = { names, readAt: Date.now() };
  return names;
};

/**
 * Часть статей хранит путь к обложке, которую так и не загрузили.
 * Отдаём такие как image: null, чтобы каждая страница подставила свою заглушку,
 * а битый URL не попал в Open Graph и Schema.org.
 */
const withResolvedCover = article => {
  const image = article && article.image;
  if (!image || !image.startsWith(COVERS_PREFIX)) {
    return article;
  }

  return availableCovers().has(path.basename(image)) ? article : { ...article, image: null };
};

let db = null;
const getDb = () => {
  if (!db && process.env.DATABASE_URL) {
    db = require('../db');
  }
  return db;
};

async function getArticles(req, res) {
  try {
    const { category } = req.query;
    const database = getDb();
    
    if (database) {
      const [categories, articles] = await Promise.all([
        database.getCategories(),
        database.getArticles(category, 'published')
      ]);
      
      const allCategories = [
        { id: 'all', name: { ru: 'Все статьи', en: 'All Articles' } },
        ...categories
      ];
      
      return res.json({ categories: allCategories, articles: articles.map(withResolvedCover) });
    }
    
    const data = JSON.parse(fs.readFileSync(ARTICLES_PATH, 'utf8'));
    let articles = data.articles || [];
    
    if (category && category !== 'all') {
      articles = articles.filter(a => a.category === category);
    }
    
    res.json({
      categories: data.categories,
      articles: articles.map(withResolvedCover)
    });
  } catch (error) {
    console.error('Error reading articles:', error);
    res.status(500).json({ error: 'Failed to load articles' });
  }
}

async function getArticleBySlug(req, res) {
  try {
    const { slug } = req.params;
    const database = getDb();
    
    if (database) {
      const [article, categories] = await Promise.all([
        database.getArticleBySlug(slug),
        database.getCategories()
      ]);
      
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }
      
      const allCategories = [
        { id: 'all', name: { ru: 'Все статьи', en: 'All Articles' } },
        ...categories
      ];
      
      return res.json({ ...withResolvedCover(article), categories: allCategories });
    }
    
    const data = JSON.parse(fs.readFileSync(ARTICLES_PATH, 'utf8'));
    const article = data.articles.find(a => a.slug === slug);
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    const contentPath = path.join(__dirname, '../../src/data/blog/articles', `${slug}.json`);
    let content = null;
    
    if (fs.existsSync(contentPath)) {
      const contentData = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
      content = contentData.content;
    }
    
    res.json({
      ...withResolvedCover(article),
      content: content,
      categories: data.categories
    });
  } catch (error) {
    console.error('Error reading article:', error);
    res.status(500).json({ error: 'Failed to load article' });
  }
}

module.exports = {
  getArticles,
  getArticleBySlug
};
