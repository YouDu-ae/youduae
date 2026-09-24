import React from 'react';
import classNames from 'classnames';
import { useField } from 'react-final-form';

import { useIntl } from '../../util/reactIntl';

import css from './SpecialistContextFields.module.css';

export const ALL_DUBAI = 'all_dubai';

// Form field names: the profile form keeps user fields under their scope prefix.
export const CONTEXT_FIELD_NAMES = {
  serviceAreas: 'pub_serviceAreas',
  languages: 'pub_languages',
  priceFrom: 'pub_priceFrom',
  availability: 'pub_availability',
};

const translate = (intl, label) =>
  typeof label === 'string' && label.includes('.') ? intl.formatMessage({ id: label }) : label;

const ChipGroup = props => {
  const { name, options, exclusiveOption, intl } = props;
  const { input } = useField(name, { subscription: { value: true } });
  const selected = Array.isArray(input.value) ? input.value : [];

  const toggle = option => {
    if (selected.includes(option)) {
      input.onChange(selected.filter(value => value !== option));
    } else if (option === exclusiveOption) {
      input.onChange([option]);
    } else {
      input.onChange([...selected.filter(value => value !== exclusiveOption), option]);
    }
  };

  return (
    <div className={css.chips} role="group">
      {options.map(({ option, label }) => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            role="checkbox"
            aria-checked={isSelected}
            className={classNames(css.chip, {
              [css.chipSelected]: isSelected,
              [css.chipWide]: option === exclusiveOption,
            })}
            onClick={() => toggle(option)}
          >
            {translate(intl, label)}
          </button>
        );
      })}
    </div>
  );
};

const PriceInput = props => {
  const { name, formId, intl } = props;
  const { input, meta } = useField(name, {
    parse: value => {
      const parsed = Number.parseInt(value, 10);
      return Number.isNaN(parsed) ? null : Math.max(0, Math.min(parsed, 100000));
    },
  });
  const id = `${formId || 'profile'}.${name}`;

  return (
    <div className={css.priceRow}>
      <input
        {...input}
        id={id}
        value={input.value ?? ''}
        className={css.priceInput}
        type="number"
        inputMode="numeric"
        min="0"
        max="100000"
        step="1"
        placeholder={intl.formatMessage({ id: 'SpecialistContext.priceFromPlaceholder' })}
        onWheel={e => e.currentTarget.blur()}
        aria-invalid={meta.touched && !!meta.error}
      />
      <span className={css.priceCurrency}>AED</span>
    </div>
  );
};

/**
 * Where, in which languages, from what price and when a specialist works.
 * Chips instead of long checkbox columns: 28 areas fit on a few lines.
 */
const SpecialistContextFields = props => {
  const { fieldConfigs, formId } = props;
  const intl = useIntl();
  const optionsOf = name => fieldConfigs?.[name]?.enumOptions || [];

  return (
    <section className={css.root}>
      <h3 className={css.title}>{intl.formatMessage({ id: 'SpecialistContext.formTitle' })}</h3>
      <p className={css.description}>
        {intl.formatMessage({ id: 'SpecialistContext.formDescription' })}
      </p>

      <div className={css.block}>
        <div className={css.blockLabel}>
          {intl.formatMessage({ id: 'SpecialistContext.serviceAreas' })}
        </div>
        <ChipGroup
          name={CONTEXT_FIELD_NAMES.serviceAreas}
          options={optionsOf(CONTEXT_FIELD_NAMES.serviceAreas)}
          exclusiveOption={ALL_DUBAI}
          intl={intl}
        />
      </div>

      <div className={css.block}>
        <div className={css.blockLabel}>
          {intl.formatMessage({ id: 'SpecialistContext.languages' })}
        </div>
        <ChipGroup
          name={CONTEXT_FIELD_NAMES.languages}
          options={optionsOf(CONTEXT_FIELD_NAMES.languages)}
          intl={intl}
        />
      </div>

      <div className={css.block}>
        <label className={css.blockLabel} htmlFor={`${formId || 'profile'}.${CONTEXT_FIELD_NAMES.priceFrom}`}>
          {intl.formatMessage({ id: 'SpecialistContext.priceFromLabel' })}
        </label>
        <PriceInput name={CONTEXT_FIELD_NAMES.priceFrom} formId={formId} intl={intl} />
        <p className={css.hint}>{intl.formatMessage({ id: 'SpecialistContext.priceFromHint' })}</p>
      </div>

      <div className={css.block}>
        <div className={css.blockLabel}>
          {intl.formatMessage({ id: 'SpecialistContext.availability' })}
        </div>
        <ChipGroup
          name={CONTEXT_FIELD_NAMES.availability}
          options={optionsOf(CONTEXT_FIELD_NAMES.availability)}
          intl={intl}
        />
      </div>
    </section>
  );
};

export default SpecialistContextFields;
