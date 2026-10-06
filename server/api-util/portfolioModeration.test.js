const mockShow = jest.fn();
const mockQuery = jest.fn();
const mockUpdateProfile = jest.fn();

jest.mock('sharetribe-flex-integration-sdk', () => ({
  createInstance: () => ({
    users: {
      show: (...args) => mockShow(...args),
      query: (...args) => mockQuery(...args),
      updateProfile: (...args) => mockUpdateProfile(...args),
    },
  }),
}));

const {
  applyDecision,
  handleCallback,
  notifyNewPhotos,
  parseCallbackData,
  photoKey,
  sendPendingPhotos,
} = require('./portfolioModeration');

const ADMIN_CHAT = '111222333';
const originalFetch = global.fetch;

let telegram;
let telegramReplies;

// Each test uses its own specialist: a photo is announced only once per process.
let nextUser = 1;
const newUserId = () => `00000000-0000-4000-8000-${String(nextUser++).padStart(12, '0')}`;

const photo = (n, status = 'pending') => ({
  imageId: `img-${n}`,
  imageUrl: `https://sharetribe.imgix.net/p${n}.jpg?w=2400&s=abc`,
  status,
});

const userResponse = (userId, portfolio, attributes = {}) => ({
  data: {
    data: {
      id: { uuid: userId },
      type: 'user',
      attributes: {
        banned: false,
        deleted: false,
        profile: { displayName: 'Мохамед <Х>', publicData: { portfolio } },
        ...attributes,
      },
    },
  },
});

const calls = method => telegram.filter(call => call.method === method).map(call => call.body);

const tap = (data, message = {}) => ({
  id: 'query-1',
  from: { id: Number(ADMIN_CHAT) },
  data,
  message: {
    chat: { id: Number(ADMIN_CHAT) },
    message_id: 42,
    date: 1759750000,
    photo: [{ file_id: 'x' }],
    caption: '📸 Фото в портфолио на модерацию\n👤 Мохамед <Х>',
    caption_entities: [{ type: 'bold', offset: 3, length: 31 }],
    ...message,
  },
});

const buttonsOf = body => body.reply_markup.inline_keyboard[0];

beforeEach(() => {
  process.env.TELEGRAM_ADMIN_CHAT_ID = ADMIN_CHAT;
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  telegram = [];
  telegramReplies = {};
  global.fetch = jest.fn(async (url, options) => {
    const method = url.split('/').pop();
    telegram.push({ method, body: JSON.parse(options.body) });
    return { json: async () => telegramReplies[method] || { ok: true, result: {} } };
  });
  // The pauses between photos would make every test take seconds.
  jest.spyOn(global, 'setTimeout').mockImplementation(callback => {
    callback();
    return 0;
  });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockShow.mockReset();
  mockQuery.mockReset();
  mockUpdateProfile.mockReset().mockResolvedValue({});
});

afterEach(() => {
  jest.restoreAllMocks();
  global.fetch = originalFetch;
});

describe('announcing new photos', () => {
  it('sends each new photo to the admin chat with approve and reject buttons', async () => {
    const userId = newUserId();
    mockShow.mockResolvedValue(userResponse(userId, [photo(1, 'approved'), photo(2), photo(3)]));

    const result = await notifyNewPhotos(userId, { imageIds: ['img-2', 'img-3'] });

    expect(result).toEqual({ sent: 2, total: 2 });
    const sent = calls('sendPhoto');
    expect(sent.map(body => body.photo)).toEqual([photo(2).imageUrl, photo(3).imageUrl]);
    expect(sent[0].chat_id).toBe(ADMIN_CHAT);
    expect(sent[0].caption).toContain('· 1 из 2');
    expect(sent[0].caption).toContain(
      `<a href="https://youdu.ae/u/${userId}">Мохамед &lt;Х&gt;</a>`
    );
    expect(buttonsOf(sent[0]).map(button => button.text)).toEqual(['✅ Одобрить', '❌ Отклонить']);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);
  });

  it('puts the specialist, the photo and the decision into button data Telegram accepts', async () => {
    const userId = newUserId();
    mockShow.mockResolvedValue(userResponse(userId, [photo(2)]));

    await notifyNewPhotos(userId, { imageIds: ['img-2'] });

    const [approve, reject] = buttonsOf(calls('sendPhoto')[0]).map(button => button.callback_data);
    expect(Buffer.byteLength(approve)).toBeLessThanOrEqual(64);
    expect(parseCallbackData(approve)).toEqual({
      action: 'approve',
      userId,
      key: photoKey(photo(2)),
    });
    expect(parseCallbackData(reject)).toEqual({
      action: 'reject',
      userId,
      key: photoKey(photo(2)),
    });
  });

  it('sends only pending photos that really are in this specialist portfolio', async () => {
    const userId = newUserId();
    mockShow.mockResolvedValue(userResponse(userId, [photo(1, 'approved'), photo(2)]));

    const result = await notifyNewPhotos(userId, { imageIds: ['img-1', 'img-9'] });

    expect(result).toEqual({ sent: 0, total: 0 });
    expect(calls('sendPhoto')).toHaveLength(0);
  });

  it('takes the latest pending photos when an older page reports only a count', async () => {
    const userId = newUserId();
    mockShow.mockResolvedValue(userResponse(userId, [photo(1), photo(2), photo(3)]));

    await notifyNewPhotos(userId, { photosCount: 1 });

    expect(calls('sendPhoto').map(body => body.photo)).toEqual([photo(3).imageUrl]);
  });

  it('does not announce the same photo twice when the profile is saved again', async () => {
    const userId = newUserId();
    mockShow.mockResolvedValue(userResponse(userId, [photo(2)]));

    await notifyNewPhotos(userId, { imageIds: ['img-2'] });
    const again = await notifyNewPhotos(userId, { imageIds: ['img-2'] });

    expect(again).toEqual({ sent: 0, total: 0 });
    expect(calls('sendPhoto')).toHaveLength(1);
  });

  it('sends a link with the same buttons when Telegram cannot fetch the photo', async () => {
    const userId = newUserId();
    mockShow.mockResolvedValue(userResponse(userId, [photo(2)]));
    telegramReplies.sendPhoto = {
      ok: false,
      error_code: 400,
      description: 'failed to get HTTP URL content',
    };

    const result = await notifyNewPhotos(userId, { imageIds: ['img-2'] });

    expect(result.sent).toBe(1);
    const [fallback] = calls('sendMessage');
    expect(fallback.text).toContain(
      '<a href="https://sharetribe.imgix.net/p2.jpg?w=2400&amp;s=abc">Открыть фото →</a>'
    );
    expect(buttonsOf(fallback)).toEqual(buttonsOf(calls('sendPhoto')[0]));
  });

  it('does nothing without an admin chat', async () => {
    delete process.env.TELEGRAM_ADMIN_CHAT_ID;

    expect(await notifyNewPhotos(newUserId(), { imageIds: ['img-2'] })).toEqual({
      sent: 0,
      total: 0,
    });
    expect(mockShow).not.toHaveBeenCalled();
  });
});

describe('a tap on a moderation button', () => {
  const buttonData = (action, userId, item) => `pf:${action}:${userId}:${photoKey(item)}`;

  it('approves the photo, confirms the tap and replaces the buttons with the decision', async () => {
    const userId = newUserId();
    mockShow.mockResolvedValue(userResponse(userId, [photo(2), photo(3)]));
    const query = tap(buttonData('a', userId, photo(3)));

    expect(await handleCallback(query)).toEqual({ outcome: 'approved' });

    expect(mockUpdateProfile).toHaveBeenCalledWith({
      id: userId,
      publicData: { portfolio: [photo(2), { ...photo(3), status: 'approved' }] },
    });
    expect(calls('answerCallbackQuery')).toEqual([
      { callback_query_id: 'query-1', text: 'Одобрено' },
    ]);
    const [edit] = calls('editMessageCaption');
    expect(edit).toMatchObject({
      chat_id: Number(ADMIN_CHAT),
      message_id: 42,
      caption_entities: query.message.caption_entities,
      reply_markup: { inline_keyboard: [] },
    });
    expect(edit.caption).toBe(
      `${query.message.caption}\n\n✅ Одобрено: фото видно в профиле на сайте и в приложении`
    );
  });

  it('removes a rejected photo, clearing the portfolio when it was the last one', async () => {
    const userId = newUserId();
    mockShow.mockResolvedValue(userResponse(userId, [photo(3)]));

    expect(await handleCallback(tap(buttonData('r', userId, photo(3))))).toEqual({
      outcome: 'rejected',
    });

    expect(mockUpdateProfile).toHaveBeenCalledWith({ id: userId, publicData: { portfolio: null } });
    expect(calls('editMessageCaption')[0].caption).toContain(
      '❌ Отклонено: фото удалено из портфолио'
    );
  });

  it('writes nothing when the photo is already approved or no longer there', async () => {
    const userId = newUserId();
    mockShow.mockResolvedValue(userResponse(userId, [photo(3, 'approved')]));

    expect(await handleCallback(tap(buttonData('a', userId, photo(3))))).toEqual({
      outcome: 'already-approved',
    });
    expect(await handleCallback(tap(buttonData('r', userId, photo(4))))).toEqual({
      outcome: 'missing',
    });

    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(calls('answerCallbackQuery').map(body => body.text)).toEqual([
      'Уже одобрено',
      'Этого фото уже нет',
    ]);
  });

  it('treats a deleted specialist as a photo that is gone', async () => {
    mockShow.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));

    expect(await handleCallback(tap(buttonData('a', newUserId(), photo(3))))).toEqual({
      outcome: 'missing',
    });
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('keeps the buttons and shows an alert when the decision cannot be saved', async () => {
    const userId = newUserId();
    mockShow.mockResolvedValue(userResponse(userId, [photo(3)]));
    mockUpdateProfile.mockRejectedValue(
      Object.assign(new Error('Too Many Requests'), { status: 429 })
    );

    expect(await handleCallback(tap(buttonData('a', userId, photo(3))))).toEqual({
      outcome: 'error',
    });

    expect(calls('answerCallbackQuery')[0]).toMatchObject({ show_alert: true });
    expect(calls('editMessageCaption')).toHaveLength(0);
  });

  it('ignores taps that come from another chat or carry foreign data', async () => {
    const userId = newUserId();

    await handleCallback(tap(buttonData('a', userId, photo(3)), { chat: { id: 999 } }));
    await handleCallback(tap('something-else'));

    expect(mockShow).not.toHaveBeenCalled();
    expect(calls('answerCallbackQuery')).toEqual([
      { callback_query_id: 'query-1' },
      { callback_query_id: 'query-1' },
    ]);
  });

  it('still saves the decision when the message is no longer accessible', async () => {
    const userId = newUserId();
    mockShow.mockResolvedValue(userResponse(userId, [photo(3)]));

    await handleCallback(tap(buttonData('a', userId, photo(3)), { date: 0, photo: undefined }));

    expect(mockUpdateProfile).toHaveBeenCalled();
    expect(calls('editMessageCaption')).toHaveLength(0);
    expect(calls('editMessageText')).toHaveLength(0);
  });

  it('edits the text of a link message sent instead of a photo', async () => {
    const userId = newUserId();
    mockShow.mockResolvedValue(userResponse(userId, [photo(3)]));

    await handleCallback(
      tap(buttonData('a', userId, photo(3)), { photo: undefined, caption: undefined, text: 'Фото' })
    );

    expect(calls('editMessageText')[0].text).toContain('Фото\n\n✅ Одобрено');
  });
});

describe('applyDecision', () => {
  it('finds photos added by hand in Console without an image id', () => {
    const manual = { imageUrl: 'https://sharetribe.imgix.net/manual.jpg', status: 'pending' };

    expect(applyDecision([manual], photoKey(manual), 'approve')).toEqual({
      outcome: 'approved',
      portfolio: [{ ...manual, status: 'approved' }],
    });
  });
});

describe('/portfolio', () => {
  const queryResponse = users => ({
    data: { data: users, meta: { totalPages: 1, totalItems: users.length } },
  });

  it('sends the waiting photos ten at a time with a summary', async () => {
    const first = newUserId();
    const second = newUserId();
    const banned = newUserId();
    mockQuery.mockResolvedValue(
      queryResponse([
        userResponse(first, [photo(1, 'approved'), ...[2, 3, 4, 5, 6, 7, 8].map(n => photo(n))])
          .data.data,
        userResponse(second, [11, 12, 13, 14, 15].map(n => photo(n))).data.data,
        userResponse(banned, [photo(21), photo(22)], { banned: true }).data.data,
      ])
    );

    expect(await sendPendingPhotos(ADMIN_CHAT)).toEqual({ sent: 10, total: 12 });

    const messages = calls('sendMessage').map(body => body.text);
    expect(messages[0]).toBe('🖼 <b>Ждут модерации: 12 фото у 2 мастеров</b>\nПрисылаю первые 10.');
    expect(messages[1]).toBe('Ещё 2 фото. Когда разберёте эти, отправьте /portfolio снова.');
    const photos = calls('sendPhoto');
    expect(photos).toHaveLength(10);
    expect(photos[0].caption).toContain('· 1 из 7');
    expect(photos[7].caption).toContain('· 1 из 5');
  });

  it('says so when nothing is waiting', async () => {
    mockQuery.mockResolvedValue(
      queryResponse([userResponse(newUserId(), [photo(1, 'approved')]).data.data])
    );

    expect(await sendPendingPhotos(ADMIN_CHAT)).toEqual({ sent: 0, total: 0 });
    expect(calls('sendMessage').map(body => body.text)).toEqual(['✅ Фото на модерации нет']);
  });
});
