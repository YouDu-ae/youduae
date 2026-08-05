/**
 * Helpers for storing and retrieving guest listing data in localStorage
 */

const GUEST_LISTING_KEY = 'guestListingData';

/**
 * Save guest listing data to localStorage
 * @param {Object} data - Listing data
 */
export const saveGuestListingData = (data) => {
  try {
    const dataToStore = {
      ...data,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(GUEST_LISTING_KEY, JSON.stringify(dataToStore));
    console.log('✅ Guest listing data saved:', dataToStore);
    return true;
  } catch (error) {
    console.error('❌ Error saving guest listing data:', error);
    return false;
  }
};

/**
 * Get guest listing data from localStorage
 * @returns {Object|null} - Listing data or null if not found
 */
export const getGuestListingData = () => {
  try {
    const data = localStorage.getItem(GUEST_LISTING_KEY);
    if (!data) return null;
    
    const parsed = JSON.parse(data);
    console.log('✅ Guest listing data retrieved:', parsed);
    return parsed;
  } catch (error) {
    console.error('❌ Error retrieving guest listing data:', error);
    return null;
  }
};

/**
 * Clear guest listing data from localStorage
 */
export const clearGuestListingData = () => {
  try {
    localStorage.removeItem(GUEST_LISTING_KEY);
    console.log('✅ Guest listing data cleared');
    return true;
  } catch (error) {
    console.error('❌ Error clearing guest listing data:', error);
    return false;
  }
};

/**
 * Check if there is guest listing data in localStorage
 * @returns {boolean}
 */
export const hasGuestListingData = () => {
  return !!localStorage.getItem(GUEST_LISTING_KEY);
};

/**
 * Update specific field in guest listing data
 * @param {string} field - Field name
 * @param {*} value - Field value
 */
export const updateGuestListingField = (field, value) => {
  const currentData = getGuestListingData() || {};
  const updatedData = {
    ...currentData,
    [field]: value,
  };
  return saveGuestListingData(updatedData);
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
 * Convert base64 string back to File object
 * @param {string} base64 - base64 string
 * @param {string} filename - File name
 * @returns {File} - File object
 */
export const base64ToFile = (base64, filename) => {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new File([u8arr], filename, { type: mime });
};

/**
 * Save images as base64 strings
 * @param {File[]} files - Array of File objects
 * @returns {Promise<Array>} - Array of base64 strings with metadata
 */
export const saveImagesToStorage = async (files) => {
  try {
    const imagesData = await Promise.all(
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
          preview: base64, // Use base64 as preview URL
        };
      })
    );
    return imagesData;
  } catch (error) {
    console.error('❌ Error saving images:', error);
    return [];
  }
};

/**
 * Restore images from storage
 * @param {Array} imagesData - Array of image data with base64
 * @returns {File[]} - Array of File objects
 */
export const restoreImagesFromStorage = (imagesData) => {
  try {
    if (!imagesData || !Array.isArray(imagesData)) return [];
    
    return imagesData.map((imageData) => {
      return base64ToFile(imageData.base64, imageData.name);
    });
  } catch (error) {
    console.error('❌ Error restoring images:', error);
    return [];
  }
};

