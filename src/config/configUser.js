/////////////////////////////////////////////////////////
// Configurations related to user.                     //
/////////////////////////////////////////////////////////

// Note: The userFields come from userFields asset nowadays by default.
//       To use this built-in configuration, you need to change the overwrite from configHelper.js
//       (E.g. use mergeDefaultTypesAndFieldsForDebugging func)

import { SERVICE_CATEGORIES } from './serviceCategories';
import { localized } from '../util/locale';

/**
 * Configuration options for user fields (custom extended data fields):
 * - key:                           Unique key for the extended data field.
 * - scope (optional):              Scope of the extended data can be either 'public', 'protected', or 'private'.
 *                                  Default value: 'public'.
 * - schemaType (optional):         Schema for this extended data field.
 *                                  This is relevant when rendering components.
 *                                  Possible values: 'enum', 'multi-enum', 'text', 'long', 'boolean'.
 * - enumOptions (optional):        Options shown for 'enum' and 'multi-enum' extended data.
 *                                  These are used to render options for inputs on
 *                                  ProfileSettingsPage and AuthenticationPage.
 * - showConfig:                    Configuration for rendering user information. (How the field should be shown.)
 *   - label:                         Label for the saved data.
 *   - displayInProfile (optional):   Can be used to hide field content from profile page.
 *                                    Default value: true.
 * - saveConfig:                    Configuration for adding and modifying extended data fields.
 *   - label:                         Label for the input field.
 *   - placeholderMessage (optional): Default message for user input.
 *   - isRequired (optional):         Is the field required for users to fill
 *   - requiredMessage (optional):    Message for mandatory fields.
 *   - displayInSignUp (optional):    Can be used to show field input on sign up page.
 *                                    Default value: true.
 * - userTypeConfig:                Configuration for limiting user field to specific user types.
 *   - limitToUserTypeIds:            Can be used to determine whether to limit the field to certain user types. The
 *                                    Console based asset configurations do not yet support user types, so in hosted configurations
 *                                    the default value for this is 'false'.
 *   - userTypeIds:                   An array of user types for which the extended
 *   (optional)                       data is relevant and should be added.
 */
export const userFields = [
  // ========== КАТЕГОРИИ УСЛУГ (только для Customer - исполнителей) ==========
  {
    key: 'serviceCategories',
    scope: 'public',
    schemaType: 'multi-enum',
    enumOptions: [
      { option: 'repairs_main', label: 'ServiceCategory.construction' },
      { option: 'Beauty_health', label: 'ServiceCategory.beauty' },
      { option: 'training', label: 'ServiceCategory.tutors' },
      { option: 'Help_home', label: 'ServiceCategory.cleaning' },
      { option: 'Legal_assistance', label: 'ServiceCategory.legal' },
      { option: 'Installation_mashines', label: 'ServiceCategory.appliances' },
      { option: 'Photo', label: 'ServiceCategory.photo' },
      { option: 'Delivery', label: 'ServiceCategory.courier' },
      { option: 'Cargo_transportation', label: 'ServiceCategory.transport' },
      { option: 'Repair_digital', label: 'ServiceCategory.electronics' },
      { option: 'Automotive_services', label: 'ServiceCategory.auto' },
      { option: 'Interior_designer', label: 'ServiceCategory.interior' },
      { option: 'Tourist_services', label: 'ServiceCategory.tourist' },
      { option: 'Web_design', label: 'ServiceCategory.web' },
    ],
    showConfig: {
      label: 'ServiceCategory.title',
      displayInProfile: true,
      unselectedOptions: false, // Скрываем невыбранные категории
    },
    saveConfig: {
      label: 'ServiceCategory.selectServices',
      displayInSignUp: false, // ⚠️ Скрыто! Используем кастомный ServiceCategorySelector
      isRequired: true,
      requiredMessage: 'ServiceCategory.requiredMessage',
      placeholderMessage: 'ServiceCategory.placeholder',
    },
    userTypeConfig: {
      limitToUserTypeIds: true,
      userTypeIds: ['customer'], // ⚠️ Исполнитель = customer (НЕТ прав создавать листинги в Console)
    },
  },
  // ========== ПОДКАТЕГОРИИ (subcategories) - хранится как текст (JSON string) ==========
  {
    key: 'subcategories',
    scope: 'public',
    schemaType: 'text',
    showConfig: {
      label: 'ServiceCategory.subcategoriesTitle',
      displayInProfile: false, // Не отображаем напрямую, показываем через категории
    },
    saveConfig: {
      label: 'ServiceCategory.subcategories',
      displayInSignUp: false, // Скрыто, управляется через ServiceCategorySelector
      isRequired: false,
    },
    userTypeConfig: {
      limitToUserTypeIds: true,
      userTypeIds: ['customer'],
    },
  },
  {
    key: 'instagram',
    scope: 'public',
    schemaType: 'text',
    showConfig: {
      label: 'ProfileSettingsForm.socialInstagram',
      displayInProfile: true,
    },
    saveConfig: {
      label: 'ProfileSettingsForm.socialInstagram',
      placeholderMessage: 'ProfileSettingsForm.socialInstagramPlaceholder',
      displayInSignUp: true,
      isRequired: false,
    },
    userTypeConfig: {
      limitToUserTypeIds: true,
      userTypeIds: ['customer'],
    },
  },
  {
    key: 'website',
    scope: 'public',
    schemaType: 'text',
    showConfig: {
      label: 'ProfileSettingsForm.socialWebsite',
      displayInProfile: true,
    },
    saveConfig: {
      label: 'ProfileSettingsForm.socialWebsite',
      placeholderMessage: 'ProfileSettingsForm.socialWebsitePlaceholder',
      displayInSignUp: true,
      isRequired: false,
    },
    userTypeConfig: {
      limitToUserTypeIds: true,
      userTypeIds: ['customer'],
    },
  },
  // ========== КОНТЕКСТ СПЕЦИАЛИСТА: где, на каком языке, почём и когда ==========
  // Собираются для подбора под задание и для будущих запросов AI-агентов.
  // Не просим при регистрации, чтобы не удлинять её; заполняются в профиле.
  {
    key: 'serviceAreas',
    scope: 'public',
    schemaType: 'multi-enum',
    // id районов совпадают с server/api-util/communities.js — по ним задания
    // раскладываются по районам, и витрины сопоставляют районы по этим id.
    enumOptions: [
      { option: 'all_dubai', label: 'SpecialistContext.areaAllDubai' },
      { option: 'dubai_marina', label: 'Dubai Marina' },
      { option: 'jbr', label: 'JBR' },
      { option: 'jlt', label: 'JLT' },
      { option: 'palm_jumeirah', label: 'Palm Jumeirah' },
      { option: 'downtown', label: 'Downtown Dubai' },
      { option: 'business_bay', label: 'Business Bay' },
      { option: 'difc', label: 'DIFC' },
      { option: 'creek_harbour', label: 'Dubai Creek Harbour' },
      { option: 'jvc', label: 'JVC' },
      { option: 'jvt', label: 'JVT' },
      { option: 'al_barsha', label: 'Al Barsha' },
      { option: 'dubai_hills', label: 'Dubai Hills Estate' },
      { option: 'emirates_living', label: 'Emirates Living' },
      { option: 'sports_city', label: 'Dubai Sports City' },
      { option: 'motor_city', label: 'Motor City' },
      { option: 'arabian_ranches', label: 'Arabian Ranches' },
      { option: 'discovery_gardens', label: 'Discovery Gardens' },
      { option: 'dubai_investment_park', label: 'Dubai Investment Park' },
      { option: 'jumeirah', label: 'Jumeirah' },
      { option: 'bur_dubai', label: 'Bur Dubai' },
      { option: 'deira', label: 'Deira' },
      { option: 'al_nahda', label: 'Al Nahda' },
      { option: 'mirdif', label: 'Mirdif' },
      { option: 'silicon_oasis', label: 'Dubai Silicon Oasis' },
      { option: 'international_city', label: 'International City' },
      { option: 'sharjah', label: 'SpecialistContext.areaSharjah' },
      { option: 'abu_dhabi', label: 'SpecialistContext.areaAbuDhabi' },
    ],
    showConfig: {
      label: 'SpecialistContext.serviceAreas',
      displayInProfile: true,
    },
    saveConfig: {
      label: 'SpecialistContext.serviceAreas',
      displayInSignUp: false,
      isRequired: false,
    },
    userTypeConfig: {
      limitToUserTypeIds: true,
      userTypeIds: ['customer'],
    },
  },
  {
    key: 'languages',
    scope: 'public',
    schemaType: 'multi-enum',
    enumOptions: [
      { option: 'ru', label: 'SpecialistContext.languageRu' },
      { option: 'en', label: 'SpecialistContext.languageEn' },
      { option: 'ar', label: 'SpecialistContext.languageAr' },
      { option: 'uk', label: 'SpecialistContext.languageUk' },
      { option: 'uz', label: 'SpecialistContext.languageUz' },
      { option: 'kk', label: 'SpecialistContext.languageKk' },
      { option: 'ky', label: 'SpecialistContext.languageKy' },
      { option: 'tg', label: 'SpecialistContext.languageTg' },
      { option: 'hi', label: 'SpecialistContext.languageHi' },
      { option: 'ur', label: 'SpecialistContext.languageUr' },
      { option: 'tl', label: 'SpecialistContext.languageTl' },
      { option: 'tr', label: 'SpecialistContext.languageTr' },
      { option: 'fa', label: 'SpecialistContext.languageFa' },
    ],
    showConfig: {
      label: 'SpecialistContext.languages',
      displayInProfile: true,
    },
    saveConfig: {
      label: 'SpecialistContext.languages',
      displayInSignUp: false,
      isRequired: false,
    },
    userTypeConfig: {
      limitToUserTypeIds: true,
      userTypeIds: ['customer'],
    },
  },
  {
    key: 'priceFrom',
    scope: 'public',
    schemaType: 'long',
    minimum: 0,
    maximum: 100000,
    showConfig: {
      label: 'SpecialistContext.priceFrom',
      valueMessage: 'SpecialistContext.priceFromValue',
      displayInProfile: true,
    },
    saveConfig: {
      label: 'SpecialistContext.priceFrom',
      placeholderMessage: 'SpecialistContext.priceFromPlaceholder',
      displayInSignUp: false,
      isRequired: false,
    },
    userTypeConfig: {
      limitToUserTypeIds: true,
      userTypeIds: ['customer'],
    },
  },
  {
    key: 'availability',
    scope: 'public',
    schemaType: 'multi-enum',
    enumOptions: [
      { option: 'weekdays', label: 'SpecialistContext.availabilityWeekdays' },
      { option: 'weekends', label: 'SpecialistContext.availabilityWeekends' },
      { option: 'evenings', label: 'SpecialistContext.availabilityEvenings' },
      { option: 'same_day', label: 'SpecialistContext.availabilitySameDay' },
    ],
    showConfig: {
      label: 'SpecialistContext.availability',
      displayInProfile: true,
    },
    saveConfig: {
      label: 'SpecialistContext.availability',
      displayInSignUp: false,
      isRequired: false,
    },
    userTypeConfig: {
      limitToUserTypeIds: true,
      userTypeIds: ['customer'],
    },
  },
];

/////////////////////////////////////
// User type configuration for YouDo //
/////////////////////////////////////
/**
 * Два типа пользователей в нашем маркетплейсе:
 * ⚠️ ВАЖНО: В ВАШЕМ Console настроено НЕСТАНДАРТНО:
 * - userType 'provider' = ИМЕЕТ права post-listings (Заказчик, создаёт задания)
 * - userType 'customer' = НЕ ИМЕЕТ права post-listings (Исполнитель, откликается)
 * 
 * Это ОБРАТНАЯ логика от стандартной Sharetribe!
 */

export const userTypes = [
  {
    userType: 'customer',  // ← Исполнитель (НЕТ прав создавать задания в Console)
    label: localized({ ru: 'Стать исполнителем', en: 'Become a specialist' }),
    roles: {
      customer: false,  // ⚠️ НЕ может создавать листинги
      provider: true,   // ✅ Предоставляет услуги
    },
    defaultUserFields: {
      phoneNumber: true,
    },
    phoneNumberSettings: {
      displayInSignUp: true,
      required: true,
    },
  },
  {
    userType: 'provider',  // ← Заказчик (ЕСТЬ права создавать задания в Console)
    label: localized({ ru: 'Стать заказчиком', en: 'Become a client' }),
    roles: {
      customer: true,   // ✅ Может создавать листинги
      provider: false,  // ⚠️ НЕ предоставляет услуги
    },
    defaultUserFields: {
      phoneNumber: true,
    },
    phoneNumberSettings: {
      displayInSignUp: true,
      required: true,
    },
  },
];
