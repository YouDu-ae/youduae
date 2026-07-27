/**
 * AI-powered SEO optimization for blog posts
 * Uses OpenAI GPT to generate optimized titles, descriptions, and content
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Optimize blog post content for SEO using OpenAI
 * @param {string} originalText - Original post text from Telegram
 * @returns {Object} Optimized SEO data
 */
async function optimizeForSEO(originalText) {
  if (!OPENAI_API_KEY) {
    console.log('⚠️ OPENAI_API_KEY not set, using basic SEO');
    return generateBasicSEO(originalText);
  }

  try {
    const prompt = `Ты SEO-специалист. Оптимизируй текст для поисковиков и социальных сетей.

ИСХОДНЫЙ ТЕКСТ:
${originalText}

Верни JSON (только JSON, без markdown):
{
  "title_ru": "SEO-заголовок на русском (50-60 символов, с ключевыми словами)",
  "title_en": "SEO title in English (50-60 chars)",
  "description_ru": "Meta description на русском (150-160 символов, призыв к действию)",
  "description_en": "Meta description in English (150-160 chars)",
  "keywords_ru": ["ключевое1", "ключевое2", "ключевое3", "ключевое4", "ключевое5"],
  "keywords_en": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "content_ru": "HTML-форматированный контент с <h2> подзаголовками, <p> параграфами, <ul><li> списками где уместно. Сохрани смысл, улучши читаемость.",
  "content_en": "Same content translated to English with HTML formatting"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an SEO expert. Always respond with valid JSON only, no markdown code blocks.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      return generateBasicSEO(originalText);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      console.error('Empty response from OpenAI');
      return generateBasicSEO(originalText);
    }

    // Parse JSON response (handle potential markdown wrapping)
    let seoData;
    try {
      // Remove potential markdown code block
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      seoData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      console.log('Raw response:', content);
      return generateBasicSEO(originalText);
    }

    console.log('✅ SEO optimization completed via OpenAI');

    return {
      title: {
        ru: seoData.title_ru || generateBasicTitle(originalText),
        en: seoData.title_en || seoData.title_ru,
      },
      description: {
        ru: seoData.description_ru || originalText.substring(0, 160),
        en: seoData.description_en || seoData.description_ru,
      },
      keywords: {
        ru: seoData.keywords_ru || [],
        en: seoData.keywords_en || [],
      },
      content: {
        ru: seoData.content_ru || formatBasicContent(originalText),
        en: seoData.content_en || seoData.content_ru,
      },
      optimizedBy: 'openai',
    };

  } catch (error) {
    console.error('SEO optimization error:', error);
    return generateBasicSEO(originalText);
  }
}

/**
 * Generate basic SEO without AI (fallback)
 */
function generateBasicSEO(text) {
  const title = generateBasicTitle(text);
  const description = text.substring(0, 160).replace(/\n/g, ' ').trim();
  const content = formatBasicContent(text);

  return {
    title: { ru: title, en: title },
    description: { ru: description, en: description },
    keywords: { ru: [], en: [] },
    content: { ru: content, en: content },
    optimizedBy: 'basic',
  };
}

/**
 * Generate basic title from first line
 */
function generateBasicTitle(text) {
  return text.split('\n')[0].replace(/[#*_]/g, '').trim().substring(0, 100) || 'Новость YouDu';
}

/**
 * Format text as basic HTML content
 */
function formatBasicContent(text) {
  return `<p>${text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
}

module.exports = {
  optimizeForSEO,
  generateBasicSEO,
};
