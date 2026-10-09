const KILO = 1000;

export const calculateFileSize = (size, locale) => {
  const kbSize = Math.ceil(size / KILO);
  const mbSize = kbSize / KILO;
  const useMb = mbSize >= 1;

  return useMb
    ? new Intl.NumberFormat(locale, {
        style: 'unit',
        unit: 'megabyte',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(mbSize)
    : new Intl.NumberFormat(locale, {
        style: 'unit',
        unit: 'kilobyte',
        maximumFractionDigits: 0,
      }).format(kbSize);
};

const messageHasFilesInState = (message, state) =>
  !!message?.publicFileAttachments?.some(f => f.file?.attributes?.state === state);

// Sharetribe scans attached files for viruses before they can be downloaded
export const messageHasPendingFiles = message =>
  messageHasFilesInState(message, 'pendingVerification');
export const messageHasFailedFiles = message =>
  messageHasFilesInState(message, 'verificationFailed');

export const analyseFileName = name => {
  const lastDot = name ? name.lastIndexOf('.') : -1;
  const baseName = lastDot > 0 ? name.slice(0, lastDot) : name;
  const extension = lastDot > 0 ? name.slice(lastDot) : '';
  return { baseName, extension };
};
