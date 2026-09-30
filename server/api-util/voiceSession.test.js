const {
  isVoiceAllowedFor,
  buildSessionConfig,
  wizardStepIdOf,
  sanitizeCurrentFields,
  greetingFor,
  farewellFor,
  FAREWELL_INSTRUCTIONS,
  GREETING_INSTRUCTIONS,
  safetyIdentifierFor,
  createLiveSession,
  dailySessionLimit,
  LiveSessionError,
} = require('./voiceSession');
const { TOOL_DEFINITIONS, STEP_TOOL_DEFINITIONS } = require('./voiceTools');

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

  it('tells the backend what the form already holds', () => {
    const currentFields = sanitizeCurrentFields({
      title: 'Заменить уплотнитель на окне',
      address: 'Port de La Mer, La Cote 2',
      price: '300',
      photos: 'ignored',
      evil: 'x'.repeat(5000),
    });
    expect(currentFields).toEqual({
      title: 'Заменить уплотнитель на окне',
      address: 'Port de La Mer, La Cote 2',
      price: 300,
    });

    const { instructions } = buildSessionConfig({
      categories,
      now: lateEveningUtc,
      currentFields,
    }).delegation.responses;
    expect(instructions).toContain('В форме уже заполнено');
    expect(instructions).toContain('- Адрес: Port de La Mer, La Cote 2');
    expect(instructions).toContain('- Бюджет, AED: 300');
  });

  it('says nothing about the form when it is empty', () => {
    const { instructions } = buildSessionConfig({ categories, now: lateEveningUtc }).delegation
      .responses;
    expect(instructions).not.toContain('В форме уже заполнено');
    expect(sanitizeCurrentFields(null)).toEqual({});
  });

  it('greets differently when part of the task is already filled', () => {
    expect(greetingFor({})).toBe(GREETING_INSTRUCTIONS);
    expect(greetingFor({ title: 'Кран' })).toContain('часть задания уже заполнена');
  });

  describe('on the site wizard, step by step', () => {
    const stepSession = (currentStep, currentFields = {}) =>
      buildSessionConfig({ categories, now: lateEveningUtc, currentFields, currentStep });

    it('fills the form as it goes instead of preparing a whole draft', () => {
      const session = stepSession('title');

      expect(session.delegation.responses.tools).toBe(STEP_TOOL_DEFINITIONS);
      expect(session.delegation.responses.instructions).toContain('fill_task_fields');
      expect(session.delegation.responses.instructions).not.toContain('prepare_task_draft');
      expect(session.instructions).toContain('«Фото»');
      expect(session.instructions).not.toContain('Когда черновик готов');
    });

    // GPT-Live hands work to the backend only when its prompt says when to;
    // without this section the wizard stayed empty for the whole conversation.
    it('tells GPT-Live when to hand the work to the backend', () => {
      const { instructions } = stepSession('title');

      expect(instructions).toContain('Delegation policy:');
      expect(instructions).toContain('Delegate to the backend when:');
      expect(instructions).toContain('Do not delegate to the backend when:');
    });

    it('keeps the backend from filling what the person never said', () => {
      const { instructions } = stepSession('title').delegation.responses;

      expect(instructions).toContain('Остальные поля — null');
      expect(instructions).toContain('Способ оплаты не спрашивай');
    });

    it('tells the backend which step is open', () => {
      const { instructions } = stepSession('location').delegation.responses;

      expect(instructions).toContain('3. «Локация» — адрес.');
      expect(instructions).toContain('Сейчас открыт шаг 3 «Локация».');
    });

    it('asks for changes through fill_task_fields when the form is partly filled', () => {
      const { instructions } = stepSession('details', { title: 'Кран' }).delegation.responses;

      expect(instructions).toContain('В форме уже заполнено');
      expect(instructions).toContain('передай в fill_task_fields только новые значения');
    });

    it('starts from the first step when the step is unknown', () => {
      expect(wizardStepIdOf('pricing')).toBe('pricing');
      expect(wizardStepIdOf('evil')).toBe('title');
      expect(wizardStepIdOf(undefined)).toBe('title');
    });

    it('says goodbye with photos and the publish button in mind', () => {
      expect(farewellFor(false)).toBe(FAREWELL_INSTRUCTIONS);
      expect(farewellFor(true)).toContain('добавить фото');
      expect(farewellFor(true)).toContain('Всего доброго!');
    });
  });

  it('keeps the app on the whole draft', () => {
    const session = buildSessionConfig({ categories, now: lateEveningUtc });

    expect(session.delegation.responses.tools).toBe(TOOL_DEFINITIONS);
    expect(session.delegation.responses.instructions).toContain('prepare_task_draft');
    expect(session.delegation.responses.instructions).not.toContain('fill_task_fields');
    expect(session.instructions).toContain('Когда черновик готов');
  });

  it('uses the configured voice, or leaves the default', () => {
    const original = process.env.VOICE_OUTPUT_VOICE;
    try {
      delete process.env.VOICE_OUTPUT_VOICE;
      expect(buildSessionConfig({ categories, now: lateEveningUtc }).audio).toBeUndefined();

      process.env.VOICE_OUTPUT_VOICE = 'meridian';
      expect(buildSessionConfig({ categories, now: lateEveningUtc }).audio).toEqual({
        output: { voice: 'meridian' },
      });
    } finally {
      if (original === undefined) delete process.env.VOICE_OUTPUT_VOICE;
      else process.env.VOICE_OUTPUT_VOICE = original;
    }
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
