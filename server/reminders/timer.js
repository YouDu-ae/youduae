/**
 * Runs the reminder sweep from inside the web dyno.
 *
 * Heroku Scheduler is the textbook home for this, but its jobs can only be
 * created by hand in a web dashboard, which left the reminders switched off for
 * two days. An in-process timer trades that manual step for a small amount of
 * work on the web dyno — the sweep finishes in about 200 ms, so the cost is
 * nothing next to a reminder that never gets sent.
 *
 * The usual objection to timers in a web process is duplicate work across
 * dynos. It does not apply here: every reminder is claimed in reminder_log
 * before it is sent, so a second dyno finds nothing left to do. Set
 * REMINDERS_IN_PROCESS=false to hand the job back to Scheduler.
 */
const { runReminders } = require('./index');

const HOUR_MS = 60 * 60 * 1000;

// Long enough for the dyno to finish booting and serve traffic first.
const STARTUP_DELAY_MS = 2 * 60 * 1000;

let timers = [];
let running = false;

const sweep = async () => {
  // A slow sweep must not stack up behind itself.
  if (running) return;
  running = true;

  try {
    const results = await runReminders({ log: message => console.log(`[reminders] ${message}`) });
    // Without this the logs show what was considered but never what was
    // actually delivered, which is the only number that matters.
    console.log('[reminders] итог:', JSON.stringify(results));
  } catch (error) {
    // A broken sweep must never take the web server down with it.
    console.error('[reminders] сбой обхода:', error.message);
  } finally {
    running = false;
  }
};

const startReminderTimer = () => {
  if (process.env.REMINDERS_IN_PROCESS === 'false') {
    console.log('[reminders] встроенный планировщик выключен');
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.log('[reminders] нет DATABASE_URL, планировщик не запущен');
    return;
  }

  const startup = setTimeout(() => {
    sweep();
    timers.push(setInterval(sweep, HOUR_MS));
  }, STARTUP_DELAY_MS);

  timers.push(startup);
  console.log('[reminders] встроенный планировщик запущен, обход раз в час');
};

const stopReminderTimer = () => {
  timers.forEach(timer => {
    clearTimeout(timer);
    clearInterval(timer);
  });
  timers = [];
};

module.exports = { startReminderTimer, stopReminderTimer };
