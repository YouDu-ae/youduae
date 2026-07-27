/**
 * API для генерации и работы с публичными ID заданий
 * Формат: YD-00001, YD-00002, ...
 */

let db = null;
const getDb = () => {
  if (!db && process.env.DATABASE_URL) {
    db = require('../db');
  }
  return db;
};

/**
 * POST /api/listing/generate-id
 * Генерирует новый публичный ID для задания
 */
async function generateId(req, res) {
  try {
    const database = getDb();
    
    if (!database) {
      // Fallback without database - generate based on timestamp
      const timestamp = Date.now().toString(36).toUpperCase();
      const publicId = `YD-${timestamp}`;
      return res.json({ publicId, source: 'timestamp' });
    }
    
    const publicId = await database.generateListingPublicId();
    
    console.log(`🆔 Generated listing ID: ${publicId}`);
    
    res.json({ publicId, source: 'database' });
  } catch (error) {
    console.error('Error generating listing ID:', error);
    res.status(500).json({ error: 'Failed to generate ID' });
  }
}

/**
 * POST /api/listing/save-mapping
 * Сохраняет связь публичного ID с UUID листинга в Sharetribe
 */
async function saveMapping(req, res) {
  try {
    const { publicId, sharetribeUuid } = req.body;
    
    if (!publicId || !sharetribeUuid) {
      return res.status(400).json({ error: 'publicId and sharetribeUuid are required' });
    }
    
    const database = getDb();
    
    if (!database) {
      // Without database, just acknowledge
      return res.json({ success: true, source: 'memory' });
    }
    
    await database.saveListingIdMapping(publicId, sharetribeUuid);
    
    console.log(`🆔 Saved mapping: ${publicId} -> ${sharetribeUuid}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving listing ID mapping:', error);
    res.status(500).json({ error: 'Failed to save mapping' });
  }
}

/**
 * GET /api/listing/by-public-id/:publicId
 * Получает UUID листинга по публичному ID
 */
async function getByPublicId(req, res) {
  try {
    const { publicId } = req.params;
    
    if (!publicId) {
      return res.status(400).json({ error: 'publicId is required' });
    }
    
    const database = getDb();
    
    if (!database) {
      return res.status(404).json({ error: 'Database not available' });
    }
    
    const sharetribeUuid = await database.getSharetribeUuidByPublicId(publicId.toUpperCase());
    
    if (!sharetribeUuid) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    res.json({ publicId, sharetribeUuid });
  } catch (error) {
    console.error('Error getting listing by public ID:', error);
    res.status(500).json({ error: 'Failed to get listing' });
  }
}

/**
 * GET /api/listing/public-id/:sharetribeUuid
 * Получает публичный ID по UUID листинга
 */
async function getPublicId(req, res) {
  try {
    const { sharetribeUuid } = req.params;
    
    if (!sharetribeUuid) {
      return res.status(400).json({ error: 'sharetribeUuid is required' });
    }
    
    const database = getDb();
    
    if (!database) {
      return res.status(404).json({ error: 'Database not available' });
    }
    
    const publicId = await database.getPublicIdBySharetribeUuid(sharetribeUuid);
    
    if (!publicId) {
      return res.status(404).json({ error: 'Public ID not found' });
    }
    
    res.json({ publicId, sharetribeUuid });
  } catch (error) {
    console.error('Error getting public ID:', error);
    res.status(500).json({ error: 'Failed to get public ID' });
  }
}

/**
 * GET /api/listing/stats
 * Получает статистику по ID
 */
async function getStats(req, res) {
  try {
    const database = getDb();
    
    if (!database) {
      return res.json({ totalListings: 0, source: 'unavailable' });
    }
    
    const totalListings = await database.getListingIdCounter();
    
    res.json({ totalListings, source: 'database' });
  } catch (error) {
    console.error('Error getting listing stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
}

module.exports = {
  generateId,
  saveMapping,
  getByPublicId,
  getPublicId,
  getStats,
};
