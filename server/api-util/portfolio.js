/**
 * Portfolio photos of a specialist.
 *
 * The specialist's own list is `publicData.portfolio`, which they can edit
 * through the Marketplace API. The photos a moderator approved are recorded in
 * `metadata.approvedPortfolio`, which only the operator can write. A photo is
 * public only while it is in both lists, and it is shown from the address the
 * moderator approved, so editing public data cannot publish an unmoderated
 * image.
 */

// Sharetribe keeps an uploaded image under a fixed, signed address; an image
// anywhere else could change after the moderator has seen it.
const IMAGE_URL_PREFIX = 'https://sharetribe.imgix.net/';

const isSharetribeImageUrl = url => typeof url === 'string' && url.startsWith(IMAGE_URL_PREFIX);

// Photos added by hand in Console may have no image id.
const photoIdOf = item => String(item.imageId || item.imageUrl);

const asPhotos = value =>
  (Array.isArray(value) ? value : []).filter(
    item => !!item && typeof item === 'object' && isSharetribeImageUrl(item.imageUrl)
  );

const uniqueById = photos => {
  const seen = new Set();
  return photos.filter(photo => {
    const id = photoIdOf(photo);
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
};

const submittedPhotos = profile => asPhotos(profile?.publicData?.portfolio);

const approvedRecords = profile => asPhotos(profile?.metadata?.approvedPortfolio);

/** Approved photos in the specialist's order, each once. */
const approvedPhotos = profile => {
  const approved = new Map(approvedRecords(profile).map(record => [photoIdOf(record), record]));
  return uniqueById(
    submittedPhotos(profile)
      .map(item => approved.get(photoIdOf(item)))
      .filter(Boolean)
  );
};

/** Photos the specialist added that no moderator has approved yet, each once. */
const pendingPhotos = profile => {
  const approvedIds = new Set(approvedRecords(profile).map(photoIdOf));
  return uniqueById(submittedPhotos(profile).filter(item => !approvedIds.has(photoIdOf(item))));
};

/** What is kept in `metadata.approvedPortfolio` for an approved photo. */
const approvalRecordOf = item => ({
  ...(item.imageId ? { imageId: item.imageId } : {}),
  imageUrl: item.imageUrl,
});

module.exports = {
  approvalRecordOf,
  approvedPhotos,
  approvedRecords,
  isSharetribeImageUrl,
  pendingPhotos,
  photoIdOf,
  submittedPhotos,
};
