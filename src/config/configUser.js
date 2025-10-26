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
  
  // ========== ПРИМЕР ПОЛЕЙ (можно удалить или оставить для других целей) ==========
  {
    key: 'cuisine',
    scope: 'public',
    schemaType: 'enum',
    enumOptions: [
      { option: 'italian', label: 'Italian' },
      { option: 'chinese', label: 'Chinese' },
      { option: 'thai', label: 'Thai' },
    ],
    showConfig: {
      label: 'Favorite cuisine',
    },
    saveConfig: {
      label: 'Favorite cuisine',
      displayInSignUp: true,
      isRequired: true,
    },
    userTypeConfig: {
      limitToUserTypeIds: true,
      userTypeIds: ['a', 'b', 'c'],
    },
  },
  {
    key: 'canCook',
    scope: 'public',
    schemaType: 'boolean',
    showConfig: {
      label: 'Can you cook?',
    },
    saveConfig: {
      label: 'Can you cook?',
      displayInSignUp: true,
      isRequired: true,
      placeholderMessage: 'Select...',
    },
    userTypeConfig: {
      limitToUserTypeIds: true,
      userTypeIds: ['a', 'b', 'c'],
    },
  },
  {
    key: 'numberOfCookbooks',
    scope: 'public',
    schemaType: 'long',
    showConfig: {
      label: 'How many cookbooks do you have',
    },
    saveConfig: {
      label: 'How many cookbooks do you have',
      displayInSignUp: true,
      isRequired: true,
    },
    userTypeConfig: {
      limitToUserTypeIds: true,
      userTypeIds: ['a', 'b', 'c'],
    },
  },
  {
    key: 'kitchenDescription',
    scope: 'public',
    schemaType: 'text',
    showConfig: {
      label: 'Description of your kitchen',
    },
    saveConfig: {
      label: 'Description of your kitchen',
      displayInSignUp: true,
      isRequired: true,
      placeholderMessage: 'Describe your kitchen...',
    },
    userTypeConfig: {
      label: 'Description of your kitchen',
      limitToUserTypeIds: true,
      userTypeIds: ['a', 'b', 'c'],
    },
  },
  {
    key: 'arrivalInstructions',
    scope: 'protected',
    schemaType: 'text',
    showConfig: {
      label: 'How do people arrive at your kitchen?',
    },
    saveConfig: {
      label: 'How do people arrive at your kitchen?',
      displayInSignUp: true,
      isRequired: true,
    },
    userTypeConfig: {
      limitToUserTypeIds: false,
      userTypeIds: ['a', 'b', 'c'],
    },
  },
  {
    key: 'dietaryPreferences',
    scope: 'public',
    schemaType: 'multi-enum',
    enumOptions: [
      { option: 'vegan', label: 'Vegan' },
      { option: 'vegetarian', label: 'Vegetarian' },
      { option: 'gluten-free', label: 'Gluten free' },
      { option: 'dairy-free', label: 'Dairy free' },
      { option: 'nut-free', label: 'Nut free' },
      { option: 'egg-free', label: 'Egg free' },
      { option: 'low-carb', label: 'Low carb' },
      { option: 'low-fat', label: 'Low fat' },
    ],
    showConfig: {
      label: 'Dietary preferences',
    },
    saveConfig: {
      displayInSignUp: true,
      label: 'Dietary preferences',
      isRequired: true,
    },
    userTypeConfig: {
      limitToUserTypeIds: true,
      userTypeIds: ['a', 'b', 'c'],
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
