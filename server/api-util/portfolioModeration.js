/**
 * Portfolio moderation from the admin Telegram chat.
 *
 * Photos a specialist uploads on the website are saved to
 * `publicData.portfolio` as `pending` and stay hidden until approved. Each new
 * photo is sent to the admin chat with «Одобрить» / «Отклонить» buttons, and a
 * tap writes the decision back to the specialist's profile.
 */

const crypto = require('crypto');
const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const { queryAllPages } = require('./paginate');

const ROOT_URL = 'https://youdu.ae';

// callback_data is limited to 64 bytes: "pf:a:" + user UUID + ":" + key fits.
const KEY_LENGTH = 12;
const CALLBACK_PATTERN = /^pf:([ar]):([0-9a-f-]{36}):([0-9a-f]{12})$/;

// Telegram asks bots to stay at about one message per second in a single chat.
const SEND_DELAY_MS = 1000;
const BATCH_SIZE = 10;

// Saving the profile again must not announce the same photo twice.
const ANNOUNCE_TTL_MS = 24 * 60 * 60 * 1000;
const announced = new Map();

let integrationSdkInstance = null;

// Built on first use: creating it at module load crashes the whole API router
// in environments where the credentials are absent.
const getIntegrationSdk = () => {
  if (!integrationSdkInstance) {
    integrationSdkInstance = sharetribeIntegrationSdk.createInstance({
      clientId: process.env.INTEGRATION_API_CLIENT_ID,
      clientSecret: process.env.INTEGRATION_API_CLIENT_SECRET,
    });
  }
  return integrationSdkInstance;
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const escapeHtml = value =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** «1 мастера», «2 мастеров», «21 мастера»: the form that follows «у». */
const mastersCount = count =>
  `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'мастера' : 'мастеров'}`;

// The website's uploader treats a photo without a status as pending too.
const awaitsModeration = item =>
  !!item &&
  (item.status === 'pending' || !item.status) &&
  typeof item.imageUrl === 'string' &&
  item.imageUrl.startsWith('https://');

const photoKey = item =>
  crypto
    .createHash('sha1')
    .update(String(item.imageId || item.imageUrl))
    .digest('hex')
    .slice(0, KEY_LENGTH);

const callbackData = (action, userId, key) => `pf:${action}:${userId}:${key}`;

const parseCallbackData = data => {
  const match = CALLBACK_PATTERN.exec(String(data || ''));
  if (!match) {
    return null;
  }
  return { action: match[1] === 'a' ? 'approve' : 'reject', userId: match[2], key: match[3] };
};

/** Photos awaiting a decision, each once even when the portfolio holds copies. */
const pendingPhotosOf = portfolio => {
  const seen = new Set();
  return portfolio.filter(item => {
    if (!awaitsModeration(item) || seen.has(photoKey(item))) {
      return false;
    }
    seen.add(photoKey(item));
    return true;
  });
};

/**
 * The portfolio after the moderator's decision, and what the decision did.
 *
 * A rejected photo is removed rather than marked: the website knows only
 * `pending` and `approved`, and public data stays readable through the API.
 * A portfolio can hold copies of one photo: they share the decision, and
 * approving keeps a single copy.
 */
const applyDecision = (portfolio, key, action) => {
  const items = Array.isArray(portfolio) ? portfolio : [];
  const isTarget = item => !!item && typeof item === 'object' && photoKey(item) === key;
  const copies = items.filter(isTarget);

  if (copies.length === 0) {
    return { outcome: 'missing', portfolio: items };
  }
  if (action === 'reject') {
    return { outcome: 'rejected', portfolio: items.filter(item => !isTarget(item)) };
  }
  if (copies.length === 1 && copies[0].status === 'approved') {
    return { outcome: 'already-approved', portfolio: items };
  }
  const first = items.findIndex(isTarget);
  return {
    outcome: 'approved',
    portfolio: items.flatMap((item, i) => {
      if (!isTarget(item)) {
        return [item];
      }
      return i === first ? [{ ...item, status: 'approved' }] : [];
    }),
  };
};

const callTelegram = async (method, body) => {
  const send = async () => {
    const response = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    return response.json();
  };

  try {
    let data = await send();
    // A batch of photos can trip the per-chat limit; Telegram says when to retry.
    if (data?.error_code === 429) {
      await sleep(Math.min(data.parameters?.retry_after || 1, 10) * 1000);
      data = await send();
    }
    if (!data?.ok) {
      console.error(`Telegram ${method} failed:`, data?.error_code, data?.description);
    }
    return data;
  } catch (error) {
    console.error(`Telegram ${method} failed:`, error.message);
    return { ok: false, description: error.message };
  }
};

const nameOf = profile =>
  profile.displayName ||
  [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
  'Без имени';

const portfolioOf = profile =>
  Array.isArray(profile.publicData?.portfolio) ? profile.publicData.portfolio : [];

const loadSpecialist = async userId => {
  const response = await getIntegrationSdk().users.show({ id: userId });
  const profile = response.data.data.attributes.profile || {};
  return { userName: nameOf(profile), portfolio: portfolioOf(profile) };
};

const sendPhotoForModeration = async (chatId, { userId, userName, item, position, total }) => {
  const key = photoKey(item);
  const counter = total > 1 ? ` · ${position} из ${total}` : '';
  const caption =
    `📸 <b>Фото в портфолио на модерацию</b>${counter}\n` +
    `👤 <a href="${ROOT_URL}/u/${userId}">${escapeHtml(userName)}</a>`;
  const reply_markup = {
    inline_keyboard: [
      [
        { text: '✅ Одобрить', callback_data: callbackData('a', userId, key) },
        { text: '❌ Отклонить', callback_data: callbackData('r', userId, key) },
      ],
    ],
  };

  const sent = await callTelegram('sendPhoto', {
    chat_id: chatId,
    photo: item.imageUrl,
    caption,
    parse_mode: 'HTML',
    reply_markup,
  });
  if (sent?.ok) {
    return true;
  }

  // Telegram downloads the photo itself and can fail to; with a link the
  // moderator still sees the photo before deciding.
  const fallback = await callTelegram('sendMessage', {
    chat_id: chatId,
    text: `${caption}\n<a href="${escapeHtml(item.imageUrl)}">Открыть фото →</a>`,
    parse_mode: 'HTML',
    reply_markup,
  });
  return Boolean(fallback?.ok);
};

const wasAnnounced = key => {
  const at = announced.get(key);
  return at !== undefined && Date.now() - at < ANNOUNCE_TTL_MS;
};

const markAnnounced = key => {
  const now = Date.now();
  announced.set(key, now);
  if (announced.size > 1000) {
    for (const [storedKey, at] of announced) {
      if (now - at >= ANNOUNCE_TTL_MS) {
        announced.delete(storedKey);
      }
    }
  }
};

/**
 * Sends a specialist's freshly saved photos to the admin chat.
 *
 * The website names the images it has just added. A page loaded before that
 * change reports only how many, and new photos are appended at the end, so the
 * last pending ones are taken.
 */
const notifyNewPhotos = async (userId, { imageIds, photosCount } = {}) => {
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!chatId) {
    console.log('⚠️ TELEGRAM_ADMIN_CHAT_ID not set, skipping portfolio moderation');
    return { sent: 0, total: 0 };
  }

  const { userName, portfolio } = await loadSpecialist(userId);
  const pending = pendingPhotosOf(portfolio);

  let fresh;
  if (Array.isArray(imageIds) && imageIds.length > 0) {
    const wanted = new Set(imageIds.map(String));
    fresh = pending.filter(item => wanted.has(String(item.imageId)));
  } else {
    const count = Math.min(Math.max(Number(photosCount) || 0, 0), pending.length);
    fresh = count > 0 ? pending.slice(-count) : [];
  }

  const toSend = fresh
    .filter(item => !wasAnnounced(`${userId}:${photoKey(item)}`))
    .slice(0, BATCH_SIZE);

  let sent = 0;
  for (const [index, item] of toSend.entries()) {
    if (index > 0) {
      await sleep(SEND_DELAY_MS);
    }
    const ok = await sendPhotoForModeration(chatId, {
      userId,
      userName,
      item,
      position: index + 1,
      total: toSend.length,
    });
    if (ok) {
      sent += 1;
      markAnnounced(`${userId}:${photoKey(item)}`);
    }
  }

  return { sent, total: toSend.length };
};

/** Every photo waiting for a decision, grouped by specialist. */
const listPendingPhotos = async () => {
  const { items: users } = await queryAllPages(({ page, perPage }) =>
    getIntegrationSdk().users.query({ page, perPage })
  );

  return users.flatMap(user => {
    if (user.attributes.banned || user.attributes.deleted) {
      return [];
    }
    const profile = user.attributes.profile || {};
    const pending = pendingPhotosOf(portfolioOf(profile));
    return pending.map((item, index) => ({
      userId: user.id.uuid,
      userName: nameOf(profile),
      item,
      position: index + 1,
      total: pending.length,
    }));
  });
};

/**
 * The /portfolio admin command: sends the waiting photos in batches, so photos
 * whose announcement was missed or failed can still be moderated from here.
 */
const sendPendingPhotos = async chatId => {
  const pending = await listPendingPhotos();
  if (pending.length === 0) {
    await callTelegram('sendMessage', { chat_id: chatId, text: '✅ Фото на модерации нет' });
    return { sent: 0, total: 0 };
  }

  const batch = pending.slice(0, BATCH_SIZE);
  const specialists = new Set(pending.map(photo => photo.userId)).size;
  const rest = pending.length - batch.length;
  await callTelegram('sendMessage', {
    chat_id: chatId,
    parse_mode: 'HTML',
    text:
      `🖼 <b>Ждут модерации: ${pending.length} фото у ${mastersCount(specialists)}</b>` +
      (rest > 0 ? `\nПрисылаю первые ${batch.length}.` : ''),
  });

  let sent = 0;
  for (const photo of batch) {
    await sleep(SEND_DELAY_MS);
    if (await sendPhotoForModeration(chatId, photo)) {
      sent += 1;
    }
  }

  if (rest > 0) {
    await sleep(SEND_DELAY_MS);
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: `Ещё ${rest} фото. Когда разберёте эти, отправьте /portfolio снова.`,
    });
  }

  return { sent, total: pending.length };
};

const OUTCOMES = {
  approved: {
    toast: 'Одобрено',
    note: '✅ Одобрено: фото видно в профиле на сайте и в приложении',
  },
  rejected: {
    toast: 'Отклонено',
    note: '❌ Отклонено: фото удалено из портфолио',
  },
  'already-approved': {
    toast: 'Уже одобрено',
    note: '✅ Уже было одобрено',
  },
  missing: {
    toast: 'Этого фото уже нет',
    note: '⚠️ Этого фото уже нет в портфолио: мастер удалил его или его уже отклонили',
  },
};

// Inaccessible messages (deleted, or too old for the bot) come with date 0.
const markDecided = async (message, note) => {
  if (!message || message.date === 0) {
    return;
  }
  const base = {
    chat_id: message.chat.id,
    message_id: message.message_id,
    reply_markup: { inline_keyboard: [] },
  };
  if (message.photo) {
    await callTelegram('editMessageCaption', {
      ...base,
      caption: `${message.caption || ''}\n\n${note}`,
      caption_entities: message.caption_entities,
    });
  } else {
    await callTelegram('editMessageText', {
      ...base,
      text: `${message.text || ''}\n\n${note}`,
      entities: message.entities,
      link_preview_options: { is_disabled: true },
    });
  }
};

/**
 * A tap on «Одобрить» or «Отклонить». Only taps in the admin chat count; the
 * webhook itself is already limited to Telegram by its secret token.
 */
const handleCallback = async callbackQuery => {
  const parsed = parseCallbackData(callbackQuery?.data);
  const message = callbackQuery?.message;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  const fromAdminChat =
    !!adminChatId && message?.chat?.id !== undefined && String(message.chat.id) === adminChatId;

  if (!parsed || !fromAdminChat) {
    await callTelegram('answerCallbackQuery', { callback_query_id: callbackQuery?.id });
    return { outcome: 'ignored' };
  }

  let outcome;
  try {
    const { portfolio } = await loadSpecialist(parsed.userId);
    const result = applyDecision(portfolio, parsed.key, parsed.action);
    if (result.outcome === 'approved' || result.outcome === 'rejected') {
      await getIntegrationSdk().users.updateProfile({
        id: parsed.userId,
        publicData: { portfolio: result.portfolio.length > 0 ? result.portfolio : null },
      });
    }
    outcome = result.outcome;
  } catch (error) {
    if (error?.status === 404) {
      outcome = 'missing';
    } else {
      console.error('Portfolio moderation failed:', error?.status, error?.message);
      await callTelegram('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: 'Не получилось сохранить решение. Попробуйте ещё раз.',
        show_alert: true,
      });
      return { outcome: 'error' };
    }
  }

  console.log(`📸 Portfolio photo ${parsed.key} of ${parsed.userId}: ${outcome}`);
  await callTelegram('answerCallbackQuery', {
    callback_query_id: callbackQuery.id,
    text: OUTCOMES[outcome].toast,
  });
  await markDecided(message, OUTCOMES[outcome].note);
  return { outcome };
};

module.exports = {
  applyDecision,
  handleCallback,
  listPendingPhotos,
  notifyNewPhotos,
  parseCallbackData,
  photoKey,
  sendPendingPhotos,
};
