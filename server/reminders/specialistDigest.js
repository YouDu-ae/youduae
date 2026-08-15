/**
 * Daily digest of tasks nobody has answered yet, sent to specialists in the
 * matching categories.
 *
 * The instant "new task in your category" alert only reaches people who had
 * Telegram linked at that moment and who saw the message. A task that misses
 * that window currently has no second chance, and a feed of unanswered tasks is
 * exactly what makes a customer give up on the marketplace.
 */
const db = require('../db');
const { notifySpecialistDigest } = require('../api/telegram-bot');
const {
  CATEGORY_LABELS,
  TELEGRAM_SEND_DELAY_MS,
  config,
  createIntegrationSdk,
  formatPrice,
  listingUrl,
  marketplaceDateKey,
  rootUrl,
  sleep,
} = require('./context');

const REMINDER_TYPE = 'specialist_digest';

const queryAll = async (queryFn, params) => {
  const items = [];
  let page = 1;

  for (;;) {
    const response = await queryFn({ ...params, page, perPage: 100 });
    const { data, meta } = response.data;
    items.push(...data);

    if (!meta || page >= meta.totalPages) break;
    page += 1;
  }

  return items;
};

/**
 * Tasks old enough that the instant alert already had its chance, young enough
 * that reviving them still makes sense.
 */
const fetchUnansweredListings = async integrationSdk => {
  const now = Date.now();
  const createdAtEnd = new Date(now - config.digestMinAgeHours * 60 * 60 * 1000);
  const createdAtStart = new Date(now - config.digestMaxAgeDays * 24 * 60 * 60 * 1000);

  const [listings, transactions] = await Promise.all([
    queryAll(params => integrationSdk.listings.query(params), {
      states: ['published'],
      createdAtStart,
      createdAtEnd,
    }),
    queryAll(params => integrationSdk.transactions.query(params), {
      createdAtStart,
      include: ['listing'],
    }),
  ]);

  const answered = new Set(
    transactions
      .map(transaction => transaction.relationships?.listing?.data?.id?.uuid)
      .filter(Boolean)
  );

  return listings
    .filter(listing => !answered.has(listing.id.uuid))
    .filter(listing => !listing.attributes.publicData?.hired)
    .filter(listing => Boolean(listing.attributes.publicData?.categoryLevel1))
    .map(listing => ({
      listingId: listing.id.uuid,
      title: listing.attributes.title,
      categoryId: listing.attributes.publicData.categoryLevel1,
      price: formatPrice(listing.attributes.price),
      authorId: listing.relationships?.author?.data?.id?.uuid || null,
      createdAt: listing.attributes.createdAt,
    }));
};

/**
 * Fan the tasks out per recipient rather than per category: a specialist who
 * works in three categories should get one digest, not three.
 */
const buildRecipientTasks = async tasks => {
  const byCategory = new Map();
  tasks.forEach(task => {
    const list = byCategory.get(task.categoryId) || [];
    list.push(task);
    byCategory.set(task.categoryId, list);
  });

  const recipients = new Map();

  for (const [categoryId, categoryTasks] of byCategory) {
    const subscribers = await db.getTelegramSubscribersByCategory(categoryId);

    subscribers.forEach(subscriber => {
      const entry = recipients.get(subscriber.userId) || { ...subscriber, tasks: [] };
      categoryTasks.forEach(task => {
        // Nobody needs a digest advertising their own task.
        if (task.authorId && task.authorId === subscriber.userId) return;
        if (entry.tasks.some(existing => existing.listingId === task.listingId)) return;
        entry.tasks.push(task);
      });
      recipients.set(subscriber.userId, entry);
    });
  }

  return [...recipients.values()].filter(recipient => recipient.tasks.length > 0);
};

const runSpecialistDigest = async ({ dryRun = false, log = console.log } = {}) => {
  const integrationSdk = createIntegrationSdk();
  if (!integrationSdk) {
    return { skipped: 'missing-integration-credentials' };
  }

  const tasks = await fetchUnansweredListings(integrationSdk);

  if (tasks.length === 0) {
    log('[specialist_digest] заданий без откликов нет');
    return { candidates: 0, sent: 0, alreadySent: 0, failed: 0 };
  }

  const recipients = await buildRecipientTasks(tasks);
  const dateKey = marketplaceDateKey();
  const feedUrl = `${rootUrl()}/s?utm_source=telegram&utm_medium=bot&utm_campaign=digest`;

  log(
    `[specialist_digest] заданий без откликов: ${tasks.length}, получателей: ${recipients.length}`
  );

  let sent = 0;
  let alreadySent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    // Freshest first, because an old task is the least likely to convert.
    const digestTasks = recipient.tasks
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, config.digestMaxTasks)
      .map(task => ({
        title: task.title,
        categoryName: CATEGORY_LABELS[task.categoryId] || task.categoryId,
        price: task.price,
        url: `${listingUrl(task.listingId)}?utm_source=telegram&utm_medium=bot&utm_campaign=digest`,
      }));

    if (dryRun) {
      log(
        `[specialist_digest] DRY RUN → ${recipient.displayName || recipient.userId}: ${
          digestTasks.length
        } задан. (${digestTasks.map(task => task.title).join('; ')})`
      );
      sent += 1;
      continue;
    }

    // The date is the subject, so the digest can go out at most once per day
    // even if the scheduler runs hourly.
    const claim = {
      reminderType: REMINDER_TYPE,
      subjectId: dateKey,
      recipientUserId: recipient.userId,
    };

    const claimed = await db.claimReminder({
      ...claim,
      details: { taskCount: digestTasks.length },
    });

    if (!claimed) {
      alreadySent += 1;
      continue;
    }

    try {
      const delivered = await notifySpecialistDigest(recipient.userId, {
        tasks: digestTasks,
        feedUrl,
      });
      if (delivered) {
        sent += 1;
      } else {
        failed += 1;
      }
    } catch (error) {
      await db.releaseReminder(claim);
      failed += 1;
      log(`[specialist_digest] ошибка отправки ${recipient.userId}: ${error.message}`);
    }

    await sleep(TELEGRAM_SEND_DELAY_MS);
  }

  return { candidates: recipients.length, sent, alreadySent, failed };
};

module.exports = { runSpecialistDigest };
