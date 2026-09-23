const {
  isVoiceAllowedFor,
  buildSessionConfig,
  safetyIdentifierFor,
  createLiveSession,
  dailySessionLimit,
  LiveSessionError,
} = require('./voiceSession');
const { TOOL_DEFINITIONS } = require('./voiceTools');

const categories = [
  {
    id: 'repairs_main',
    name: 'Ремонт и строительство',
    subcategories: [{ id: 'electric_work', name: 'Электромонтажные работы' }],
  },
];

// 23 Sep 2026, 22:30 UTC is already the 24th in Dubai.
const lateEveningUtc = new Date('2026-09-23T22:30:00Z');

describe('buildSessionConfig', () => {
  it('delegates to a Responses backend that knows the tools', () => {
    const session = buildSessionConfig({ categories, now: lateEveningUtc });

    expect(session.model).toBe('gpt-live-1');
    expect(session.delegation.type).toBe('responses');
    expect(session.delegation.responses.tools).toBe(TOOL_DEFINITIONS);
    expect(session.delegation.responses.parallel_tool_calls).toBe(false);
  });

  it('gives the backend every category id to choose from', () => {
    const { instructions } = buildSessionConfig({ categories, now: lateEveningUtc }).delegation
      .responses;

    expect(instructions).toContain('repairs_main — Ремонт и строительство');
    expect(instructions).toContain('electric_work — Электромонтажные работы');
  });

  // The server runs in UTC; "tomorrow" has to mean tomorrow in Dubai.
  it('dates the conversation in Dubai time', () => {
    const { instructions } = buildSessionConfig({ categories, now: lateEveningUtc }).delegation
      .responses;
    expect(instructions).toContain('24 сентября 2026');
  });
});

describe('isVoiceAllowedFor', () => {
  const original = {
    enabled: process.env.VOICE_PILOT_ENABLED,
    users: process.env.VOICE_PILOT_USER_IDS,
  };
  afterEach(() => {
    process.env.VOICE_PILOT_ENABLED = original.enabled;
    process.env.VOICE_PILOT_USER_IDS = original.users;
    if (original.users === undefined) delete process.env.VOICE_PILOT_USER_IDS;
  });

  it('is closed to everyone while the pilot is off', () => {
    process.env.VOICE_PILOT_ENABLED = 'false';
    process.env.VOICE_PILOT_USER_IDS = 'user-1';
    expect(isVoiceAllowedFor('user-1')).toBe(false);
  });

  it('opens only to the listed accounts', () => {
    process.env.VOICE_PILOT_ENABLED = 'true';
    process.env.VOICE_PILOT_USER_IDS = ' user-1 , user-2 ';
    expect(isVoiceAllowedFor('user-1')).toBe(true);
    expect(isVoiceAllowedFor('user-2')).toBe(true);
    expect(isVoiceAllowedFor('user-3')).toBe(false);
  });

  it('opens to every signed-in user once the list is emptied', () => {
    process.env.VOICE_PILOT_ENABLED = 'true';
    delete process.env.VOICE_PILOT_USER_IDS;
    expect(isVoiceAllowedFor('user-3')).toBe(true);
    expect(isVoiceAllowedFor(null)).toBe(false);
  });
});

describe('safetyIdentifierFor', () => {
  it('is stable per user and does not reveal the user id', () => {
    const id = safetyIdentifierFor('user-123');
    expect(id).toBe(safetyIdentifierFor('user-123'));
    expect(id).not.toContain('user-123');
    expect(id).not.toBe(safetyIdentifierFor('user-456'));
  });
});

describe('dailySessionLimit', () => {
  const original = process.env.VOICE_DAILY_SESSION_LIMIT;
  afterEach(() => {
    process.env.VOICE_DAILY_SESSION_LIMIT = original;
  });

  it('falls back to five when unset or nonsense', () => {
    delete process.env.VOICE_DAILY_SESSION_LIMIT;
    expect(dailySessionLimit()).toBe(5);
    process.env.VOICE_DAILY_SESSION_LIMIT = 'много';
    expect(dailySessionLimit()).toBe(5);
    process.env.VOICE_DAILY_SESSION_LIMIT = '12';
    expect(dailySessionLimit()).toBe(12);
  });
});

describe('createLiveSession', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  const params = { sdp: 'v=0 offer', session: { model: 'gpt-live-1' }, safetyIdentifier: 'abc' };

  it('sends the offer with the project key and returns the answer', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ session: { id: 'sess_1' }, transport: { sdp: 'v=0 answer' } }),
    }));

    const result = await createLiveSession(params);

    expect(result).toEqual({ sessionId: 'sess_1', sdp: 'v=0 answer' });
    const [url, request] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/live/sessions');
    expect(request.headers['OpenAI-Safety-Identifier']).toBe('abc');
    expect(JSON.parse(request.body)).toEqual({
      session: { model: 'gpt-live-1' },
      transport: { type: 'webrtc', sdp: 'v=0 offer' },
    });
  });

  it('reports an OpenAI server failure as a bad gateway', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 503, text: async () => 'busy' }));

    await expect(createLiveSession(params)).rejects.toMatchObject({
      name: 'LiveSessionError',
      status: 502,
    });
  });

  it('refuses a reply that cannot be connected', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ session: {} }) }));
    await expect(createLiveSession(params)).rejects.toBeInstanceOf(LiveSessionError);
  });
});
