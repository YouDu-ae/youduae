/**
 * Хранилище черновика задания.
 *
 * Текстовые поля лежат в localStorage, а фотографии — в IndexedDB. Раньше в
 * localStorage складывалось всё сразу, и черновик с парой снимков не помещался
 * в лимит (10 МБ в Chrome, меньше в Safari). Запись падала, ошибка гасилась, и
 * задание публиковалось без фотографий — при этом пользователю ничего не
 * сообщалось. У IndexedDB такого потолка нет.
 */

const GUEST_LISTING_KEY = 'guestListingData';

const DB_NAME = 'youdu-guest-listing';
const DB_VERSION = 1;
const STORE = 'drafts';
const IMAGES_KEY = 'images';

const openDb = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB заблокирована другой вкладкой'));
  });

const withStore = async (mode, run) => {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const result = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(result && result.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
};

const readImages = () => withStore('readonly', store => store.get(IMAGES_KEY));
const writeImages = images => withStore('readwrite', store => store.put(images, IMAGES_KEY));
const deleteImages = () => withStore('readwrite', store => store.delete(IMAGES_KEY));

/**
 * Сохраняет черновик. Бросает исключение, если сохранить не удалось —
 * молчаливый провал здесь уже однажды стоил пользователю фотографий.
 * @param {Object} data - Listing data
 */
export const saveGuestListingData = async (data) => {
  const { images = [], ...fields } = data || {};

  await writeImages(images);
  localStorage.setItem(
    GUEST_LISTING_KEY,
    JSON.stringify({ ...fields, timestamp: new Date().toISOString() })
  );
};

/**
 * @returns {Promise<Object|null>} - Listing data or null if not found
 */
export const getGuestListingData = async () => {
  const stored = localStorage.getItem(GUEST_LISTING_KEY);
  if (!stored) {
    return null;
  }

  const fields = JSON.parse(stored);

  // Фотографии не критичны для чтения черновика: если хранилище недоступно,
  // лучше вернуть текстовую часть, чем потерять весь черновик.
  let images = [];
  try {
    images = (await readImages()) || [];
  } catch (error) {
    console.error('Не удалось прочитать фотографии черновика:', error);
  }

  return { ...fields, images };
};

export const clearGuestListingData = async () => {
  localStorage.removeItem(GUEST_LISTING_KEY);
  try {
    await deleteImages();
  } catch (error) {
    console.error('Не удалось очистить фотографии черновика:', error);
  }
};


/**
 * Convert File to base64 string for storage
 * @param {File} file - File object
 * @returns {Promise<string>} - base64 string
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

// Phone cameras produce 3-8 MB files, which base64 inflates by a third. Sending
// those untouched fills browser storage and the server's request buffer, so
// downscale before anything else touches the image.
const MAX_IMAGE_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;

/**
 * Decodes a file into something drawable, honouring EXIF orientation so photos
 * taken sideways are not rotated. `createImageBitmap` handles orientation
 * natively; the `<img>` path is a fallback for browsers without it.
 */
const decodeImage = async (file) => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (e) {
      // Older Safari rejects the options argument — fall through to <img>.
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Не удалось прочитать изображение'));
    };
    img.src = objectUrl;
  });
};

/**
 * Downscale an image and re-encode it as JPEG.
 * @param {File} file - File object
 * @returns {Promise<string>} - compressed base64 data URL
 */
export const compressImage = async (file) => {
  // Vector and non-image files cannot be redrawn meaningfully.
  if (!file.type || !file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return fileToBase64(file);
  }

  try {
    const source = await decodeImage(file);
    const width = source.width;
    const height = source.height;
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    if (typeof source.close === 'function') {
      source.close();
    }

    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } catch (error) {
    console.error('❌ Image compression failed, using original:', error);
    return fileToBase64(file);
  }
};

/**
 * Save images as base64 strings
 * @param {File[]} files - Array of File objects
 * @returns {Promise<Array>} - Array of base64 strings with metadata
 */
export const saveImagesToStorage = async (files) => {
  return Promise.all(
    files.map(async (file) => {
      const base64 = await compressImage(file);
      // Compression re-encodes to JPEG, but the fallback path keeps the
      // original format, so read the type back from the data URL.
      const mimeMatch = base64.match(/^data:([^;]+);/);
      const type = mimeMatch ? mimeMatch[1] : file.type;
      const name =
        type === 'image/jpeg' ? file.name.replace(/\.[^.]+$/, '') + '.jpg' : file.name;

      return {
        name,
        type,
        // Approximate byte size of the stored payload, not of the original file.
        size: Math.round((base64.length - base64.indexOf(',') - 1) * 0.75),
        base64,
      };
    })
  );
};

