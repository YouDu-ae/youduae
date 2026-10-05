/**
 * Сколько специалистов работает в каждой категории — для подсказки в мастере задания.
 * Подсчёт живёт в api-util/specialistsSummary, здесь только HTTP-обёртка.
 */

const {
  getSpecialistsSummary,
  hasIntegrationCredentials,
  CACHE_TTL_MS,
} = require('../api-util/specialistsSummary');

module.exports = (req, res) => {
  if (!hasIntegrationCredentials()) {
    return res.status(500).json({ error: 'Integration API credentials not configured' });
  }

  getSpecialistsSummary()
    .then(({ total, avatars, categories }) => {
      res.set('Cache-Control', `public, max-age=${CACHE_TTL_MS / 1000}`);
      res.status(200).json({ total, avatars, categories });
    })
    .catch(err => {
      console.error('❌ Specialists summary failed:', err?.message);
      res.status(500).json({ error: 'Query failed' });
    });
};
