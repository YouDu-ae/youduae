import React from 'react';

import { FormattedMessage } from '../../util/reactIntl';
import { AI_RECOMMENDATIONS_CONSENT_CHECKED, AI_RECOMMENDATIONS_CONSENT_FIELD } from '../../util/aiRecommendationsConsent';
import FieldCheckbox from '../FieldCheckbox/FieldCheckbox';
import ExternalLink from '../ExternalLink/ExternalLink';

import css from './AiRecommendationsConsentField.module.css';

/**
 * Optional, unticked consent to AI ranking and recommendations for
 * specialists, at sign-up and in profile settings.
 *
 * @param {Object} props
 * @param {string} props.formId
 * @param {string} [props.hintId] translation id of the text under the checkbox
 */
const AiRecommendationsConsentField = ({ formId, hintId }) => {
  const policyLink = (
    <ExternalLink href="/privacy-policy" className={css.link}>
      <FormattedMessage id="AiRecommendationsConsent.policyLink" />
    </ExternalLink>
  );

  return (
    <div className={css.root}>
      <FieldCheckbox
        id={formId ? `${formId}.${AI_RECOMMENDATIONS_CONSENT_FIELD}` : AI_RECOMMENDATIONS_CONSENT_FIELD}
        name={AI_RECOMMENDATIONS_CONSENT_FIELD}
        value={AI_RECOMMENDATIONS_CONSENT_CHECKED}
        label={<FormattedMessage id="AiRecommendationsConsent.label" values={{ policyLink }} />}
        textClassName={css.label}
      />
      {hintId ? (
        <p className={css.hint}>
          <FormattedMessage id={hintId} />
        </p>
      ) : null}
    </div>
  );
};

export default AiRecommendationsConsentField;
