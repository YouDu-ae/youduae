/**
 * Язык интерфейса. Переключатель RU/EN пишет его в localStorage и перезагружает
 * страницу, поэтому значение не меняется за время жизни страницы.
 * На сервере localStorage нет — там всегда русский, как и по умолчанию.
 */
export const DEFAULT_LANGUAGE = 'ru';
export const SUPPORTED_LANGUAGES = ['ru', 'en'];

export const getPreferredLanguage = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }
  try {
    const stored = window.localStorage.getItem('preferredLanguage');
    return SUPPORTED_LANGUAGES.includes(stored) ? stored : DEFAULT_LANGUAGE;
  } catch (e) {
    return DEFAULT_LANGUAGE;
  }
};

/**
 * Выбирает текст для текущего языка из объекта вида { ru: '...', en: '...' }.
 * Для модулей вне React, где нет intl: конфиги, утилиты, ducks.
 */
export const localized = texts => {
  if (texts == null || typeof texts !== 'object') {
    return texts;
  }
  const lang = getPreferredLanguage();
  return texts[lang] ?? texts[DEFAULT_LANGUAGE] ?? texts.en;
};
