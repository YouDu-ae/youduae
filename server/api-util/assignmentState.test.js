const { isCompletedOrBeyond, isInvalidTransitionError } = require('./assignmentState');

describe('isCompletedOrBeyond', () => {
  it('reads completing the work as done', () => {
    expect(isCompletedOrBeyond('transition/complete')).toBe(true);
  });

  it('reads every review transition as done', () => {
    [
      'transition/review-1-by-provider',
      'transition/review-1-by-customer',
      'transition/review-2-by-provider',
      'transition/review-2-by-customer',
    ].forEach(transition => {
      expect(isCompletedOrBeyond(transition)).toBe(true);
    });
  });

  it('reads an expired review period as done', () => {
    [
      'transition/expire-review-period',
      'transition/expire-provider-review-period',
      'transition/expire-customer-review-period',
    ].forEach(transition => {
      expect(isCompletedOrBeyond(transition)).toBe(true);
    });
  });

  it('does not treat an offer or an accepted task as done', () => {
    expect(isCompletedOrBeyond('transition/inquire')).toBe(false);
    expect(isCompletedOrBeyond('transition/accept-offer')).toBe(false);
    expect(isCompletedOrBeyond('transition/decline-offer')).toBe(false);
  });

  it('does not guess when the transition is missing', () => {
    expect(isCompletedOrBeyond(undefined)).toBe(false);
    expect(isCompletedOrBeyond(null)).toBe(false);
    expect(isCompletedOrBeyond('')).toBe(false);
  });

  // The old endpoint aimed at an operator transition that this process never
  // declared, so nothing must quietly accept one.
  it('does not recognise operator transitions', () => {
    expect(isCompletedOrBeyond('transition/operator-complete')).toBe(false);
  });
});

describe('isInvalidTransitionError', () => {
  it('recognises the conflict status', () => {
    expect(isInvalidTransitionError({ status: 409 })).toBe(true);
  });

  it('recognises the error code', () => {
    expect(
      isInvalidTransitionError({ data: { errors: [{ code: 'transaction-invalid-transition' }] } })
    ).toBe(true);
  });

  it('leaves other failures alone', () => {
    expect(isInvalidTransitionError({ status: 500 })).toBe(false);
    expect(isInvalidTransitionError({ data: { errors: [{ code: 'forbidden' }] } })).toBe(false);
    expect(isInvalidTransitionError(undefined)).toBe(false);
  });
});
