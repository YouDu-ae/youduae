import React from 'react';
import { Heading } from '../../components';
import { useIntl } from '../../util/reactIntl';

import css from './ProfilePage.module.css';

const FIELD_KEYS = ['serviceAreas', 'languages', 'priceFrom', 'availability'];

const translate = (intl, label) =>
  typeof label === 'string' && label.includes('.') ? intl.formatMessage({ id: label }) : label;

/** Only what the specialist chose, never the unchosen options. */
const SectionSpecialistContext = props => {
  const { publicData, userFieldConfig } = props;
  const intl = useIntl();

  if (!publicData) {
    return null;
  }

  const labelsFor = key => {
    const options = userFieldConfig?.find(field => field.key === key)?.enumOptions || [];
    const values = Array.isArray(publicData[key]) ? publicData[key] : [];
    return values
      .map(value => options.find(o => `${o.option}` === value))
      .filter(Boolean)
      .map(o => translate(intl, o.label));
  };

  const areas = labelsFor('serviceAreas');
  const languages = labelsFor('languages');
  const availability = labelsFor('availability');
  const priceFrom = Number.isFinite(publicData.priceFrom) ? publicData.priceFrom : null;

  const rows = [
    { id: 'areas', label: 'SpecialistContext.profileAreas', chips: areas },
    { id: 'languages', label: 'SpecialistContext.profileLanguages', chips: languages },
    {
      id: 'price',
      label: 'SpecialistContext.profilePrice',
      text:
        priceFrom !== null
          ? intl.formatMessage(
              { id: 'SpecialistContext.priceFromValue' },
              { value: intl.formatNumber(priceFrom) }
            )
          : null,
    },
    { id: 'availability', label: 'SpecialistContext.profileAvailability', chips: availability },
  ].filter(row => (row.chips ? row.chips.length > 0 : !!row.text));

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className={css.sectionSpecialistContext}>
      <Heading as="h2" rootClassName={css.sectionHeading}>
        {intl.formatMessage({ id: 'SpecialistContext.profileHeading' })}
      </Heading>
      <dl className={css.contextList}>
        {rows.map(row => (
          <div key={row.id} className={css.contextRow}>
            <dt className={css.contextLabel}>{intl.formatMessage({ id: row.label })}</dt>
            <dd className={css.contextValue}>
              {row.chips
                ? row.chips.map(chip => (
                    <span key={chip} className={css.subcategoryPill}>
                      {chip}
                    </span>
                  ))
                : <span className={css.contextText}>{row.text}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export { FIELD_KEYS as SPECIALIST_CONTEXT_KEYS };
export default SectionSpecialistContext;
