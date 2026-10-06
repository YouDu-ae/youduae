const { resolveIsVerified } = require('./reputation');

describe('resolveIsVerified', () => {
  it('trusts the flag only in metadata, which the operator writes', () => {
    expect(resolveIsVerified({ metadata: { isVerified: true } })).toBe(true);
    expect(resolveIsVerified({ publicData: { isVerified: true } })).toBe(false);
    expect(resolveIsVerified({ publicData: { isVerified: { isVerified: true } } })).toBe(false);
  });

  it('accepts the nested form from an early manual edit', () => {
    expect(resolveIsVerified({ metadata: { isVerified: { isVerified: true } } })).toBe(true);
  });

  it('treats anything else as not verified', () => {
    expect(resolveIsVerified({ metadata: { isVerified: 'true' } })).toBe(false);
    expect(resolveIsVerified({ metadata: { isVerified: false } })).toBe(false);
    expect(resolveIsVerified({})).toBe(false);
    expect(resolveIsVerified(undefined)).toBe(false);
  });
});
