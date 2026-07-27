/**
 * API для получения статей блога
 * Использует PostgreSQL на продакшене, файлы для локальной разработки
 */

const fs = require('fs');
const path = require('path');

const ARTICLES_PATH = path.join(__dirname, '../../src/data/blog/articles.json');

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
      
      return res.json({ categories: allCategories, articles });
    }
    
    const data = JSON.parse(fs.readFileSync(ARTICLES_PATH, 'utf8'));
    let articles = data.articles || [];
    
    if (category && category !== 'all') {
      articles = articles.filter(a => a.category === category);
    }
    
    res.json({
      categories: data.categories,
      articles: articles
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
      
      return res.json({ ...article, categories: allCategories });
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
      ...article,
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
