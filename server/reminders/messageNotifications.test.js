const mockTelegram = jest.fn();
const mockOfferTelegram = jest.fn();
const mockPush = jest.fn();
const mockOfferPush = jest.fn();
const mockReviewPush = jest.fn();
const mockEmail = jest.fn();

jest.mock('../api/telegram-bot', () => ({
  notifyNewMessage: (...args) => mockTelegram(...args),
  notifyNewOffer: (...args) => mockOfferTelegram(...args),
}));
jest.mock('../api/send-notification', () => ({
  sendNewMessageNotification: (...args) => mockPush(...args),
  sendNewOfferNotification: (...args) => mockOfferPush(...args),
  sendReviewNotification: (...args) => mockReviewPush(...args),
}));
jest.mock('../api-util/dealEmails', () => ({
  ...jest.requireActual('../api-util/dealEmails'),
  sendDealEmail: (...args) => mockEmail(...args),
}));

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

// messages/query as Sharetribe answers it, with one photo in the given state or none.
const messageResource = (id, photo) => ({
  id: { uuid: id },
  type: 'message',
  attributes: {
    content: 'Правильно ли я понял?',
    createdAt: new Date('2026-09-26T13:59:00Z'),
    deleted: false,
  },
  relationships: {
    sender: { data: { id: { uuid: MASTER }, type: 'user' } },
    transaction: { data: { id: { uuid: 'tx-1' }, type: 'transaction' } },
    publicFileAttachments: {
      data: photo ? [{ id: { uuid: `att-${id}` }, type: 'fileAttachment' }] : [],
    },
  },
});

const photoResources = (id, photo) => [
  {
    id: { uuid: `att-${id}` },
    type: 'fileAttachment',
    attributes: { scope: 'public', deleted: false },
    relationships: { file: { data: { id: { uuid: `file-${id}` }, type: 'file' } } },
  },
  { id: { uuid: `file-${id}` }, type: 'file', attributes: { state: photo, deleted: false } },
];

const setup = (
  events,
  {
    authorVerified = true,
    masterVerified = true,
    blocked = false,
    alreadySent = false,
    photo = null,
    waits = [],
  } = {}
) => {
  const photoFile = { state: photo };
  const db = {
    getOrStartEventCursor: jest.fn(async () => ({ sequenceId: 5, updatedAt: new Date() })),
    saveEventCursor: jest.fn(async () => {}),
    hasBlocked: jest.fn(async () => blocked),
    claimReminder: jest.fn(async () => !alreadySent),
    unhideConversationForAll: jest.fn(async () => 0),
    recordReceivedMessage: jest.fn(async () => {}),
    setReceivedMessageTransition: jest.fn(async () => {}),
    waitForMessagePhotos: jest.fn(async () => {}),
    getMessagePhotoWaits: jest.fn(async () => waits),
    stopWaitingForMessagePhotos: jest.fn(async () => {}),
  };
  const integrationSdk = {
    events: { query: jest.fn(async () => ({ data: { data: events, meta: { perPage: 100 } } })) },
    messages: {
      query: jest.fn(async ({ ids }) => {
        const messageIds = ids.split(',');
        return {
          data: {
            data: messageIds.map(id => messageResource(id, photoFile.state)),
            included: photoFile.state
              ? messageIds.flatMap(id => photoResources(id, photoFile.state))
              : [],
          },
        };
      }),
    },
    transactions: {
      show: jest.fn(async () => ({
        data: {
          data: {
            attributes: {
              createdAt: new Date(DEAL_CREATED),
              lastTransition: 'transition/accept-offer',
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
  return {
    db,
    integrationSdk,
    photoFile,
    run: () => processMessageEvents({ integrationSdk, db, log: () => {}, now: NOW }),
  };
};

describe('processMessageEvents', () => {
  beforeEach(() => {
    [mockTelegram, mockOfferTelegram, mockPush, mockOfferPush, mockReviewPush, mockEmail].forEach(
      mock => mock.mockReset().mockResolvedValue(true)
    );
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
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({
      recipientId: AUTHOR,
      senderId: MASTER,
      senderName: 'Ahmad Said',
      preview: 'Правильно ли я понял?',
      transactionId: 'tx-1',
      messageId: 'msg-6',
      messageCreatedAt: '2026-09-26T13:59:00.000Z',
    });
    expect(result.notified).toBe(1);
    expect(db.saveEventCursor).toHaveBeenCalledWith(CURSOR_NAME, 6);
  });

  it('notifies about a message once, even when the poller reads it again', async () => {
    const { run, db } = setup([messageEvent(6, MASTER)], { alreadySent: true });
    const result = await run();

    expect(db.claimReminder).toHaveBeenCalledWith({
      reminderType: 'chat-message',
      subjectId: 'msg-6',
      recipientUserId: AUTHOR,
    });
    expect(mockTelegram).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(db.unhideConversationForAll).not.toHaveBeenCalled();
    expect(db.recordReceivedMessage).not.toHaveBeenCalled();
    expect(result.notified).toBe(0);
  });

  it('counts the message as unread for the recipient before the push goes out', async () => {
    const { run, db } = setup([messageEvent(6, MASTER)]);
    await run();

    expect(db.recordReceivedMessage).toHaveBeenCalledWith({
      userId: AUTHOR,
      transactionId: 'tx-1',
      senderId: MASTER,
      sentAt: Date.parse('2026-09-26T13:59:00Z'),
      lastTransition: 'transition/accept-offer',
    });
    expect(db.recordReceivedMessage.mock.invocationCallOrder[0]).toBeLessThan(
      mockPush.mock.invocationCallOrder[0]
    );
  });

  it('still notifies when the message cannot be counted', async () => {
    const { run, db } = setup([messageEvent(6, MASTER)]);
    db.recordReceivedMessage.mockRejectedValueOnce(new Error('db down'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = await run();
    error.mockRestore();

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ notified: 1, failed: 0 });
  });

  it('brings a hidden conversation back to the chat lists with a new message', async () => {
    const { run, db } = setup([messageEvent(6, MASTER)]);
    await run();

    expect(db.unhideConversationForAll).toHaveBeenCalledWith('tx-1');
  });

  it('still notifies when the conversation cannot be brought back', async () => {
    const { run, db } = setup([messageEvent(6, MASTER)]);
    db.unhideConversationForAll.mockRejectedValueOnce(new Error('db down'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = await run();
    error.mockRestore();

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ notified: 1, failed: 0 });
  });

  it('stays silent about messages from someone the recipient blocked', async () => {
    const { run, db } = setup([messageEvent(6, MASTER)], { authorVerified: false, blocked: true });
    const result = await run();

    expect(db.hasBlocked).toHaveBeenCalledWith(AUTHOR, MASTER);
    expect(mockTelegram).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockEmail).not.toHaveBeenCalled();
    expect(db.unhideConversationForAll).not.toHaveBeenCalled();
    expect(db.recordReceivedMessage).not.toHaveBeenCalled();
    expect(result.notified).toBe(0);
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
    expect(db.recordReceivedMessage).not.toHaveBeenCalled();
  });

  it('tells the task author about a new offer in Telegram and by push', async () => {
    const { run } = setup([offerEvent(7)]);
    const result = await run();

    expect(mockOfferTelegram).toHaveBeenCalledTimes(1);
    expect(mockOfferTelegram).toHaveBeenCalledWith(AUTHOR, {
      listingTitle: 'Установить выключатель',
      executorName: 'Ahmad Said',
      offerPrice: '150 AED',
      listingUrl: 'https://youdu.ae/l/listing-1',
    });
    expect(mockOfferPush).toHaveBeenCalledTimes(1);
    expect(mockOfferPush).toHaveBeenCalledWith({
      recipientId: AUTHOR,
      senderId: MASTER,
      executorName: 'Ahmad Said',
      listingTitle: 'Установить выключатель',
      listingId: 'listing-1',
      transactionId: 'tx-1',
      price: '150 AED',
    });
    expect(mockTelegram).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockEmail).not.toHaveBeenCalled();
    expect(result.notified).toBe(1);
  });

  it('tells the author about an offer once, even when the poller reads it again', async () => {
    const { run, db } = setup([offerEvent(7)], { authorVerified: false, alreadySent: true });
    const result = await run();

    expect(db.claimReminder).toHaveBeenCalledWith({
      reminderType: 'new-offer',
      subjectId: 'tx-1',
      recipientUserId: AUTHOR,
    });
    expect(mockOfferTelegram).not.toHaveBeenCalled();
    expect(mockOfferPush).not.toHaveBeenCalled();
    expect(mockEmail).not.toHaveBeenCalled();
    expect(result.notified).toBe(0);
  });

  it('e-mails a new offer to an unverified task author as well', async () => {
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
    expect(mockOfferTelegram).toHaveBeenCalledTimes(1);
    expect(result.notified).toBe(1);
  });

  it('stays silent about an offer from someone the author blocked', async () => {
    const { run, db } = setup([offerEvent(7)], { authorVerified: false, blocked: true });
    const result = await run();

    expect(db.hasBlocked).toHaveBeenCalledWith(AUTHOR, MASTER);
    expect(mockOfferTelegram).not.toHaveBeenCalled();
    expect(mockOfferPush).not.toHaveBeenCalled();
    expect(mockEmail).not.toHaveBeenCalled();
    expect(result.notified).toBe(0);
  });

  it('still e-mails the author when the Telegram delivery fails', async () => {
    mockOfferTelegram.mockRejectedValueOnce(new Error('Telegram down'));
    const { run } = setup([offerEvent(7)], { authorVerified: false });
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = await run();
    error.mockRestore();

    expect(mockEmail).toHaveBeenCalledWith('offer', `${AUTHOR}@example.com`, expect.anything());
    expect(result).toMatchObject({ notified: 1, failed: 0 });
  });

  const transitioned = (sequenceId, lastTransition) => ({
    attributes: {
      eventType: 'transaction/transitioned',
      sequenceId,
      resourceId: 'tx-1',
      createdAt: new Date('2026-09-26T13:59:00Z'),
      resource: { id: { uuid: 'tx-1' }, attributes: { lastTransition } },
    },
  });

  it('tells an unverified specialist by e-mail that they were chosen', async () => {
    const { run } = setup([transitioned(8, 'transition/accept-offer')], { masterVerified: false });
    await run();

    expect(mockEmail).toHaveBeenCalledWith('transition', `${MASTER}@example.com`, {
      transition: 'transition/accept-offer',
      recipientName: 'Ahmad Said',
      otherName: 'Alex',
      listingTitle: 'Установить выключатель',
      transactionId: 'tx-1',
    });
  });

  it("e-mails the specialist's review to an unverified task author", async () => {
    const { run } = setup([transitioned(8, 'transition/review-1-by-customer')], {
      authorVerified: false,
    });
    await run();

    expect(mockEmail).toHaveBeenCalledWith(
      'transition',
      `${AUTHOR}@example.com`,
      expect.objectContaining({ transition: 'transition/review-1-by-customer', otherName: 'Ahmad Said' })
    );
  });

  it('sends nothing for verified recipients or steps without a letter', async () => {
    const { run } = setup([
      transitioned(8, 'transition/accept-offer'),
      transitioned(9, 'transition/expire-review-period'),
    ]);
    await run();
    expect(mockEmail).not.toHaveBeenCalled();
    expect(mockReviewPush).not.toHaveBeenCalled();
  });

  it('keeps the unread count in step with the deal, with a letter or without', async () => {
    const { run, db } = setup([
      transitioned(8, 'transition/accept-offer'),
      transitioned(9, 'transition/expire-review-period'),
    ]);
    await run();

    expect(db.setReceivedMessageTransition.mock.calls).toEqual([
      ['tx-1', 'transition/accept-offer'],
      ['tx-1', 'transition/expire-review-period'],
    ]);
  });

  it("pushes the author's first review to the specialist, still hidden", async () => {
    const { run } = setup([transitioned(8, 'transition/review-1-by-provider')]);
    const result = await run();

    expect(mockReviewPush).toHaveBeenCalledWith({
      recipientId: MASTER,
      reviewerId: AUTHOR,
      reviewerName: 'Alex',
      transactionId: 'tx-1',
      published: false,
    });
    expect(mockEmail).not.toHaveBeenCalled();
    expect(result.notified).toBe(1);
  });

  it('tells the task author that both reviews are published', async () => {
    const { run } = setup([transitioned(8, 'transition/review-2-by-customer')]);
    await run();

    expect(mockReviewPush).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: AUTHOR, reviewerName: 'Ahmad Said', published: true })
    );
  });

  it('pushes a review once, even when the poller reads it again', async () => {
    const { run, db } = setup([transitioned(8, 'transition/review-1-by-customer')], {
      alreadySent: true,
    });
    const result = await run();

    expect(db.claimReminder).toHaveBeenCalledWith({
      reminderType: 'review-push',
      subjectId: 'tx-1:transition/review-1-by-customer',
      recipientUserId: AUTHOR,
    });
    expect(mockReviewPush).not.toHaveBeenCalled();
    expect(result.notified).toBe(0);
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

  it('tells about a photo only once Sharetribe has checked it', async () => {
    const { run, db, integrationSdk, photoFile } = setup([messageEvent(6, MASTER)], {
      photo: 'pendingVerification',
    });
    const first = await run();

    expect(integrationSdk.messages.query).toHaveBeenCalledWith({
      ids: 'msg-6',
      include: ['publicFileAttachments', 'publicFileAttachments.file'],
    });
    expect(db.waitForMessagePhotos).toHaveBeenCalledWith('msg-6');
    expect(db.claimReminder).not.toHaveBeenCalled();
    expect(db.recordReceivedMessage).not.toHaveBeenCalled();
    expect(mockTelegram).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(first.notified).toBe(0);

    photoFile.state = 'available';
    db.getMessagePhotoWaits.mockResolvedValue([
      { messageId: 'msg-6', waitingSince: new Date(NOW - 15000) },
    ]);
    integrationSdk.events.query.mockResolvedValue({ data: { data: [], meta: { perPage: 100 } } });
    const second = await run();

    expect(db.stopWaitingForMessagePhotos).toHaveBeenCalledWith('msg-6');
    expect(mockTelegram).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: AUTHOR, messageId: 'msg-6', transactionId: 'tx-1' })
    );
    expect(db.recordReceivedMessage).toHaveBeenCalledTimes(1);
    expect(second.notified).toBe(1);
  });

  it('never tells about a photo that failed the check', async () => {
    const { run, db } = setup([messageEvent(6, MASTER)], {
      authorVerified: false,
      photo: 'verificationFailed',
    });
    const result = await run();

    expect(db.waitForMessagePhotos).not.toHaveBeenCalled();
    expect(db.claimReminder).not.toHaveBeenCalled();
    expect(mockTelegram).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockEmail).not.toHaveBeenCalled();
    expect(result.notified).toBe(0);
  });

  it('keeps waiting for a photo being checked, and gives up after 30 minutes', async () => {
    const { run, db } = setup([], {
      photo: 'pendingVerification',
      waits: [{ messageId: 'msg-6', waitingSince: new Date(NOW - 20 * 1000) }],
    });
    await run();
    expect(db.stopWaitingForMessagePhotos).not.toHaveBeenCalled();

    db.getMessagePhotoWaits.mockResolvedValue([
      { messageId: 'msg-6', waitingSince: new Date(NOW - 31 * 60 * 1000) },
    ]);
    await run();
    expect(db.stopWaitingForMessagePhotos).toHaveBeenCalledWith('msg-6');
    expect(mockTelegram).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('stops waiting for a photo that failed the check, without telling', async () => {
    const { run, db } = setup([], {
      photo: 'verificationFailed',
      waits: [{ messageId: 'msg-6', waitingSince: new Date(NOW - 20 * 1000) }],
    });
    const result = await run();

    expect(db.stopWaitingForMessagePhotos).toHaveBeenCalledWith('msg-6');
    expect(mockPush).not.toHaveBeenCalled();
    expect(result.notified).toBe(0);
  });

  it('still tells about a message whose photos cannot be checked', async () => {
    const { run, db, integrationSdk } = setup([messageEvent(6, MASTER)], {
      photo: 'pendingVerification',
    });
    integrationSdk.messages.query.mockRejectedValueOnce(new Error('Integration API down'));
    const result = await run();

    expect(db.waitForMessagePhotos).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(result.notified).toBe(1);
  });

  it('still reads new messages when the waiting photos cannot be checked', async () => {
    const { run, integrationSdk } = setup([messageEvent(6, MASTER)], {
      waits: [{ messageId: 'msg-5', waitingSince: new Date(NOW - 20 * 1000) }],
    });
    integrationSdk.messages.query.mockRejectedValueOnce(new Error('Integration API down'));
    const result = await run();

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ messageId: 'msg-6' }));
    expect(result.notified).toBe(1);
  });

  it('logs when the push left, by message id and without the text', async () => {
    mockPush.mockResolvedValueOnce({ success: true, sent: 1 });
    const { integrationSdk, db } = setup([messageEvent(6, MASTER)]);
    const log = jest.fn();
    await processMessageEvents({ integrationSdk, db, log, now: NOW });

    const lines = log.mock.calls.map(([line]) => line);
    const line = lines.find(text => text.startsWith('[messages] msg-6: push'));
    expect(line).toMatch(
      /^\[messages\] msg-6: push через \d+\.\d с после сообщения, FCM принял для 1 устр\.$/
    );
    expect(lines.join('\n')).not.toContain('Правильно ли я понял');
  });
});
