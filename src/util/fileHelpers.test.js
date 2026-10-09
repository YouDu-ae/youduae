import {
  analyseFileName,
  calculateFileSize,
  messageHasFailedFiles,
  messageHasPendingFiles,
} from './fileHelpers';

const messageWithFiles = (...states) => ({
  publicFileAttachments: states.map(state => ({ file: { attributes: { state } } })),
});
const normalizeSpaces = text => text.replace(/\s/g, ' ');

describe('fileHelpers', () => {
  it('formats file sizes in kilobytes, and in megabytes from a megabyte up', () => {
    expect(normalizeSpaces(calculateFileSize(250000, 'en'))).toBe('250 kB');
    expect(normalizeSpaces(calculateFileSize(1500000, 'en'))).toBe('1.5 MB');
    expect(normalizeSpaces(calculateFileSize(1500000, 'ru'))).toBe('1,5 МБ');
  });

  it('splits the extension off the file name', () => {
    expect(analyseFileName('photo.final.jpg')).toEqual({
      baseName: 'photo.final',
      extension: '.jpg',
    });
    expect(analyseFileName('README')).toEqual({ baseName: 'README', extension: '' });
    expect(analyseFileName('.env')).toEqual({ baseName: '.env', extension: '' });
  });

  it('tells whether message files are being scanned or failed the scan', () => {
    expect(messageHasPendingFiles(messageWithFiles('available', 'pendingVerification'))).toBe(true);
    expect(messageHasPendingFiles(messageWithFiles('available'))).toBe(false);
    expect(messageHasFailedFiles(messageWithFiles('available', 'verificationFailed'))).toBe(true);
    expect(messageHasFailedFiles(messageWithFiles('pendingVerification'))).toBe(false);
  });

  it('handles messages without files', () => {
    expect(messageHasPendingFiles({ attributes: { content: 'Hi' } })).toBe(false);
    expect(messageHasFailedFiles({ publicFileAttachments: [{ file: null }] })).toBe(false);
    expect(messageHasPendingFiles(undefined)).toBe(false);
  });
});
