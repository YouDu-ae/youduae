const mockSend = jest.fn();
const mockUnread = jest.fn();

jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  credential: { cert: jest.fn() },
  messaging: () => ({ sendEachForMulticast: (...args) => mockSend(...args) }),
}));
jest.mock('../db', () => ({
  getDeviceTokens: jest.fn(),
  removeDeviceTokens: jest.fn(async () => {}),
}));
jest.mock('../api-util/unreadConversations', () => ({
  getUnreadConversations: (...args) => mockUnread(...args),
}));

const db = require('../db');
const {
  sendBadgeUpdate,
  sendNewMessageNotification,
  sendNewOfferNotification,
  sendReviewNotification,
  sendNotificationToUser,
} = require('./send-notification');

const ok = () => ({ success: true });
const failed = code => ({ success: false, error: { code } });
const response = (...responses) => ({
  successCount: responses.filter(r => r.success).length,
  responses,
});
const device = (token, extra = {}) => ({ token, platform: 'ios', badge: false, ...extra });

const chatMessage = {
  recipientId: 'author-1',
  senderId: 'master-1',
  senderName: 'Ahmad Said',
  preview: 'Правильно ли я понял?',
  transactionId: 'tx-1',
  messageId: 'msg-1',
  messageCreatedAt: '2026-10-09T10:00:00.000Z',
};

describe('send-notification', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockUnread.mockReset().mockResolvedValue([]);
    db.getDeviceTokens.mockReset().mockResolvedValue([device('token-1')]);
    db.removeDeviceTokens.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  it('names the message, its sender and recipient, and groups pushes by conversation', async () => {
    mockSend.mockResolvedValue(response(ok()));

    const result = await sendNewMessageNotification(chatMessage);

    expect(db.getDeviceTokens).toHaveBeenCalledWith('author-1');
    expect(mockSend).toHaveBeenCalledTimes(1);
    const message = mockSend.mock.calls[0][0];
    expect(message.tokens).toEqual(['token-1']);
    expect(message.notification).toEqual({
      title: 'Новое сообщение от Ahmad Said',
      body: 'Правильно ли я понял?',
    });
    expect(message.data).toEqual({
      type: 'message',
      transactionId: 'tx-1',
      messageId: 'msg-1',
      messageCreatedAt: '2026-10-09T10:00:00.000Z',
      senderUserId: 'master-1',
      recipientUserId: 'author-1',
      dedupeKey: 'push_message_tx-1',
    });
    expect(message.apns.headers).toEqual({ 'apns-priority': '10', 'apns-push-type': 'alert' });
    expect(message.apns.payload.aps).toEqual({ sound: 'default', threadId: 'tx-1' });
    expect(result).toEqual({ success: true, sent: 1 });
  });

  it('sends no badge to a build that does not report reads, and no Flutter click action', async () => {
    mockSend.mockResolvedValue(response(ok()));

    await sendNewMessageNotification(chatMessage);

    const message = mockSend.mock.calls[0][0];
    expect(message.apns.payload.aps).not.toHaveProperty('badge');
    expect(message.data).not.toHaveProperty('click_action');
    expect(mockUnread).not.toHaveBeenCalled();
  });

  it('puts the unread count on the icon of phones that follow it', async () => {
    db.getDeviceTokens.mockResolvedValue([
      device('token-new', { badge: true }),
      device('token-old'),
      device('token-android', { platform: 'android', badge: true }),
    ]);
    mockUnread.mockResolvedValue(['tx-1', 'tx-2']);
    mockSend.mockImplementation(async ({ tokens }) => response(...tokens.map(ok)));

    const result = await sendNewMessageNotification(chatMessage);

    expect(mockUnread).toHaveBeenCalledWith('author-1', undefined);
    expect(mockSend).toHaveBeenCalledTimes(2);
    const [withBadge, without] = mockSend.mock.calls.map(([message]) => message);
    expect(withBadge.tokens).toEqual(['token-new']);
    expect(withBadge.apns.payload.aps).toEqual({ sound: 'default', threadId: 'tx-1', badge: 2 });
    expect(without.tokens).toEqual(['token-old', 'token-android']);
    expect(without.apns.payload.aps).not.toHaveProperty('badge');
    expect(result).toEqual({ success: true, sent: 3 });
  });

  it('still sends the push, without a badge, when the count fails', async () => {
    db.getDeviceTokens.mockResolvedValue([
      device('token-new', { badge: true }),
      device('token-old'),
    ]);
    mockUnread.mockRejectedValue(new Error('Integration API down'));
    mockSend.mockResolvedValue(response(ok(), ok()));

    const result = await sendNewMessageNotification(chatMessage);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].tokens).toEqual(['token-new', 'token-old']);
    expect(mockSend.mock.calls[0][0].apns.payload.aps).not.toHaveProperty('badge');
    expect(result).toEqual({ success: true, sent: 2 });
  });

  it('forgets the tokens Firebase reports as gone', async () => {
    db.getDeviceTokens.mockResolvedValue([device('token-1'), device('token-gone')]);
    mockSend.mockResolvedValue(
      response(ok(), failed('messaging/registration-token-not-registered'))
    );

    const result = await sendNewMessageNotification(chatMessage);

    expect(db.removeDeviceTokens).toHaveBeenCalledWith(['token-gone']);
    expect(result).toEqual({ success: true, sent: 1 });
  });

  it('keeps a token that failed for another reason', async () => {
    mockSend.mockResolvedValue(response(failed('messaging/invalid-argument')));

    const result = await sendNewMessageNotification(chatMessage);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(db.removeDeviceTokens).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, sent: 0 });
  });

  it('retries once a token Firebase could not take for a moment', async () => {
    db.getDeviceTokens.mockResolvedValue([device('token-1'), device('token-2')]);
    mockSend
      .mockResolvedValueOnce(response(ok(), failed('messaging/server-unavailable')))
      .mockResolvedValueOnce(response(ok()));

    const result = await sendNewMessageNotification(chatMessage);

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend.mock.calls[1][0].tokens).toEqual(['token-2']);
    expect(result).toEqual({ success: true, sent: 2 });
  });

  it('retries once when the whole request fails', async () => {
    mockSend
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(response(ok()));

    const result = await sendNewMessageNotification(chatMessage);

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ success: true, sent: 1 });
  });

  it('sends nothing to someone without the app', async () => {
    db.getDeviceTokens.mockResolvedValue([]);

    const result = await sendNotificationToUser('user-1', { title: 't', body: 'b' });

    expect(mockSend).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, reason: 'No device tokens' });
  });

  it("files an offer under the app's single inbox entry for the task", async () => {
    mockSend.mockResolvedValue(response(ok()));

    await sendNewOfferNotification({
      recipientId: 'author-1',
      senderId: 'master-1',
      executorName: 'Ahmad Said',
      listingTitle: 'Установить выключатель',
      listingId: 'listing-1',
      transactionId: 'tx-1',
      price: '150 AED',
    });

    const message = mockSend.mock.calls[0][0];
    expect(message.notification).toEqual({
      title: 'Новый отклик на «Установить выключатель»',
      body: 'Ahmad Said предлагает 150 AED',
    });
    expect(message.data).toEqual({
      type: 'new_offer',
      listingId: 'listing-1',
      transactionId: 'tx-1',
      senderUserId: 'master-1',
      recipientUserId: 'author-1',
      dedupeKey: 'offers_listing-1',
    });
    expect(message.apns.payload.aps.threadId).toBe('tx-1');
  });

  it('names the specialist when an offer has no price', async () => {
    mockSend.mockResolvedValue(response(ok()));

    await sendNewOfferNotification({
      recipientId: 'author-1',
      senderId: 'master-1',
      executorName: 'Ahmad Said',
      listingTitle: 'Установить выключатель',
      listingId: 'listing-1',
      transactionId: 'tx-1',
      price: null,
    });

    expect(mockSend.mock.calls[0][0].notification.body).toBe('Отклик от Ahmad Said');
  });

  it('does not reveal a first review before the recipient leaves theirs', async () => {
    mockSend.mockResolvedValue(response(ok()));

    await sendReviewNotification({
      recipientId: 'master-1',
      reviewerId: 'author-1',
      reviewerName: 'Alex',
      transactionId: 'tx-1',
      published: false,
    });

    const message = mockSend.mock.calls[0][0];
    expect(message.notification).toEqual({
      title: 'Новый отзыв от Alex',
      body: 'Оставьте свой отзыв, чтобы увидеть его.',
    });
    expect(message.data).toMatchObject({
      type: 'review',
      transactionId: 'tx-1',
      senderUserId: 'author-1',
      recipientUserId: 'master-1',
    });
  });

  describe('sendBadgeUpdate', () => {
    it('sets the icon badge silently on the phones that follow the count', async () => {
      const viewedTransactions = { 'tx-1': Date.now() };
      db.getDeviceTokens.mockResolvedValue([
        device('token-new', { badge: true }),
        device('token-old'),
      ]);
      mockUnread.mockResolvedValue(['tx-2']);
      mockSend.mockResolvedValue(response(ok()));

      const result = await sendBadgeUpdate('author-1', { viewedTransactions });

      expect(mockUnread).toHaveBeenCalledWith('author-1', { viewedTransactions });
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend.mock.calls[0][0]).toEqual({
        apns: {
          headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
          payload: { aps: { badge: 1 } },
        },
        tokens: ['token-new'],
      });
      expect(result).toEqual({ success: true, sent: 1, badge: 1 });
    });

    it('clears the badge when nothing is left unread', async () => {
      db.getDeviceTokens.mockResolvedValue([device('token-new', { badge: true })]);
      mockSend.mockResolvedValue(response(ok()));

      await sendBadgeUpdate('author-1');

      expect(mockSend.mock.calls[0][0].apns.payload.aps).toEqual({ badge: 0 });
    });

    it('neither counts nor sends for phones that do not follow the count', async () => {
      const result = await sendBadgeUpdate('author-1');

      expect(mockUnread).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
      expect(result).toEqual({ success: false, reason: 'No badge devices' });
    });

    it('sends nothing when the count fails', async () => {
      db.getDeviceTokens.mockResolvedValue([device('token-new', { badge: true })]);
      mockUnread.mockRejectedValue(new Error('db down'));

      const result = await sendBadgeUpdate('author-1');

      expect(mockSend).not.toHaveBeenCalled();
      expect(result).toEqual({ success: false, reason: 'Unread count failed' });
    });
  });
});
