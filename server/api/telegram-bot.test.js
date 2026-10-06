jest.mock('sharetribe-flex-integration-sdk', () => ({ createInstance: () => ({}) }));
jest.mock('./seo-optimizer', () => ({ optimizeForSEO: jest.fn() }));
jest.mock('../api-util/portfolioModeration', () => ({
  handleCallback: jest.fn(async () => ({ outcome: 'approved' })),
  sendPendingPhotos: jest.fn(async () => ({ sent: 0, total: 0 })),
}));

const ADMIN_CHAT = '111222333';
// The bot reads its settings once, when it is loaded.
process.env.TELEGRAM_ADMIN_CHAT_ID = ADMIN_CHAT;
process.env.TELEGRAM_WEBHOOK_SECRET = 'webhook-secret';

const portfolioModeration = require('../api-util/portfolioModeration');
const { handleWebhook, setupWebhook } = require('./telegram-bot');

const originalFetch = global.fetch;

const response = () => ({ sendStatus: jest.fn() });

const privateMessage = (chatId, text) => ({
  body: {
    message: {
      chat: { id: chatId, type: 'private' },
      from: { id: chatId, first_name: 'Ирина' },
      text,
    },
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn(async () => ({ json: async () => ({ ok: true, result: {} }) }));
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  global.fetch = originalFetch;
});

describe('Telegram webhook', () => {
  it('passes taps on the moderation buttons to the portfolio moderation', async () => {
    const res = response();
    const callbackQuery = { id: 'query-1', data: 'pf:a:x:y', message: { chat: { id: 1 } } };

    await handleWebhook({ body: { callback_query: callbackQuery } }, res);

    expect(portfolioModeration.handleCallback).toHaveBeenCalledWith(callbackQuery);
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  it('sends the photos waiting for moderation on /portfolio from the admin chat', async () => {
    const res = response();

    await handleWebhook(privateMessage(Number(ADMIN_CHAT), '/portfolio'), res);

    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(portfolioModeration.sendPendingPhotos).toHaveBeenCalledWith(Number(ADMIN_CHAT));
  });

  it('does not show the moderation queue to anyone else', async () => {
    const res = response();

    await handleWebhook(privateMessage(5555, '/portfolio'), res);

    expect(portfolioModeration.sendPendingPhotos).not.toHaveBeenCalled();
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  it('subscribes the webhook to button taps and keeps the secret token', async () => {
    await setupWebhook('https://youdu.ae/api/telegram/webhook');

    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
      url: 'https://youdu.ae/api/telegram/webhook',
      allowed_updates: ['message', 'callback_query'],
      secret_token: 'webhook-secret',
    });
  });
});
