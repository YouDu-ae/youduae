import {
  restructureListingTypes,
  restructureListingFields,
  mergeDefaultTypesAndFieldsForDebugging,
  union,
  // mergeListingConfig перенесена в configHelpers.js чтобы избежать циклической зависимости
} from '../util/configHelpers';
import { localized } from '../util/locale';

//////////////////////////////////////////////////////////////////////////////////
// Configurations related to listing.                  //
// Main configuration here is the extended data config //
/////////////////////////////////////////////////////////

// === Локальные дефолты: один тип листинга, связанный с нашим процессом
export const listingTypes = [
  {
    listingType: 'free-listing', // Existing listing type from Console
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
      { option: 'today', label: localized({ ru: 'Сегодня', en: 'Today' }) },
      { option: 'tomorrow', label: localized({ ru: 'Завтра', en: 'Tomorrow' }) },
      { option: 'week', label: localized({ ru: 'В течении недели', en: 'Within a week' }) },
      { option: 'long-term', label: localized({ ru: 'Долгосрочно', en: 'Long-term' }) },
    ],
    filterConfig: {
      indexForSearch: true,
      label: localized({ ru: 'Дата выполнения', en: 'Due date' }),
      group: 'primary',
    },
    showConfig: {
      label: localized({ ru: 'Дата выполнения', en: 'Due date' }),
      isRequired: true,
    },
    saveConfig: {
      label: localized({ ru: 'Дата выполнения', en: 'Due date' }),
      placeholderMessage: localized({ ru: 'Выберите срок выполнения', en: 'Select a timeframe' }),
      isRequired: true,
      requiredMessage: localized({ ru: 'Выберите дату выполнения', en: 'Select a due date' }),
    },
  },
  {
    key: 'paymentMethod',
    scope: 'public',
    schemaType: 'enum',
    enumOptions: [
      { option: 'cash', label: localized({ ru: 'Наличными', en: 'Cash' }) },
      {
        option: 'bank-transfer',
        label: localized({
          ru: 'Банковский перевод (Карта/перевод)',
          en: 'Bank transfer (Card/transfer)',
        }),
      },
    ],
    filterConfig: {
      indexForSearch: true,
      label: localized({ ru: 'Способ оплаты', en: 'Payment method' }),
      group: 'secondary',
    },
    showConfig: {
      label: localized({ ru: 'Способ оплаты', en: 'Payment method' }),
      isRequired: true,
    },
    saveConfig: {
      label: localized({ ru: 'Способ оплаты', en: 'Payment method' }),
      placeholderMessage: localized({ ru: 'Выберите способ оплаты', en: 'Select a payment method' }),
      isRequired: true,
      requiredMessage: localized({ ru: 'Выберите способ оплаты', en: 'Select a payment method' }),
    },
  },
];
export const enforceValidListingType = false;

// NOTE: mergeListingConfig теперь в configHelpers.js чтобы избежать циклической зависимости