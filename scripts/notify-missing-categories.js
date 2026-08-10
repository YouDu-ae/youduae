/**
 * One-off nudge to specialists who linked the bot but never picked service
 * categories. New task alerts are targeted by category, so these subscribers
 * currently receive nothing.
 *
 * Dry run (prints recipients, sends nothing):
 *   node scripts/notify-missing-categories.js
 *
 * Actually send:
 *   node scripts/notify-missing-categories.js --send
 */

require('dotenv').config();

const db = require('../server/db');
const { sendTelegramMessage } = require('../server/api/telegram-bot');

const SEND = process.argv.includes('--send');

const MESSAGE = `👋 <b>Одна настройка — и вы не пропустите заказы</b>

Уведомления о новых заданиях приходят по категориям услуг. В вашем профиле категории пока не выбраны, поэтому такие уведомления до вас не доходят.

<b>Как исправить за минуту:</b>
1. Откройте <a href="https://youdu.ae/profile-settings">youdu.ae/profile-settings</a>
2. Отметьте категории, в которых работаете
3. Нажмите «Сохранить»

После этого вы будете первым узнавать о подходящих заданиях — а заказчики чаще выбирают тех, кто откликается быстро.`;

const run = async () => {
  // Only specialists: customers on this marketplace are the ones who take jobs.
  const result = await db.pool.query(
    `SELECT user_id, chat_id, display_name
     FROM telegram_subscribers
     WHERE is_active
       AND notifications_enabled
       AND user_type = 'customer'
       AND categories = '{}'`
  );

  const recipients = result.rows;

  console.log(`${SEND ? 'Sending to' : 'Dry run —'} ${recipients.length} specialists:\n`);
  recipients.forEach(r => console.log(`  ${r.display_name || r.user_id}`));

  if (!SEND) {
    console.log('\nNo messages sent. Re-run with --send to deliver.');
    await db.pool.end();
    return;
  }

  console.log('');
  let sent = 0;
  for (const recipient of recipients) {
    const response = await sendTelegramMessage(recipient.chat_id, MESSAGE);
    if (response && response.ok) {
      sent++;
      console.log(`  delivered: ${recipient.display_name}`);
    } else {
      console.log(`  failed: ${recipient.display_name} (${response?.description || 'unknown error'})`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\nDelivered ${sent}/${recipients.length}.`);
  await db.pool.end();
};

run().catch(error => {
  console.error('Failed:', error);
  process.exit(1);
});
