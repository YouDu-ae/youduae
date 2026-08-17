/**
 * Reminds a task author about offers that are still waiting for an answer.
 *
 * Half of the registered customers never get to a hired specialist, and an
 * offer left hanging is the cheapest place to lose one: the specialist takes
 * another job while the author is simply unaware anyone replied.
 */
const db = require('../db');
const { notifyUnansweredOffers } = require('../api/telegram-bot');
const {
  TELEGRAM_SEND_DELAY_MS,
  config,
  createIntegrationSdk,
  listingUrl,
  sleep,
} = require('./context');

const REMINDER_TYPE = 'unanswered_offers';
const PENDING_TRANSITION = 'transition/inquire';

/**
 * Offers the author has neither accepted nor declined, old enough to nag about.
 * The transition filter is what makes "unanswered" precise: accepting or
 * declining moves the transaction off transition/inquire.
 *
 * The lower bound matters as much as the upper one. Half of the pending offers
 * on the marketplace are over three months old; reminding someone about those
 * would read as spam and the task is long dead anyway.
 */
const fetchStaleOffers = async integrationSdk => {
  const now = Date.now();
  const createdAtEnd = new Date(now - config.unansweredAfterHours * 60 * 60 * 1000);
  const createdAtStart = new Date(now - config.unansweredMaxAgeDays * 24 * 60 * 60 * 1000);
  const collected = [];
  let page = 1;

  for (;;) {
    const response = await integrationSdk.transactions.query({
      lastTransitions: [PENDING_TRANSITION],
      createdAtStart,
      createdAtEnd,
      include: ['listing', 'provider'],
      page,
      perPage: 100,
    });

    const { data, included = [], meta } = response.data;
    collected.push({ transactions: data, included });

    if (!meta || page >= meta.totalPages) break;
    page += 1;
  }

  return collected.reduce(
    (acc, chunk) => ({
      transactions: acc.transactions.concat(chunk.transactions),
      included: acc.included.concat(chunk.included),
    }),
    { transactions: [], included: [] }
  );
};

/**
 * One entry per task, not per offer, so an author with four replies to the same
 * task gets one message instead of four.
 */
const groupByListing = ({ transactions, included }) => {
  const byKey = new Map();
  included.forEach(entry => byKey.set(`${entry.type}:${entry.id.uuid}`, entry));

  const listings = new Map();

  transactions.forEach(transaction => {
    const listingRef = transaction.relationships?.listing?.data;
    const providerRef = transaction.relationships?.provider?.data;
    if (!listingRef || !providerRef) return;

    const listing = byKey.get(`listing:${listingRef.id.uuid}`);
    const provider = byKey.get(`user:${providerRef.id.uuid}`);
    if (!listing || !provider) return;

    // A closed or already hired task no longer needs an answer.
    const { state, publicData = {} } = listing.attributes;
    if (state !== 'published' || publicData.hired) return;

    const listingId = listingRef.id.uuid;
    const existing = listings.get(listingId);

    if (existing) {
      existing.offerCount += 1;
    } else {
      listings.set(listingId, {
        listingId,
        title: listing.attributes.title,
        authorId: providerRef.id.uuid,
        offerCount: 1,
      });
    }
  });

  return [...listings.values()];
};

/**
 * One message per author, not per task. Authors who ignore offers tend to have
 * several tasks doing it at once — on production one person had three — and
 * three notifications arriving at once read as spam instead of a nudge.
 */
const groupByAuthor = candidates => {
  const authors = new Map();

  candidates.forEach(candidate => {
    const tasks = authors.get(candidate.authorId) || [];
    tasks.push(candidate);
    authors.set(candidate.authorId, tasks);
  });

  return [...authors.entries()].map(([authorId, tasks]) => ({ authorId, tasks }));
};

const runUnansweredOffers = async ({ dryRun = false, log = console.log } = {}) => {
  const integrationSdk = createIntegrationSdk();
  if (!integrationSdk) {
    return { skipped: 'missing-integration-credentials' };
  }

  const raw = await fetchStaleOffers(integrationSdk);
  const candidates = groupByListing(raw);
  const authorGroups = groupByAuthor(candidates);

  log(
    `[unanswered_offers] откликов без ответа: ${raw.transactions.length}, заданий: ${candidates.length}, заказчиков: ${authorGroups.length}`
  );

  let sent = 0;
  let alreadySent = 0;
  let failed = 0;

  for (const { authorId, tasks } of authorGroups) {
    if (dryRun) {
      log(
        `[unanswered_offers] DRY RUN → заказчик ${authorId}: ${tasks
          .map(task => `«${task.title}» (${task.offerCount})`)
          .join(', ')}`
      );
      sent += 1;
      continue;
    }

    // Claim per task so a task already covered by an earlier run drops out of
    // the message instead of blocking the whole group.
    const claims = [];
    for (const task of tasks) {
      const claim = {
        reminderType: REMINDER_TYPE,
        subjectId: task.listingId,
        recipientUserId: authorId,
      };
      const claimed = await db.claimReminder({
        ...claim,
        details: { offerCount: task.offerCount, title: task.title },
      });
      if (claimed) claims.push({ claim, task });
    }

    if (claims.length === 0) {
      alreadySent += 1;
      continue;
    }

    try {
      const delivered = await notifyUnansweredOffers(authorId, {
        tasks: claims.map(({ task }) => ({
          title: task.title,
          offerCount: task.offerCount,
          url: listingUrl(task.listingId),
        })),
      });

      if (delivered) {
        sent += 1;
      } else {
        // No linked Telegram, or the chat is gone. Keep the claims so the author
        // is not queued forever for a channel that cannot reach them.
        failed += 1;
      }
    } catch (error) {
      // Let a later run retry: the failure was ours, not the recipient's.
      await Promise.all(claims.map(({ claim }) => db.releaseReminder(claim)));
      failed += 1;
      log(`[unanswered_offers] ошибка отправки заказчику ${authorId}: ${error.message}`);
    }

    await sleep(TELEGRAM_SEND_DELAY_MS);
  }

  return { candidates: authorGroups.length, tasks: candidates.length, sent, alreadySent, failed };
};

module.exports = { runUnansweredOffers };
