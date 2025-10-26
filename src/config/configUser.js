/////////////////////////////////////////////////////////
// Configurations related to user.                     //
/////////////////////////////////////////////////////////

// Note: The userFields come from userFields asset nowadays by default.
//       To use this built-in configuration, you need to change the overwrite from configHelper.js
//       (E.g. use mergeDefaultTypesAndFieldsForDebugging func)

import { getCategoryEnumOptions } from './serviceCategories';

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
    enumOptions: getCategoryEnumOptions('ru'), // Используем русские названия
    showConfig: {
      label: 'Категории услуг',
      displayInProfile: true,
    },
    saveConfig: {
      label: 'Выберите какие услуги Вы предоставляете',
      displayInSignUp: true,
      isRequired: true,
      requiredMessage: 'Выберите хотя бы одну категорию услуг',
      placeholderMessage: 'Выберите категории...',
    },
    userTypeConfig: {
      limitToUserTypeIds: true,
      userTypeIds: ['customer'], // Только для исполнителей
    },
  },
];

/////////////////////////////////////
// User type configuration for YouDo //
/////////////////////////////////////
/**
 * Два типа пользователей в нашем маркетплейсе:
 * - customer: Исполнитель (предоставляет услуги)
 * - provider: Заказчик (создает задания)
 */

export const userTypes = [
  {
    userType: 'customer',
    label: 'Стать исполнителем',
  },
  {
    userType: 'provider',
    label: 'Стать заказчиком',
  },
];
