/**
 * API для получения статей блога
 */

const fs = require('fs');
const path = require('path');

const ARTICLES_PATH = path.join(__dirname, '../../src/data/blog/articles.json');

function getArticles(req, res) {
  try {
    const { category } = req.query;
    
    // Read fresh data from file
    const data = JSON.parse(fs.readFileSync(ARTICLES_PATH, 'utf8'));
    
    let articles = data.articles || [];
    
    // Filter by category if specified
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

function getArticleBySlug(req, res) {
  try {
    const { slug } = req.params;
    
    // Read articles index
    const data = JSON.parse(fs.readFileSync(ARTICLES_PATH, 'utf8'));
    const article = data.articles.find(a => a.slug === slug);
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    // Try to read full content
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
