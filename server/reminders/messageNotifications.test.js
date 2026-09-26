const mockTelegram = jest.fn();
const mockPush = jest.fn();
const mockEmail = jest.fn();

jest.mock('../api/telegram-bot', () => ({ notifyNewMessage: (...args) => mockTelegram(...args) }));
jest.mock('../api/send-notification', () => ({
  sendNewMessageNotification: (...args) => mockPush(...args),
}));
jest.mock('../api-util/dealEmails', () => ({ sendDealEmail: (...args) => mockEmail(...args) }));

const { processMessageEvents, CURSOR_NAME } = require('./messageNotifications');

const NOW = Date.parse('2026-09-26T14:00:00Z');
const DEAL_CREATED = '2026-09-26T11:57:20Z';
const AUTHOR = 'author-1';
const MASTER = 'master-1';

const messageEvent = (sequenceId, senderId, createdAt = '2026-09-26T13:59:00Z') => ({
  attributes: {
    eventType: 'message/created',
    sequenceId,
    resourceId: `msg-${sequenceId}`,
    createdAt: new Date(createdAt),
    resource: {
      attributes: { content: 'Правильно ли я понял?', createdAt: new Date(createdAt) },
      relationships: {
        sender: { data: { id: { uuid: senderId } } },
        transaction: { data: { id: { uuid: 'tx-1' } } },
      },
    },
  },
});

const offerEvent = (sequenceId, lastTransition = 'transition/inquire') => ({
  attributes: {
    eventType: 'transaction/initiated',
    sequenceId,
    resourceId: 'tx-1',
    createdAt: new Date('2026-09-26T13:59:00Z'),
    resource: { id: { uuid: 'tx-1' }, attributes: { lastTransition } },
  },
});

const user = (id, displayName, emailVerified) => ({
  id: { uuid: id },
  type: 'user',
  attributes: { email: `${id}@example.com`, emailVerified, profile: { displayName } },
});

const setup = (events, { authorVerified = true, masterVerified = true } = {}) => {
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
            attributes: {
              createdAt: new Date(DEAL_CREATED),
              protectedData: { offer: { price: 150, currency: 'AED', comment: 'Сделаю сегодня' } },
            },
            relationships: {
              customer: { data: { id: { uuid: MASTER } } },
              provider: { data: { id: { uuid: AUTHOR } } },
              listing: { data: { id: { uuid: 'listing-1' } } },
            },
          },
          included: [
            user(MASTER, 'Ahmad Said', masterVerified),
            user(AUTHOR, 'Alex', authorVerified),
            { id: { uuid: 'listing-1' }, type: 'listing', attributes: { title: 'Установить выключатель' } },
          ],
        },
      })),
    },
  };
  return { db, integrationSdk, run: () => processMessageEvents({ integrationSdk, db, log: () => {}, now: NOW }) };
};

describe('processMessageEvents', () => {
  beforeEach(() => {
    [mockTelegram, mockPush, mockEmail].forEach(mock => mock.mockReset().mockResolvedValue(true));
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
  });

  it('e-mails a reply to an unverified address, since Sharetribe will not', async () => {
    const { run } = setup([messageEvent(6, MASTER)], { authorVerified: false });
    await run();

    expect(mockEmail).toHaveBeenCalledWith('message', `${AUTHOR}@example.com`, {
      recipientName: 'Alex',
      senderName: 'Ahmad Said',
      listingTitle: 'Установить выключатель',
      preview: 'Правильно ли я понял?',
      conversationUrl: 'https://youdu.ae/sale/tx-1',
    });
  });

  it('leaves e-mail to Sharetribe for a verified address', async () => {
    const { run } = setup([messageEvent(6, MASTER), offerEvent(7)]);
    await run();
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it('treats the opening message of an offer as part of the offer, not a reply', async () => {
    const { integrationSdk, db } = setup([messageEvent(6, MASTER, '2026-09-26T11:57:21Z')], {
      authorVerified: false,
    });
    const result = await processMessageEvents({
      integrationSdk,
      db,
      log: () => {},
      now: Date.parse('2026-09-26T11:58:00Z'),
    });

    expect(result.notified).toBe(0);
    expect(mockTelegram).not.toHaveBeenCalled();
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it('e-mails a new offer to an unverified task author', async () => {
    const { run } = setup([offerEvent(7)], { authorVerified: false });
    const result = await run();

    expect(mockEmail).toHaveBeenCalledWith('offer', `${AUTHOR}@example.com`, {
      recipientName: 'Alex',
      listingTitle: 'Установить выключатель',
      executorName: 'Ahmad Said',
      price: 150,
      currency: 'AED',
      comment: 'Сделаю сегодня',
      listingUrl: 'https://youdu.ae/l/listing-1',
    });
    expect(mockTelegram).not.toHaveBeenCalled();
    expect(result.notified).toBe(1);
  });

  it('stays quiet about events hours old, as after an outage', async () => {
    const { run, db } = setup([messageEvent(6, MASTER, '2026-09-26T06:00:00Z')]);
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
