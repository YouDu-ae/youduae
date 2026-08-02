const { v4: uuidv4 } = require('uuid');

const ADMIN_PASSWORD = process.env.BLOG_ADMIN_PASSWORD || 'youdu-blog-2026';

const authenticate = (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
};

const getArticles = (db) => async (req, res) => {
  try {
    const result = await db.query(`
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

    if (!title_ru || !slug) {
      return res.status(400).json({ error: 'Title and slug are required' });
    }

    const id = slug || uuidv4();
    
    const existingResult = await db.query(
      'SELECT id FROM blog_articles WHERE slug = $1',
      [slug]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'Article with this slug already exists' });
    }

    const result = await db.query(`
      INSERT INTO blog_articles (
        id, slug, category_id, title_ru, title_en, 
        description_ru, description_en, content_ru, content_en,
        image, read_time, author_name, featured, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      id, slug, category_id || 'cases', title_ru, title_en || '',
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

    const result = await db.query(`
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

    await db.query('DELETE FROM blog_article_gallery WHERE article_id = $1', [id]);
    const result = await db.query('DELETE FROM blog_articles WHERE id = $1 RETURNING id', [id]);

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

    const result = await db.query(`
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
    await db.query(`
      CREATE TABLE IF NOT EXISTS blog_article_gallery (
        id SERIAL PRIMARY KEY,
        article_id VARCHAR(100) REFERENCES blog_articles(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query('DELETE FROM blog_article_gallery WHERE article_id = $1', [articleId]);

    for (let i = 0; i < gallery.length; i++) {
      await db.query(
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
  getArticles,
  createArticle,
  updateArticle,
  deleteArticle,
  publishArticle,
};
