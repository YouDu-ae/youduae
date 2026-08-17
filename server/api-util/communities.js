/**
 * Maps a listing's coordinates onto a named Dubai community.
 *
 * People think in communities ("Marina", "JVC"), while Google Places gives back
 * a building and a pair of coordinates. This table is the bridge.
 *
 * Deliberately centre + radius rather than real polygons: the district stats
 * built on top only surface once a cell holds three completed orders from three
 * different specialists, so a point landing in Marina instead of JBR cannot
 * meaningfully distort what a client sees. Real boundaries would cost a
 * geo dependency and a lot of upkeep for accuracy nobody would notice.
 *
 * Ordering does not matter — the nearest matching centre wins, which is what
 * keeps neighbours like Marina/JBR/JLT from depending on table order.
 *
 * Kept server-side on purpose: `CATEGORY_LABELS` in notifyListingPublished.js
 * follows the same convention, and shipping the table to the browser would add
 * weight for something only the aggregator needs.
 */

// Generous bounding box for the emirate. A point outside it is not a Dubai
// address at all (Abu Dhabi, Sharjah, or a mis-picked place) and is dropped
// rather than filed under a district it has nothing to do with.
const DUBAI_BOUNDS = { minLat: 24.75, maxLat: 25.4, minLng: 54.85, maxLng: 55.6 };

// Everything inside Dubai that no community claimed. Kept separate from the
// per-district cells so city-wide numbers stay complete.
const DUBAI_FALLBACK = { id: 'dubai_other', label: 'Дубай' };

/**
 * Radii are eyeballed to cover the built-up part of each community: ~2 km for
 * tower clusters, ~3 km for villa communities that sprawl.
 */
const COMMUNITIES = [
  { id: 'dubai_marina', label: 'Dubai Marina', lat: 25.0805, lng: 55.1403, radiusKm: 1.8 },
  { id: 'jbr', label: 'JBR', lat: 25.0757, lng: 55.1330, radiusKm: 1.2 },
  { id: 'jlt', label: 'JLT', lat: 25.0693, lng: 55.1414, radiusKm: 1.5 },
  { id: 'palm_jumeirah', label: 'Palm Jumeirah', lat: 25.1124, lng: 55.1390, radiusKm: 3.5 },
  { id: 'downtown', label: 'Downtown Dubai', lat: 25.1972, lng: 55.2744, radiusKm: 1.8 },
  { id: 'business_bay', label: 'Business Bay', lat: 25.1857, lng: 55.2660, radiusKm: 1.8 },
  { id: 'difc', label: 'DIFC', lat: 25.2110, lng: 55.2796, radiusKm: 1.2 },
  { id: 'creek_harbour', label: 'Dubai Creek Harbour', lat: 25.2000, lng: 55.3450, radiusKm: 2.5 },
  { id: 'jvc', label: 'JVC', lat: 25.0570, lng: 55.2100, radiusKm: 2.2 },
  { id: 'jvt', label: 'JVT', lat: 25.0470, lng: 55.1930, radiusKm: 1.8 },
  { id: 'al_barsha', label: 'Al Barsha', lat: 25.1100, lng: 55.2000, radiusKm: 2.5 },
  { id: 'dubai_hills', label: 'Dubai Hills Estate', lat: 25.1000, lng: 55.2500, radiusKm: 3.0 },
  { id: 'emirates_living', label: 'Emirates Living', lat: 25.0600, lng: 55.1800, radiusKm: 2.5 },
  { id: 'sports_city', label: 'Dubai Sports City', lat: 25.0400, lng: 55.2200, radiusKm: 2.2 },
  { id: 'motor_city', label: 'Motor City', lat: 25.0500, lng: 55.2400, radiusKm: 2.0 },
  { id: 'arabian_ranches', label: 'Arabian Ranches', lat: 25.0300, lng: 55.2700, radiusKm: 3.0 },
  { id: 'discovery_gardens', label: 'Discovery Gardens', lat: 25.0400, lng: 55.1400, radiusKm: 1.8 },
  { id: 'dubai_investment_park', label: 'Dubai Investment Park', lat: 24.9800, lng: 55.1700, radiusKm: 4.0 },
  { id: 'jumeirah', label: 'Jumeirah', lat: 25.2050, lng: 55.2450, radiusKm: 2.5 },
  { id: 'bur_dubai', label: 'Bur Dubai', lat: 25.2600, lng: 55.2960, radiusKm: 2.5 },
  { id: 'deira', label: 'Deira', lat: 25.2700, lng: 55.3200, radiusKm: 3.0 },
  { id: 'al_nahda', label: 'Al Nahda', lat: 25.2900, lng: 55.3700, radiusKm: 2.2 },
  { id: 'mirdif', label: 'Mirdif', lat: 25.2200, lng: 55.4200, radiusKm: 3.0 },
  { id: 'silicon_oasis', label: 'Dubai Silicon Oasis', lat: 25.1200, lng: 55.3800, radiusKm: 2.5 },
  { id: 'international_city', label: 'International City', lat: 25.1650, lng: 55.4100, radiusKm: 2.5 },
];

const EARTH_RADIUS_KM = 6371;
const toRadians = degrees => (degrees * Math.PI) / 180;

const distanceKm = (aLat, aLng, bLat, bLng) => {
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(aLat)) * Math.cos(toRadians(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

const isInDubai = (lat, lng) =>
  lat >= DUBAI_BOUNDS.minLat &&
  lat <= DUBAI_BOUNDS.maxLat &&
  lng >= DUBAI_BOUNDS.minLng &&
  lng <= DUBAI_BOUNDS.maxLng;

/**
 * @param {number|string} lat
 * @param {number|string} lng
 * @returns {{id: string, label: string}|null} `null` when the point is missing,
 *   unparseable, or outside Dubai.
 */
const resolveCommunity = (lat, lng) => {
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  if (!isInDubai(latitude, longitude)) {
    return null;
  }

  let best = null;
  let bestDistance = Infinity;

  COMMUNITIES.forEach(community => {
    const distance = distanceKm(latitude, longitude, community.lat, community.lng);
    if (distance <= community.radiusKm && distance < bestDistance) {
      best = community;
      bestDistance = distance;
    }
  });

  return best ? { id: best.id, label: best.label } : { ...DUBAI_FALLBACK };
};

/** Reads coordinates off a Sharetribe listing resource. */
const resolveCommunityForListing = listing => {
  const geolocation = listing?.attributes?.geolocation;
  return geolocation ? resolveCommunity(geolocation.lat, geolocation.lng) : null;
};

const communityLabel = id => COMMUNITIES.find(c => c.id === id)?.label || DUBAI_FALLBACK.label;

module.exports = {
  COMMUNITIES,
  DUBAI_FALLBACK,
  communityLabel,
  resolveCommunity,
  resolveCommunityForListing,
};
