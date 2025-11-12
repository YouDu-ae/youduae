import React from 'react';

// Import config and utils
import { useIntl } from '../../util/reactIntl';
import {
  SCHEMA_TYPE_ENUM,
  SCHEMA_TYPE_MULTI_ENUM,
  SCHEMA_TYPE_TEXT,
  SCHEMA_TYPE_LONG,
  SCHEMA_TYPE_BOOLEAN,
  SCHEMA_TYPE_YOUTUBE,
} from '../../util/types';
import {
  required,
  nonEmptyArray,
  validateInteger,
  validateYoutubeURL,
} from '../../util/validators';
// Import shared components
import { FieldCheckboxGroup, FieldSelect, FieldTextInput, FieldBoolean } from '../../components';
// Import modules from this directory
import css from './CustomExtendedDataField.module.css';

const LABEL_TRANSLATION_MAP = {
  'Social network': 'ProfileSettingsForm.socialNetwork',
  Instagram: 'ProfileSettingsForm.socialInstagram',
  'Instagram link': 'ProfileSettingsForm.socialInstagram',
  Website: 'ProfileSettingsForm.socialWebsite',
  Site: 'ProfileSettingsForm.socialWebsite',
  'Website link': 'ProfileSettingsForm.socialWebsite',
};

const sanitizeInstagramHandle = value => {
  if (value == null) {
    return value;
  }

  let handle = `${value}`.trim();
  if (!handle) {
    return '';
  }

  handle = handle.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
  handle = handle.replace(/\?.*$/, '');
  handle = handle.replace(/\/+$/, '');
  handle = handle.replace(/^@/, '');

  return handle;
};

const translateMaybe = (value, intl) => {
  if (!value || typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return trimmed;
  }

  if (trimmed.includes('.')) {
    return intl.formatMessage({ id: trimmed, defaultMessage: trimmed });
  }

  const translationKey = LABEL_TRANSLATION_MAP[trimmed];
  if (translationKey) {
    return intl.formatMessage({ id: translationKey, defaultMessage: trimmed });
  }

  return value;
};

const createFilterOptions = (options, intl) =>
  options.map(o => ({
    key: `${o.option}`,
    label: translateMaybe(o.label, intl),
  }));

const getLabel = fieldConfig => fieldConfig?.saveConfig?.label || fieldConfig?.label;

const CustomFieldEnum = props => {
  const { name, fieldConfig, defaultRequiredMessage, formId, intl } = props;
  const { enumOptions = [], saveConfig } = fieldConfig || {};
  const { placeholderMessage, isRequired, requiredMessage } = saveConfig || {};
  
  // Переводим requiredMessage если это translation key
  const translatedRequiredMessage = requiredMessage && requiredMessage.includes('.')
    ? intl.formatMessage({ id: requiredMessage, defaultMessage: requiredMessage })
    : requiredMessage;
  
  const validateMaybe = isRequired
    ? { validate: required(translatedRequiredMessage || defaultRequiredMessage) }
    : {};
    
  // Переводим placeholder если это translation key
  const translatedPlaceholder = translateMaybe(placeholderMessage, intl);
    
  const placeholder =
    translatedPlaceholder ||
    intl.formatMessage({ id: 'CustomExtendedDataField.placeholderSingleSelect' });
    
  // Переводим labels в options если они translation keys
  const filterOptions = createFilterOptions(enumOptions, intl);

  const label = getLabel(fieldConfig);
  
  // Переводим label если это translation key
  const translatedLabel = translateMaybe(label, intl);

  return filterOptions ? (
    <FieldSelect
      className={css.customField}
      name={name}
      id={formId ? `${formId}.${name}` : name}
      label={translatedLabel}
      {...validateMaybe}
    >
      <option disabled value="">
        {placeholder}
      </option>
      {filterOptions.map(optionConfig => {
        const key = optionConfig.key;
        return (
          <option key={key} value={key}>
            {optionConfig.label}
          </option>
        );
      })}
    </FieldSelect>
  ) : null;
};

const CustomFieldMultiEnum = props => {
  const { name, fieldConfig, defaultRequiredMessage, formId, intl } = props;
  const { enumOptions = [], saveConfig } = fieldConfig || {};
  const { isRequired, requiredMessage } = saveConfig || {};
  const label = getLabel(fieldConfig);
  
  // Переводим requiredMessage если это translation key
  const translatedRequiredMessage = requiredMessage && requiredMessage.includes('.')
    ? intl.formatMessage({ id: requiredMessage, defaultMessage: requiredMessage })
    : requiredMessage;
  
  const validateMaybe = isRequired
    ? { validate: nonEmptyArray(translatedRequiredMessage || defaultRequiredMessage) }
    : {};

  // Переводим label если это translation key
  const translatedLabel = translateMaybe(label, intl);
  
  // Переводим labels в options если они translation keys
  const translatedOptions = createFilterOptions(enumOptions, intl);

  return enumOptions ? (
    <FieldCheckboxGroup
      className={css.customField}
      rootClassName={css.customFieldset}
      id={formId ? `${formId}.${name}` : name}
      name={name}
      label={translatedLabel}
      options={translatedOptions}
      {...validateMaybe}
    />
  ) : null;
};

const CustomFieldText = props => {
  const { name, fieldConfig, defaultRequiredMessage, formId, intl } = props;
  const { placeholderMessage, isRequired, requiredMessage } = fieldConfig?.saveConfig || {};
  const label = translateMaybe(getLabel(fieldConfig), intl);
  const validateMaybe = isRequired
    ? { validate: required(requiredMessage || defaultRequiredMessage) }
    : {};
  const translatedPlaceholder = translateMaybe(
    placeholderMessage,
    intl
  );
  const placeholder =
    translatedPlaceholder || intl.formatMessage({ id: 'CustomExtendedDataField.placeholderText' });

  const isInstagramField = fieldConfig?.key === 'instagram';
  const parseInstagramMaybe = isInstagramField
    ? value => sanitizeInstagramHandle(value)
    : undefined;

  const shouldUseTextarea =
    fieldConfig?.saveConfig?.displayAsTextarea || fieldConfig?.schemaType === 'long';

  return (
    <FieldTextInput
      className={css.customField}
      id={formId ? `${formId}.${name}` : name}
      name={name}
      type={shouldUseTextarea ? 'textarea' : 'text'}
      label={label}
      placeholder={placeholder}
      parse={parseInstagramMaybe}
      format={parseInstagramMaybe}
      inputRootClass={shouldUseTextarea ? undefined : css.customTextInput}
      {...validateMaybe}
    />
  );
};

const CustomFieldLong = props => {
  const { name, fieldConfig, defaultRequiredMessage, formId, intl } = props;
  const { minimum, maximum, saveConfig } = fieldConfig;
  const { placeholderMessage, isRequired, requiredMessage } = saveConfig || {};
  const label = getLabel(fieldConfig);
  const placeholder =
    placeholderMessage || intl.formatMessage({ id: 'CustomExtendedDataField.placeholderLong' });
  const numberTooSmallMessage = intl.formatMessage(
    { id: 'CustomExtendedDataField.numberTooSmall' },
    { min: minimum }
  );
  const numberTooBigMessage = intl.formatMessage(
    { id: 'CustomExtendedDataField.numberTooBig' },
    { max: maximum }
  );

  // Field with schema type 'long' will always be validated against min & max
  const validate = (value, min, max) => {
    const requiredMsg = requiredMessage || defaultRequiredMessage;
    return isRequired && value == null
      ? requiredMsg
      : validateInteger(value, max, min, numberTooSmallMessage, numberTooBigMessage);
  };

  return (
    <FieldTextInput
      className={css.customField}
      id={formId ? `${formId}.${name}` : name}
      name={name}
      type="number"
      step="1"
      parse={value => {
        const parsed = Number.parseInt(value, 10);
        return Number.isNaN(parsed) ? null : parsed;
      }}
      label={label}
      placeholder={placeholder}
      validate={value => validate(value, minimum, maximum)}
      onWheel={e => {
        // fix: number input should not change value on scroll
        if (e.target === document.activeElement) {
          // Prevent the input value change, because we prefer page scrolling
          e.target.blur();

          // Refocus immediately, on the next tick (after the current function is done)
          setTimeout(() => {
            e.target.focus();
          }, 0);
        }
      }}
    />
  );
};

const CustomFieldBoolean = props => {
  const { name, fieldConfig, defaultRequiredMessage, formId, intl } = props;
  const { placeholderMessage, isRequired, requiredMessage } = fieldConfig?.saveConfig || {};
  const translatedLabel = translateMaybe(getLabel(fieldConfig), intl);
  const validateMaybe = isRequired
    ? { validate: required(requiredMessage || defaultRequiredMessage) }
    : {};
  const translatedPlaceholder = translateMaybe(
    placeholderMessage,
    intl
  );
  const placeholder =
    translatedPlaceholder ||
    intl.formatMessage({ id: 'CustomExtendedDataField.placeholderBoolean' });

  return (
    <FieldBoolean
      className={css.customField}
      id={formId ? `${formId}.${name}` : name}
      name={name}
      label={translatedLabel}
      placeholder={placeholder}
      {...validateMaybe}
    />
  );
};

const CustomFieldYoutube = props => {
  const { name, fieldConfig, defaultRequiredMessage, formId, intl } = props;
  const { placeholderMessage, isRequired, requiredMessage } = fieldConfig?.saveConfig || {};
  const translatedLabel = translateMaybe(getLabel(fieldConfig), intl);
  const translatedPlaceholder = translateMaybe(
    placeholderMessage,
    intl
  );
  const placeholder =
    translatedPlaceholder ||
    intl.formatMessage({ id: 'CustomExtendedDataField.placeholderYoutubeVideoURL' });

  const notValidUrlMessage = intl.formatMessage({
    id: 'CustomExtendedDataField.notValidYoutubeVideoURL',
  });

  const validate = value => {
    const requiredMsg = requiredMessage || defaultRequiredMessage;
    return isRequired && value == null
      ? requiredMsg
      : validateYoutubeURL(value, notValidUrlMessage);
  };

  return (
    <FieldTextInput
      className={css.customField}
      id={formId ? `${formId}.${name}` : name}
      name={name}
      type="text"
      label={translatedLabel}
      placeholder={placeholder}
      validate={value => validate(value)}
    />
  );
};

/**
 * Return Final Form field for each configuration according to schema type.
 *
 * These custom extended data fields are for generating input fields from configuration defined
 * in marketplace-custom-config.js. Other panels in EditListingWizard might add more extended data
 * fields (e.g. shipping fee), but these are independently customizable.
 *
 * @param {Object} props should contain fieldConfig that defines schemaType, enumOptions?, and
 * saveConfig for the field.
 */
const CustomExtendedDataField = props => {
  const intl = useIntl();
  const { enumOptions = [], schemaType } = props?.fieldConfig || {};
  const renderFieldComponent = (FieldComponent, props) => <FieldComponent {...props} intl={intl} />;

  return schemaType === SCHEMA_TYPE_ENUM && enumOptions
    ? renderFieldComponent(CustomFieldEnum, props)
    : schemaType === SCHEMA_TYPE_MULTI_ENUM && enumOptions
    ? renderFieldComponent(CustomFieldMultiEnum, props)
    : schemaType === SCHEMA_TYPE_TEXT
    ? renderFieldComponent(CustomFieldText, props)
    : schemaType === SCHEMA_TYPE_LONG
    ? renderFieldComponent(CustomFieldLong, props)
    : schemaType === SCHEMA_TYPE_BOOLEAN
    ? renderFieldComponent(CustomFieldBoolean, props)
    : schemaType === SCHEMA_TYPE_YOUTUBE
    ? renderFieldComponent(CustomFieldYoutube, props)
    : null;
};

export default CustomExtendedDataField;
