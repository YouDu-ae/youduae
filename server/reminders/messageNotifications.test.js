const mockTelegram = jest.fn();
const mockPush = jest.fn();

jest.mock('../api/telegram-bot', () => ({ notifyNewMessage: (...args) => mockTelegram(...args) }));
jest.mock('../api/send-notification', () => ({
  sendNewMessageNotification: (...args) => mockPush(...args),
}));

const { processMessageEvents, CURSOR_NAME } = require('./messageNotifications');

const NOW = Date.parse('2026-09-26T14:00:00Z');
const AUTHOR = 'author-1';
const MASTER = 'master-1';

const messageEvent = (sequenceId, senderId, { createdAt = '2026-09-26T13:59:00Z', tx = 'tx-1' } = {}) => ({
  attributes: {
    eventType: 'message/created',
    sequenceId,
    resourceId: `msg-${sequenceId}`,
    createdAt: new Date(createdAt),
    resource: {
      attributes: { content: 'Правильно ли я понял?', createdAt: new Date(createdAt) },
      relationships: {
        sender: { data: { id: { uuid: senderId } } },
        transaction: { data: { id: { uuid: tx } } },
      },
    },
  },
});

const user = (id, displayName) => ({ id: { uuid: id }, type: 'user', attributes: { profile: { displayName } } });

const setup = events => {
  const db = {
    getOrStartEventCursor: jest.fn(async () => ({ sequenceId: 5, updatedAt: new Date() })),
    saveEventCursor: jest.fn(async () => {}),
  };
  const integrationSdk = {
    events: { query: jest.fn(async () => ({ data: { data: events, meta: { perPage: 100 } } })) },
    transactions: {
      show: jest.fn(async () => ({
        data: {
          data: {
            relationships: {
              customer: { data: { id: { uuid: MASTER } } },
              provider: { data: { id: { uuid: AUTHOR } } },
            },
          },
          included: [user(MASTER, 'Ahmad Said'), user(AUTHOR, 'Alex')],
        },
      })),
    },
  };
  return { db, integrationSdk, run: () => processMessageEvents({ integrationSdk, db, log: () => {}, now: NOW }) };
};

describe('processMessageEvents', () => {
  beforeEach(() => {
    mockTelegram.mockReset().mockResolvedValue(true);
    mockPush.mockReset().mockResolvedValue(true);
  });

  it("tells the task author about the specialist's reply, and only the author", async () => {
    const { run, db } = setup([messageEvent(6, MASTER)]);
    const result = await run();

    expect(mockTelegram).toHaveBeenCalledTimes(1);
    expect(mockTelegram).toHaveBeenCalledWith(AUTHOR, {
      senderName: 'Ahmad Said',
      messagePreview: 'Правильно ли я понял?',
      conversationUrl: 'https://youdu.ae/sale/tx-1',
    });
    expect(mockPush).toHaveBeenCalledWith(AUTHOR, 'Ahmad Said', 'Правильно ли я понял?', 'tx-1');
    expect(result.notified).toBe(1);
    expect(db.saveEventCursor).toHaveBeenCalledWith(CURSOR_NAME, 6);
  });

  it("tells the specialist about the author's message, linking to their order page", async () => {
    const { run } = setup([messageEvent(6, AUTHOR)]);
    await run();

    expect(mockTelegram).toHaveBeenCalledWith(
      MASTER,
      expect.objectContaining({ senderName: 'Alex', conversationUrl: 'https://youdu.ae/order/tx-1' })
    );
    expect(mockPush).toHaveBeenCalledWith(MASTER, 'Alex', expect.any(String), 'tx-1');
  });

  it('stays quiet about messages hours old, as after an outage', async () => {
    const { run, db } = setup([messageEvent(6, MASTER, { createdAt: '2026-09-26T06:00:00Z' })]);
    const result = await run();

    expect(mockTelegram).not.toHaveBeenCalled();
    expect(result.notified).toBe(0);
    expect(db.saveEventCursor).toHaveBeenCalledWith(CURSOR_NAME, 6);
  });

  it('keeps going when one deal cannot be read', async () => {
    const { run, integrationSdk } = setup([messageEvent(6, MASTER), messageEvent(7, MASTER)]);
    integrationSdk.transactions.show.mockRejectedValueOnce(new Error('boom'));
    const result = await run();

    expect(result.failed).toBe(1);
    expect(result.notified).toBe(1);
  });
});
