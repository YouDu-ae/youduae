import {
  restructureListingTypes,
  restructureListingFields,
  mergeDefaultTypesAndFieldsForDebugging,
  union,
  // mergeListingConfig перенесена в configHelpers.js чтобы избежать циклической зависимости
} from '../util/configHelpers';

//////////////////////////////////////////////////////////////////////////////////
// Configurations related to listing.                  //
// Main configuration here is the extended data config //
/////////////////////////////////////////////////////////

// === Локальные дефолты: один тип листинга, связанный с нашим процессом
export const listingTypes = [
  {
    listingType: 'inquiry-listing', // Changed from 'free-listing' to match Console
    label: 'Task (free messaging)',
    transactionType: {
      process: 'assignment-flow-v3',
      alias: 'assignment-flow-v3/release-1', // ← Version 5 with portfolio support (aliased as release-1)
      unitType: 'inquiry',
    },
    // Для inquiry процесса НЕ нужны платежи через Stripe
    // Поэтому отключаем payoutDetails
    defaultListingFields: {
      price: true,
      location: true,
      payoutDetails: false, // ← ВАЖНО: отключаем Stripe payout
    },
  },
];

// Поля листинга (extended data)
export const listingFields = [
  {
    key: 'deadline',
    scope: 'public',
    schemaType: 'enum',
    enumOptions: [
      { option: 'today', label: 'Сегодня' },
      { option: 'tomorrow', label: 'Завтра' },
      { option: 'week', label: 'В течении недели' },
      { option: 'long-term', label: 'Долгосрочно' },
    ],
    filterConfig: {
      indexForSearch: true,
      label: 'Дата выполнения',
      group: 'primary',
    },
    showConfig: {
      label: 'Дата выполнения',
      isRequired: true,
    },
    saveConfig: {
      label: 'Дата выполнения',
      placeholderMessage: 'Выберите срок выполнения',
      isRequired: true,
      requiredMessage: 'Выберите дату выполнения',
    },
  },
  {
    key: 'paymentMethod',
    scope: 'public',
    schemaType: 'enum',
    enumOptions: [
      { option: 'cash', label: 'Наличными' },
      { option: 'bank-transfer', label: 'Банковский перевод (Карта/перевод)' },
    ],
    filterConfig: {
      indexForSearch: true,
      label: 'Способ оплаты',
      group: 'secondary',
    },
    showConfig: {
      label: 'Способ оплаты',
      isRequired: true,
    },
    saveConfig: {
      label: 'Способ оплаты',
      placeholderMessage: 'Выберите способ оплаты',
      isRequired: true,
      requiredMessage: 'Выберите способ оплаты',
    },
  },
];
export const enforceValidListingType = false;

// NOTE: mergeListingConfig теперь в configHelpers.js чтобы избежать циклической зависимости