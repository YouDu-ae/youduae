/**
 * Publishes the AC-cleaning guide to PostgreSQL (production blog).
 *
 *   DATABASE_URL="$(heroku config:get DATABASE_URL --app youdu)" node scripts/publish-ac-article.js
 */

require('dotenv').config();

const { Pool } = require('pg');
const article = require('./articles/chistka-kondicionera-v-dubae');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const trimHtml = value => (value || '').replace(/^\s+/, '').trim();

const run = async () => {
  const client = await pool.connect();
  try {
    const category = await client.query('SELECT id FROM blog_categories WHERE id = $1', [
      article.category,
    ]);
    if (category.rows.length === 0) {
      throw new Error(`Category ${article.category} is missing in blog_categories`);
    }

    await client.query(
      `
      INSERT INTO blog_articles (
        id, slug, category_id, title_ru, title_en,
        description_ru, description_en, content_ru, content_en,
        image, read_time, author_name, keywords, featured, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT (slug) DO UPDATE SET
        category_id = EXCLUDED.category_id,
        title_ru = EXCLUDED.title_ru,
        title_en = EXCLUDED.title_en,
        description_ru = EXCLUDED.description_ru,
        description_en = EXCLUDED.description_en,
        content_ru = EXCLUDED.content_ru,
        content_en = EXCLUDED.content_en,
        image = EXCLUDED.image,
        read_time = EXCLUDED.read_time,
        keywords = EXCLUDED.keywords,
        featured = EXCLUDED.featured,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        article.id,
        article.slug,
        article.category,
        article.title.ru,
        article.title.en,
        article.description.ru,
        article.description.en,
        trimHtml(article.content.ru),
        trimHtml(article.content.en),
        article.image || '',
        article.readTime,
        null,
        article.keywords,
        article.featured,
        article.status,
      ]
    );

    const check = await client.query(
      `SELECT slug, status, featured, length(content_ru) AS ru_chars, length(content_en) AS en_chars
       FROM blog_articles WHERE slug = $1`,
      [article.slug]
    );
    console.log(check.rows[0]);
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch(err => {
  console.error(err.message);
  process.exit(1);
});
