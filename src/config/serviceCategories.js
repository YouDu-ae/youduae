/**
 * Service Categories Configuration
 * 
 * Список всех категорий услуг, которые могут предоставлять исполнители (Customer).
 * Используется в:
 * - Форме регистрации (выбор категорий)
 * - Профиле исполнителя (отображение категорий)
 * - Странице списка исполнителей по категории
 */

export const SERVICE_CATEGORIES = [
  {
    id: 'construction',
    label: {
      ru: 'Строительство и ремонт',
      en: 'Construction and Repair',
    },
    icon: 'drill',
  },
  {
    id: 'beauty',
    label: {
      ru: 'Красота и здоровье',
      en: 'Beauty and Health',
    },
    icon: 'scissors',
  },
  {
    id: 'tutoring',
    label: {
      ru: 'Репетиторы и обучение',
      en: 'Tutoring and Education',
    },
    icon: 'school',
  },
  {
    id: 'cleaning',
    label: {
      ru: 'Уборка и помощь в доме',
      en: 'Cleaning and Home Help',
    },
    icon: 'housekeeper',
  },
  {
    id: 'legal',
    label: {
      ru: 'Юридическая и бухгалтерская помощь',
      en: 'Legal and Accounting Services',
    },
    icon: 'weight',
  },
  {
    id: 'appliances',
    label: {
      ru: 'Установка бытовой техники',
      en: 'Appliance Installation',
    },
    icon: 'kitchen',
  },
  {
    id: 'media',
    label: {
      ru: 'Фото, видео, аудио',
      en: 'Photo, Video, Audio',
    },
    icon: 'camera',
  },
  {
    id: 'courier',
    label: {
      ru: 'Курьерские услуги',
      en: 'Courier Services',
    },
    icon: 'courier',
  },
  {
    id: 'moving',
    label: {
      ru: 'Грузоперевозки',
      en: 'Moving and Transportation',
    },
    icon: 'truck',
  },
  {
    id: 'tech-repair',
    label: {
      ru: 'Ремонт цифровой техники',
      en: 'Digital Tech Repair',
    },
    icon: 'search',
  },
  {
    id: 'auto',
    label: {
      ru: 'Автомобильные услуги',
      en: 'Automotive Services',
    },
    icon: 'car',
  },
  {
    id: 'Interior_designer',
    label: {
      ru: 'Дизайнер интерьеров',
      en: 'Interior Designer',
    },
    icon: 'interior',
  },
  {
    id: 'Tourist_services',
    label: {
      ru: 'Туристические услуги',
      en: 'Tourist Services',
    },
    icon: 'tourist',
  },
  {
    id: 'Web_design',
    label: {
      ru: 'Веб Дизайн/SEO',
      en: 'Web Design/SEO',
    },
    icon: 'web',
  },
];

/**
 * Получить label категории на нужном языке
 * @param {string} categoryId - ID категории
 * @param {string} locale - Язык ('ru' или 'en')
 * @returns {string} - Название категории
 */
export const getCategoryLabel = (categoryId, locale = 'ru') => {
  const category = SERVICE_CATEGORIES.find(cat => cat.id === categoryId);
  return category?.label?.[locale] || categoryId;
};

/**
 * Получить все категории в формате для enum options
 * @param {string} locale - Язык ('ru' или 'en')
 * @returns {Array} - Массив {option, label}
 */
export const getCategoryEnumOptions = (locale = 'ru') => {
  return SERVICE_CATEGORIES.map(cat => ({
    option: cat.id,
    label: cat.label[locale],
  }));
};

