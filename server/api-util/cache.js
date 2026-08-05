/**
 * In-process TTL cache with single-flight de-duplication.
 *
 * The app runs as a single Node process per dyno, so a plain Map is enough and
 * avoids taking on a Redis dependency. Entries are per-process: if the app is
 * ever scaled to several dynos, each one keeps its own copy and upstream call
 * volume grows with the dyno count.
 */

const DEFAULT_MAX_ENTRIES = 200;

/**
 * @param {Object} options
 * @param {number} options.ttlMs How long a cached value stays fresh.
 * @param {number} [options.maxEntries] Upper bound on retained keys.
 */
const createCache = ({ ttlMs, maxEntries = DEFAULT_MAX_ENTRIES }) => {
  const entries = new Map(); // key -> { value, expiresAt }
  const inFlight = new Map(); // key -> Promise

  const prune = () => {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (now > entry.expiresAt) {
        entries.delete(key);
      }
    }
    // Map iterates in insertion order, so the first key is the oldest.
    while (entries.size > maxEntries) {
      entries.delete(entries.keys().next().value);
    }
  };

  /**
   * Resolves with the cached value for `key`, otherwise runs `producer` and
   * caches what it returns. Concurrent misses on the same key wait on one call.
   */
  const get = (key, producer) => {
    const entry = entries.get(key);
    const now = Date.now();

    if (entry && now <= entry.expiresAt) {
      return Promise.resolve(entry.value);
    }

    const pending = inFlight.get(key);
    if (pending) {
      return pending;
    }

    const promise = Promise.resolve()
      .then(producer)
      .then(value => {
        entries.set(key, { value, expiresAt: Date.now() + ttlMs });
        prune();
        return value;
      })
      .catch(err => {
        // Upstream rate limits are the expected failure here. Serving the last
        // good value beats showing an empty page while the limiter cools down.
        if (entry) {
          console.warn(`⚠️ Cache refresh failed for "${key}", serving stale value:`, err.message);
          return entry.value;
        }
        throw err;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    inFlight.set(key, promise);
    return promise;
  };

  const clear = () => {
    entries.clear();
    inFlight.clear();
  };

  return { get, clear };
};

module.exports = { createCache };
