/**
 * Portfolio photos of a specialist.
 *
 * The specialist's own list is `publicData.portfolio`, which they can edit. The
 * photos a moderator approved are recorded in `metadata.approvedPortfolio`,
 * which only the operator can write. A photo is public only while it is in
 * both lists, and it is shown from the address the moderator approved.
 *
 * The server applies the same rule in server/api-util/portfolio.js.
 */

// Sharetribe keeps an uploaded image under a fixed, signed address; an image
// anywhere else could change after the moderator has seen it.
const IMAGE_URL_PREFIX = 'https://sharetribe.imgix.net/';

// Photos added by hand in Console may have no image id.
const photoIdOf = item => String(item.imageId || item.imageUrl);

const asPhotos = value =>
  (Array.isArray(value) ? value : []).filter(
    item =>
      !!item &&
      typeof item === 'object' &&
      typeof item.imageUrl === 'string' &&
      item.imageUrl.startsWith(IMAGE_URL_PREFIX)
  );

const approvedById = profile =>
  new Map(
    asPhotos(profile?.metadata?.approvedPortfolio).map(record => [photoIdOf(record), record])
  );

/** Approved photos in the specialist's order, each once. */
export const approvedPortfolioPhotos = profile => {
  const approved = approvedById(profile);
  const seen = new Set();
  return asPhotos(profile?.publicData?.portfolio).reduce((photos, item) => {
    const id = photoIdOf(item);
    const record = approved.get(id);
    if (record && !seen.has(id)) {
      seen.add(id);
      photos.push(record);
    }
    return photos;
  }, []);
};

export const isApprovedPortfolioPhoto = (profile, item) =>
  !!item && approvedById(profile).has(photoIdOf(item));
