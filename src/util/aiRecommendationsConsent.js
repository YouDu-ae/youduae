/**
 * A specialist's consent to have their profile ranked and recommended to
 * clients with AI (privacy policy, section 5.1).
 *
 * UAE PDPL wants consent to be specific and unambiguous, so it is its own
 * unticked checkbox at sign-up and a switch in profile settings, never part
 * of accepting the terms. Stored in the user's privateData with the date and
 * the version of the text agreed to; only the user and the operator can read
 * privateData.
 */

export const AI_RECOMMENDATIONS_CONSENT_KEY = 'aiRecommendationsConsent';
export const AI_RECOMMENDATIONS_CONSENT_VERSION = '2026-09-29';

// FieldCheckbox keeps checked values in an array under the field name.
const CHECKED_VALUE = 'granted';
export const AI_RECOMMENDATIONS_CONSENT_FIELD = 'aiRecommendationsConsent';
export const AI_RECOMMENDATIONS_CONSENT_CHECKED = CHECKED_VALUE;

export const isConsentChecked = formValue =>
  Array.isArray(formValue) ? formValue.includes(CHECKED_VALUE) : formValue === true;

export const isConsentGranted = privateData =>
  privateData?.[AI_RECOMMENDATIONS_CONSENT_KEY]?.granted === true;

export const consentFormValue = privateData => (isConsentGranted(privateData) ? [CHECKED_VALUE] : []);

export const consentRecord = (granted, now = new Date()) => ({
  granted: !!granted,
  version: AI_RECOMMENDATIONS_CONSENT_VERSION,
  at: now.toISOString(),
});
