const { requireTelegramSecret } = require('./telegramWebhookAuth');

const run = header => {
  const req = { get: name => (name === 'x-telegram-bot-api-secret-token' ? header : undefined), ip: '1.2.3.4' };
  const res = { sendStatus: jest.fn() };
  const next = jest.fn();
  requireTelegramSecret(req, res, next);
  return { status: res.sendStatus.mock.calls[0]?.[0], passed: next.mock.calls.length === 1 };
};

describe('requireTelegramSecret', () => {
  const original = process.env.TELEGRAM_WEBHOOK_SECRET;
  beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'right-secret_123';
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = original;
    jest.restoreAllMocks();
  });

  it('lets through an update carrying the secret', () => {
    expect(run('right-secret_123')).toEqual({ status: undefined, passed: true });
  });

  it('rejects an update without the header', () => {
    expect(run(undefined)).toEqual({ status: 401, passed: false });
  });

  it('rejects a wrong secret, including one of a different length', () => {
    expect(run('wrong-secret_123')).toEqual({ status: 401, passed: false });
    expect(run('right')).toEqual({ status: 401, passed: false });
  });

  it('rejects everything when no secret is configured', () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    expect(run('anything')).toEqual({ status: 401, passed: false });
  });
});
