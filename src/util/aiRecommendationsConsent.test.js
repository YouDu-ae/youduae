import {
  AI_RECOMMENDATIONS_CONSENT_VERSION,
  consentFormValue,
  consentRecord,
  isConsentChecked,
  isConsentGranted,
} from './aiRecommendationsConsent';

describe('AI recommendations consent', () => {
  it('records the choice with its date and the text version', () => {
    const at = new Date('2026-09-29T18:00:00Z');
    expect(consentRecord(true, at)).toEqual({
      granted: true,
      version: AI_RECOMMENDATIONS_CONSENT_VERSION,
      at: '2026-09-29T18:00:00.000Z',
    });
    expect(consentRecord(false, at).granted).toBe(false);
  });

  it('reads the checkbox, which is unticked unless the person ticks it', () => {
    expect(isConsentChecked(['granted'])).toBe(true);
    expect(isConsentChecked([])).toBe(false);
    expect(isConsentChecked(undefined)).toBe(false);
  });

  it('counts only an explicit yes as consent', () => {
    expect(isConsentGranted({ aiRecommendationsConsent: { granted: true } })).toBe(true);
    expect(isConsentGranted({ aiRecommendationsConsent: { granted: false } })).toBe(false);
    expect(isConsentGranted({})).toBe(false);
    expect(isConsentGranted(undefined)).toBe(false);
  });

  it('prefills profile settings from what was stored', () => {
    expect(consentFormValue({ aiRecommendationsConsent: { granted: true } })).toEqual(['granted']);
    expect(consentFormValue({})).toEqual([]);
  });
});
