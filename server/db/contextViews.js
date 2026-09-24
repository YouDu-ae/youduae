/**
 * Context views over the marketplace archive.
 *
 * Plain SQL views: nothing is stored twice, and every number is recomputed
 * from marketplace_events and marketplace_snapshots when read. They hold only
 * facts confirmed by what happened on the platform — offers, accepted offers,
 * completed tasks and reviews — never message text or contact details, so
 * they are the layer analytics and future agent tools read instead of the raw
 * archive.
 *
 * Views are dropped and recreated on every start, so a column change here
 * needs no migration.
 */

const { COMMUNITIES, DUBAI_FALLBACK } = require('../api-util/communities');

// Must match DUBAI_BOUNDS in api-util/communities.js.
const DUBAI_BOUNDS = { minLat: 24.75, maxLat: 25.4, minLng: 54.85, maxLng: 55.6 };

const numeric = expr => `CASE WHEN (${expr}) ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${expr})::numeric END`;

const transitionAt = (resource, name) => `(
  SELECT MIN((t->>'createdAt')::timestamptz)
  FROM jsonb_array_elements(COALESCE(${resource}->'attributes'->'transitions', '[]'::jsonb)) t
  WHERE t->>'transition' = '${name}'
)`;

const VIEWS_SQL = `
  DROP VIEW IF EXISTS ctx_price_stats, ctx_specialist_stats, ctx_listing_outcomes,
    ctx_reviews, ctx_transactions, ctx_listings, ctx_latest_resources,
    ctx_specialist_profiles CASCADE;

  -- What each specialist says about themselves, from the public profile only
  -- (user events also carry e-mail and phone, which this view leaves out).
  CREATE VIEW ctx_specialist_profiles AS
  SELECT DISTINCT ON (resource_id)
    resource_id AS specialist_id,
    profile->>'displayName' AS display_name,
    pd->'serviceCategories' AS service_categories,
    pd->'serviceAreas' AS service_areas,
    pd->'languages' AS languages,
    ${numeric("pd->>'priceFrom'")} AS price_from,
    pd->'availability' AS availability,
    created_at AS updated_at
  FROM marketplace_events
  CROSS JOIN LATERAL (SELECT payload->'resource'->'attributes'->'profile' AS profile) p
  CROSS JOIN LATERAL (SELECT profile->'publicData' AS pd) d
  WHERE resource_type = 'user'
    AND jsonb_typeof(payload->'resource') = 'object'
    AND pd->>'userType' = 'customer'
  ORDER BY resource_id, sequence_id DESC;

  -- Latest known state of every listing, transaction and review: the newest
  -- event that carried the resource, or the newest snapshot for resources
  -- older than the event archive.
  CREATE VIEW ctx_latest_resources AS
  WITH last_event AS (
    SELECT DISTINCT ON (resource_type, resource_id)
      resource_type, resource_id, event_type
    FROM marketplace_events
    WHERE resource_type IN ('listing', 'transaction', 'review')
    ORDER BY resource_type, resource_id, sequence_id DESC
  ), last_state AS (
    SELECT DISTINCT ON (resource_type, resource_id)
      resource_type, resource_id, payload->'resource' AS resource, created_at AS seen_at
    FROM marketplace_events
    WHERE resource_type IN ('listing', 'transaction', 'review')
      AND jsonb_typeof(payload->'resource') = 'object'
    ORDER BY resource_type, resource_id, sequence_id DESC
  ), last_snapshot AS (
    SELECT DISTINCT ON (resource_type, resource_id)
      resource_type, resource_id, payload AS resource, taken_at AS seen_at
    FROM marketplace_snapshots
    ORDER BY resource_type, resource_id, taken_at DESC
  )
  SELECT s.resource_type, s.resource_id, s.resource, s.seen_at,
    COALESCE(e.event_type LIKE '%/deleted', false) AS deleted
  FROM last_state s
  LEFT JOIN last_event e USING (resource_type, resource_id)
  UNION ALL
  SELECT n.resource_type, n.resource_id, n.resource, n.seen_at, false
  FROM last_snapshot n
  WHERE NOT EXISTS (
    SELECT 1 FROM last_state s
    WHERE s.resource_type = n.resource_type AND s.resource_id = n.resource_id
  );

  CREATE VIEW ctx_listings AS
  SELECT
    r.resource_id AS listing_id,
    r.resource->'relationships'->'author'->'data'->>'id' AS client_id,
    a->>'title' AS title,
    pd->>'publicId' AS public_id,
    -- Tasks from older iOS app builds only carry publicData.category.
    COALESCE(pd->>'categoryLevel1', pd->>'category') AS category,
    pd->>'categoryLevel2' AS subcategory,
    ${numeric("a->'price'->>'amount'")} / 100 AS budget,
    a->'price'->>'currency' AS currency,
    pd->>'deadline' AS deadline,
    pd->>'paymentMethod' AS payment_method,
    COALESCE(pd->>'communityId', community.id,
      CASE WHEN lat BETWEEN ${DUBAI_BOUNDS.minLat} AND ${DUBAI_BOUNDS.maxLat}
            AND lng BETWEEN ${DUBAI_BOUNDS.minLng} AND ${DUBAI_BOUNDS.maxLng}
           THEN '${DUBAI_FALLBACK.id}' END) AS community_id,
    a->>'state' AS state,
    (a->>'createdAt')::timestamptz AS created_at,
    r.deleted
  FROM ctx_latest_resources r
  CROSS JOIN LATERAL (SELECT r.resource->'attributes' AS a) attrs
  CROSS JOIN LATERAL (SELECT a->'publicData' AS pd) public_data
  CROSS JOIN LATERAL (
    SELECT ${numeric("a->'geolocation'->>'lat'")}::float AS lat,
           ${numeric("a->'geolocation'->>'lng'")}::float AS lng
  ) point
  LEFT JOIN LATERAL (
    SELECT c.id FROM ctx_communities c
    WHERE 2 * 6371 * asin(sqrt(
            power(sin(radians(c.lat - point.lat) / 2), 2)
            + cos(radians(point.lat)) * cos(radians(c.lat))
              * power(sin(radians(c.lng - point.lng) / 2), 2))) <= c.radius_km
    ORDER BY power(c.lat - point.lat, 2) + power(c.lng - point.lng, 2)
    LIMIT 1
  ) community ON true
  WHERE r.resource_type = 'listing';

  -- In YouDu the task author is Sharetribe's provider and the specialist who
  -- responds is its customer.
  CREATE VIEW ctx_transactions AS
  SELECT
    r.resource_id AS transaction_id,
    r.resource->'relationships'->'listing'->'data'->>'id' AS listing_id,
    r.resource->'relationships'->'customer'->'data'->>'id' AS specialist_id,
    r.resource->'relationships'->'provider'->'data'->>'id' AS client_id,
    ${numeric("r.resource->'attributes'->'protectedData'->'offer'->>'price'")} AS offer_price,
    r.resource->'attributes'->'protectedData'->'offer'->>'currency' AS currency,
    (r.resource->'attributes'->>'createdAt')::timestamptz AS offered_at,
    ${transitionAt('r.resource', 'transition/accept-offer')} AS accepted_at,
    ${transitionAt('r.resource', 'transition/complete')} AS completed_at,
    r.resource->'attributes'->>'lastTransition' AS last_transition,
    r.resource->'attributes'->>'processName' AS process_name
  FROM ctx_latest_resources r
  WHERE r.resource_type = 'transaction';

  -- Review events carry author and subject; reviews known only from a
  -- transaction snapshot take them from the transaction's parties.
  CREATE VIEW ctx_reviews AS
  WITH from_events AS (
    SELECT
      r.resource_id AS review_id,
      r.resource->'attributes'->>'type' AS review_type,
      ${numeric("r.resource->'attributes'->>'rating'")} AS rating,
      r.resource->'attributes'->>'state' AS state,
      r.resource->'relationships'->'subject'->'data'->>'id' AS subject_id,
      r.resource->'relationships'->'author'->'data'->>'id' AS author_id,
      r.resource->'relationships'->'transaction'->'data'->>'id' AS transaction_id,
      (r.resource->'attributes'->>'createdAt')::timestamptz AS created_at
    FROM ctx_latest_resources r
    WHERE r.resource_type = 'review' AND NOT r.deleted
  ), from_snapshots AS (
    SELECT DISTINCT ON (review->>'id')
      review->>'id' AS review_id,
      review->'attributes'->>'type' AS review_type,
      ${numeric("review->'attributes'->>'rating'")} AS rating,
      review->'attributes'->>'state' AS state,
      CASE review->'attributes'->>'type'
        WHEN 'ofCustomer' THEN s.payload->'relationships'->'customer'->'data'->>'id'
        ELSE s.payload->'relationships'->'provider'->'data'->>'id' END AS subject_id,
      CASE review->'attributes'->>'type'
        WHEN 'ofCustomer' THEN s.payload->'relationships'->'provider'->'data'->>'id'
        ELSE s.payload->'relationships'->'customer'->'data'->>'id' END AS author_id,
      s.resource_id AS transaction_id,
      (review->'attributes'->>'createdAt')::timestamptz AS created_at
    FROM marketplace_snapshots s
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.payload->'included'->'reviews', '[]'::jsonb)) review
    WHERE s.resource_type = 'transaction'
    ORDER BY review->>'id', s.taken_at DESC
  )
  SELECT * FROM from_events
  UNION ALL
  SELECT * FROM from_snapshots f
  WHERE NOT EXISTS (SELECT 1 FROM from_events e WHERE e.review_id = f.review_id);

  CREATE VIEW ctx_listing_outcomes AS
  SELECT
    l.*,
    COUNT(t.transaction_id) AS offers,
    MIN(t.offered_at) AS first_offer_at,
    MAX(t.offer_price) FILTER (WHERE t.accepted_at IS NOT NULL) AS accepted_price,
    MAX(t.specialist_id) FILTER (WHERE t.accepted_at IS NOT NULL) AS hired_specialist_id,
    BOOL_OR(t.completed_at IS NOT NULL) AS completed
  FROM ctx_listings l
  LEFT JOIN ctx_transactions t ON t.listing_id = l.listing_id
  GROUP BY ${[
    'listing_id', 'client_id', 'title', 'public_id', 'category', 'subcategory', 'budget',
    'currency', 'deadline', 'payment_method', 'community_id', 'state', 'created_at', 'deleted',
  ].map(c => `l.${c}`).join(', ')};

  -- A specialist's track record as the platform saw it.
  CREATE VIEW ctx_specialist_stats AS
  SELECT
    t.specialist_id,
    COUNT(*) AS offers_sent,
    COUNT(*) FILTER (WHERE t.accepted_at IS NOT NULL) AS offers_accepted,
    COUNT(*) FILTER (WHERE t.completed_at IS NOT NULL) AS tasks_completed,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY t.offer_price) AS median_offer_price,
    percentile_cont(0.5) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (t.offered_at - l.created_at)) / 60
    ) FILTER (WHERE t.offered_at >= l.created_at) AS median_response_minutes,
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT l.category) FILTER (WHERE t.completed_at IS NOT NULL), NULL)
      AS completed_categories,
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT l.community_id) FILTER (WHERE t.completed_at IS NOT NULL), NULL)
      AS completed_communities,
    MIN(t.offered_at) AS first_offer_at,
    MAX(t.offered_at) AS last_offer_at,
    COALESCE(MAX(rv.reviews), 0) AS reviews,
    MAX(rv.average_rating) AS average_rating
  FROM ctx_transactions t
  LEFT JOIN ctx_listings l ON l.listing_id = t.listing_id
  LEFT JOIN (
    SELECT subject_id, COUNT(*) AS reviews, ROUND(AVG(rating), 2) AS average_rating
    FROM ctx_reviews WHERE review_type = 'ofCustomer'
    GROUP BY subject_id
  ) rv ON rv.subject_id = t.specialist_id
  WHERE t.specialist_id IS NOT NULL
  GROUP BY t.specialist_id;

  -- What tasks cost, by category, subcategory and community. level says which
  -- grouping a row belongs to, since a missing subcategory or community is
  -- also NULL.
  CREATE VIEW ctx_price_stats AS
  SELECT
    CASE
      WHEN GROUPING(subcategory) = 0 THEN 'subcategory'
      WHEN GROUPING(community_id) = 0 THEN 'community'
      ELSE 'category'
    END AS level,
    category, subcategory, community_id,
    COUNT(*) AS listings,
    COUNT(*) FILTER (WHERE offers > 0) AS listings_with_offers,
    COUNT(*) FILTER (WHERE accepted_price IS NOT NULL) AS hired,
    COUNT(*) FILTER (WHERE completed) AS completed,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY budget) AS median_budget,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY accepted_price) AS median_accepted_price,
    MIN(accepted_price) AS min_accepted_price,
    MAX(accepted_price) AS max_accepted_price,
    SUM(accepted_price) FILTER (WHERE completed) AS completed_turnover,
    percentile_cont(0.5) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (first_offer_at - created_at)) / 60
    ) FILTER (WHERE first_offer_at >= created_at) AS median_minutes_to_first_offer
  FROM ctx_listing_outcomes
  WHERE NOT deleted AND category IS NOT NULL
  GROUP BY GROUPING SETS ((category), (category, subcategory), (category, community_id));
`;

/** Mirrors the community table so SQL can place listings the way the server does. */
const syncCommunities = async client => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ctx_communities (
      id VARCHAR(50) PRIMARY KEY,
      label VARCHAR(100) NOT NULL,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      radius_km DOUBLE PRECISION NOT NULL
    )
  `);
  await client.query('DELETE FROM ctx_communities');
  for (const c of COMMUNITIES) {
    await client.query(
      'INSERT INTO ctx_communities (id, label, lat, lng, radius_km) VALUES ($1, $2, $3, $4, $5)',
      [c.id, c.label, c.lat, c.lng, c.radiusKm]
    );
  }
};

const createContextViews = async client => {
  await client.query('BEGIN');
  try {
    await syncCommunities(client);
    await client.query(VIEWS_SQL);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
};

module.exports = { createContextViews, VIEWS_SQL };
