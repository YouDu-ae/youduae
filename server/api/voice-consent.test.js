const mockHasVoiceConsent = jest.fn();
const mockGrantVoiceConsent = jest.fn();
const mockWithdrawVoiceConsent = jest.fn();
const mockCountRecentVoiceSessions = jest.fn();
const mockCreateLiveSession = jest.fn();

jest.mock('../db', () => ({
  hasVoiceConsent: (...args) => mockHasVoiceConsent(...args),
  grantVoiceConsent: (...args) => mockGrantVoiceConsent(...args),
  withdrawVoiceConsent: (...args) => mockWithdrawVoiceConsent(...args),
  countRecentVoiceSessions: (...args) => mockCountRecentVoiceSessions(...args),
  recordVoiceSession: async () => {},
}));

jest.mock('../api-util/sdk', () => ({ getSdk: () => ({}) }));
jest.mock('../api-util/listingCategories', () => ({ fetchListingCategories: async () => [] }));

jest.mock('../api-util/voiceSession', () => {
  const actual = jest.requireActual('../api-util/voiceSession');
  return { ...actual, createLiveSession: (...args) => mockCreateLiveSession(...args) };
});

const voiceConsent = require('./voice-consent');
const voiceAccess = require('./voice-access');
const voiceSession = require('./voice-session');
const { VOICE_CONSENT_VERSION } = require('../api-util/voiceSession');

const fakeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.set = jest.fn(() => res);
  return res;
};

const call = async (handler, body, authUserId = 'user-1') => {
  const res = fakeRes();
  await handler({ body, authUserId }, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

describe('voice consent', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    process.env.VOICE_PILOT_ENABLED = 'true';
    process.env.VOICE_PILOT_USER_IDS = 'user-1';
    process.env.OPENAI_API_KEY = 'test-key';
    [
      mockHasVoiceConsent,
      mockGrantVoiceConsent,
      mockWithdrawVoiceConsent,
      mockCountRecentVoiceSessions,
      mockCreateLiveSession,
    ].forEach(mock => mock.mockReset());
    mockCountRecentVoiceSessions.mockResolvedValue(0);
  });

  afterAll(() => {
    process.env = saved;
  });

  it('records consent to the current text', async () => {
    const result = await call(voiceConsent, { granted: true });
    expect(result.status).toBe(200);
    expect(mockGrantVoiceConsent).toHaveBeenCalledWith('user-1', VOICE_CONSENT_VERSION);
  });

  it('lets anyone withdraw, even outside the pilot', async () => {
    const result = await call(voiceConsent, { granted: false }, 'someone-else');
    expect(result.status).toBe(200);
    expect(mockWithdrawVoiceConsent).toHaveBeenCalledWith('someone-else');
  });

  it('does not take consent from people the pilot is closed to', async () => {
    const result = await call(voiceConsent, { granted: true }, 'someone-else');
    expect(result.status).toBe(403);
    expect(mockGrantVoiceConsent).not.toHaveBeenCalled();
  });

  it('rejects a body without a clear yes or no', async () => {
    const result = await call(voiceConsent, { granted: 'yes' });
    expect(result.status).toBe(400);
  });

  it('reports consent alongside access', async () => {
    mockHasVoiceConsent.mockResolvedValue(true);
    const result = await call(voiceAccess, undefined);
    expect(result.body).toEqual({ allowed: true, consented: true });
    expect(mockHasVoiceConsent).toHaveBeenCalledWith('user-1', VOICE_CONSENT_VERSION);
  });

  // The whole point: no audio reaches OpenAI without consent, whatever the client does.
  it('refuses to open a session without consent and never calls OpenAI', async () => {
    mockHasVoiceConsent.mockResolvedValue(false);
    const result = await call(voiceSession, { sdp: 'v=0 offer' });
    expect(result).toEqual({ status: 403, body: { error: 'consent_required' } });
    expect(mockCreateLiveSession).not.toHaveBeenCalled();
  });

  it('opens a session once consent is given', async () => {
    mockHasVoiceConsent.mockResolvedValue(true);
    mockCreateLiveSession.mockResolvedValue({ sessionId: 'sess_1', sdp: 'v=0 answer' });
    const result = await call(voiceSession, { sdp: 'v=0 offer' });
    expect(result.status).toBe(201);
    expect(mockCreateLiveSession).toHaveBeenCalled();
  });
});
