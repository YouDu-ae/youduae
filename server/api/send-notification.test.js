const mockSend = jest.fn();

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

const db = require('../db');
const {
  sendNewMessageNotification,
  sendReviewNotification,
  sendNotificationToUser,
} = require('./send-notification');

const ok = () => ({ success: true });
const failed = code => ({ success: false, error: { code } });
const response = (...responses) => ({
  successCount: responses.filter(r => r.success).length,
  responses,
});

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
    db.getDeviceTokens.mockReset().mockResolvedValue(['token-1']);
    db.removeDeviceTokens.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
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

  it('sends no fixed badge and no Flutter click action', async () => {
    mockSend.mockResolvedValue(response(ok()));

    await sendNewMessageNotification(chatMessage);

    const message = mockSend.mock.calls[0][0];
    expect(message.apns.payload.aps).not.toHaveProperty('badge');
    expect(message.data).not.toHaveProperty('click_action');
  });

  it('forgets the tokens Firebase reports as gone', async () => {
    db.getDeviceTokens.mockResolvedValue(['token-1', 'token-gone']);
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
    db.getDeviceTokens.mockResolvedValue(['token-1', 'token-2']);
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
});
