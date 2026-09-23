const mockGetVoiceSession = jest.fn();
const mockMarkVoiceDraftReady = jest.fn();
const mockExecuteTool = jest.fn();

jest.mock('../db', () => ({
  getVoiceSession: (...args) => mockGetVoiceSession(...args),
  markVoiceDraftReady: (...args) => mockMarkVoiceDraftReady(...args),
}));

jest.mock('../api-util/sdk', () => ({ getSdk: () => ({}) }));

jest.mock('../api-util/listingCategories', () => ({
  fetchListingCategories: async () => [],
}));

jest.mock('../api-util/voiceTools', () => ({
  TOOL_NAMES: ['resolve_location', 'prepare_task_draft'],
  executeTool: (...args) => mockExecuteTool(...args),
}));

const voiceTool = require('./voice-tool');

const fakeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const call = async body => {
  const res = fakeRes();
  await voiceTool({ body, authUserId: 'user-1' }, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

const ownSession = { session_id: 'sess_1', user_id: 'user-1', started_at: new Date() };

describe('POST /api/voice/tool', () => {
  const originalFlag = process.env.VOICE_PILOT_ENABLED;

  beforeEach(() => {
    process.env.VOICE_PILOT_ENABLED = 'true';
    mockGetVoiceSession.mockReset();
    mockMarkVoiceDraftReady.mockReset();
    mockExecuteTool.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.VOICE_PILOT_ENABLED = originalFlag;
    jest.restoreAllMocks();
  });

  it('stays hidden while the pilot is switched off', async () => {
    process.env.VOICE_PILOT_ENABLED = 'false';
    const { status } = await call({ sessionId: 'sess_1', name: 'resolve_location' });
    expect(status).toBe(404);
  });

  // Someone taken out of the pilot must not carry on in a conversation they opened.
  it('refuses a user who is not on the pilot list', async () => {
    process.env.VOICE_PILOT_USER_IDS = 'user-2';
    mockGetVoiceSession.mockResolvedValue(ownSession);

    const { status } = await call({ sessionId: 'sess_1', name: 'resolve_location', arguments: '{}' });

    expect(status).toBe(403);
    expect(mockExecuteTool).not.toHaveBeenCalled();
    delete process.env.VOICE_PILOT_USER_IDS;
  });

  it('refuses tools nobody declared', async () => {
    const { status } = await call({ sessionId: 'sess_1', name: 'publish_task', arguments: '{}' });
    expect(status).toBe(400);
    expect(mockExecuteTool).not.toHaveBeenCalled();
  });

  // Otherwise any signed-in visitor could use the endpoint as a free proxy to
  // Google Places without ever opening a conversation.
  it('refuses a session opened by someone else', async () => {
    mockGetVoiceSession.mockResolvedValue({ ...ownSession, user_id: 'user-2' });

    const { status } = await call({ sessionId: 'sess_1', name: 'resolve_location', arguments: '{}' });

    expect(status).toBe(403);
    expect(mockExecuteTool).not.toHaveBeenCalled();
  });

  it('refuses a session that was never opened', async () => {
    mockGetVoiceSession.mockResolvedValue(null);
    const { status } = await call({ sessionId: 'sess_x', name: 'resolve_location', arguments: '{}' });
    expect(status).toBe(403);
  });

  it('refuses a session older than half an hour', async () => {
    mockGetVoiceSession.mockResolvedValue({
      ...ownSession,
      started_at: new Date(Date.now() - 31 * 60 * 1000),
    });
    const { status } = await call({ sessionId: 'sess_1', name: 'resolve_location', arguments: '{}' });
    expect(status).toBe(403);
  });

  it('runs the tool with parsed arguments', async () => {
    mockGetVoiceSession.mockResolvedValue(ownSession);
    mockExecuteTool.mockResolvedValue({ ok: true, candidates: [] });

    const { status, body } = await call({
      sessionId: 'sess_1',
      name: 'resolve_location',
      arguments: '{"query":"Marina"}',
    });

    expect(status).toBe(200);
    expect(body).toEqual({ output: { ok: true, candidates: [] } });
    expect(mockExecuteTool).toHaveBeenCalledWith('resolve_location', { query: 'Marina' }, {
      categories: [],
    });
  });

  it('lets the assistant recover from arguments it garbled', async () => {
    mockGetVoiceSession.mockResolvedValue(ownSession);

    const { status, body } = await call({
      sessionId: 'sess_1',
      name: 'resolve_location',
      arguments: '{not json',
    });

    expect(status).toBe(200);
    expect(body.output.ok).toBe(false);
    expect(mockExecuteTool).not.toHaveBeenCalled();
  });

  it('records a finished draft for the pilot funnel', async () => {
    mockGetVoiceSession.mockResolvedValue(ownSession);
    mockExecuteTool.mockResolvedValue({ ok: true, draft: {} });

    await call({ sessionId: 'sess_1', name: 'prepare_task_draft', arguments: '{}' });

    expect(mockMarkVoiceDraftReady).toHaveBeenCalledWith('sess_1');
  });

  it('does not count a rejected draft', async () => {
    mockGetVoiceSession.mockResolvedValue(ownSession);
    mockExecuteTool.mockResolvedValue({ ok: false, errors: { price: 'нет' } });

    await call({ sessionId: 'sess_1', name: 'prepare_task_draft', arguments: '{}' });

    expect(mockMarkVoiceDraftReady).not.toHaveBeenCalled();
  });
});
