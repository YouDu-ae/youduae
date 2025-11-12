/////////////////////////////////////////////////////////
// Configurations related to user.                     //
/////////////////////////////////////////////////////////

// Note: The userFields come from userFields asset nowadays by default.
//       To use this built-in configuration, you need to change the overwrite from configHelper.js
//       (E.g. use mergeDefaultTypesAndFieldsForDebugging func)

import { SERVICE_CATEGORIES } from './serviceCategories';

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
      { option: 'construction', label: 'ServiceCategory.construction' },
      { option: 'beauty', label: 'ServiceCategory.beauty' },
      { option: 'tutoring', label: 'ServiceCategory.tutoring' },
      { option: 'cleaning', label: 'ServiceCategory.cleaning' },
      { option: 'legal', label: 'ServiceCategory.legal' },
      { option: 'appliances', label: 'ServiceCategory.appliances' },
      { option: 'media', label: 'ServiceCategory.media' },
      { option: 'courier', label: 'ServiceCategory.courier' },
      { option: 'moving', label: 'ServiceCategory.moving' },
      { option: 'tech-repair', label: 'ServiceCategory.techRepair' },
      { option: 'auto', label: 'ServiceCategory.auto' },
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
      displayInSignUp: true,
      isRequired: true,
      requiredMessage: 'ServiceCategory.requiredMessage',
      placeholderMessage: 'ServiceCategory.placeholder',
    },
    userTypeConfig: {
      limitToUserTypeIds: true,
      userTypeIds: ['customer'], // ⚠️ Исполнитель = customer (НЕТ прав создавать листинги в Console)
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
    label: 'Стать исполнителем',
    roles: {
      customer: false,  // ⚠️ НЕ может создавать листинги
      provider: true,   // ✅ Предоставляет услуги
    },
  },
  {
    userType: 'provider',  // ← Заказчик (ЕСТЬ права создавать задания в Console)
    label: 'Стать заказчиком',
    roles: {
      customer: true,   // ✅ Может создавать листинги
      provider: false,  // ⚠️ НЕ предоставляет услуги
    },
  },
];
