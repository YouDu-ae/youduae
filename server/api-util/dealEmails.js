/**
 * Letters about new offers and chat messages for people whose e-mail is not
 * verified.
 *
 * Sharetribe sends transaction and new-message e-mails only to verified
 * addresses and never catches up after verification. Most people who sign up
 * by e-mail never click the verification link, so without these letters they
 * learn about offers and replies only by opening the site. Verified addresses
 * are left to Sharetribe, so nobody gets the same news twice.
 *
 * Looks like the Sharetribe templates in ext/transaction-processes/.
 */

const sgMail = require('@sendgrid/mail');

const fromName = process.env.SENDGRID_FROM_NAME || 'YouDu';
const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@mail.youdu.ae';

const escapeHtml = value =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const layout = ({ rootUrl, title, intro, cardLines, ctaLabel, ctaUrl }) => {
  const card = cardLines.filter(Boolean).join('');
  return `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <style type="text/css">
      @media (prefers-color-scheme: dark) {
        .youdu-cta { background-color: #16a34a !important; }
        .youdu-cta a { background-color: #16a34a !important; color: #ffffff !important; }
      }
    </style>
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
      <tr><td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
          <tr><td style="padding:28px 32px 0 32px;">
            <img src="${rootUrl}/static/email/youdu-logo.png" width="76" height="56" alt="YouDu" style="display:block;width:76px;height:56px;border:0;" />
          </td></tr>
          <tr><td style="padding:20px 32px 0 32px;">
            <h1 style="margin:0 0 12px 0;font-size:24px;line-height:32px;font-weight:700;color:#111827;">${escapeHtml(title)}</h1>
            <p style="margin:0 0 20px 0;font-size:16px;line-height:24px;color:#374151;">${intro}</p>
          </td></tr>
          ${
            card
              ? `<tr><td style="padding:0 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;border-radius:12px;">
              <tr><td style="padding:20px 24px;">${card}</td></tr>
            </table>
          </td></tr>`
              : ''
          }
          <tr><td align="center" style="padding:28px 32px 8px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td align="center" class="youdu-cta" bgcolor="#16a34a" style="background-color:#16a34a;border-radius:12px;">
                <a href="${ctaUrl}" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:700;background-color:#16a34a;color:#ffffff;text-decoration:none;border-radius:12px;">${escapeHtml(ctaLabel)}</a>
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:12px 32px 0 32px;">
            <p style="margin:0;font-size:13px;line-height:20px;color:#9ca3af;text-align:center;">Кнопка не открывается? Скопируйте ссылку:<br />${ctaUrl}</p>
          </td></tr>
          <tr><td style="padding:24px 32px 32px 32px;">
            <div style="border-top:1px solid #eeeeee;padding-top:20px;">
              <p style="margin:0 0 10px 0;font-size:13px;line-height:20px;color:#6b7280;">
                Подтвердите email, чтобы получать все уведомления YouDu: письмо со ссылкой можно отправить ещё раз в
                <a href="${rootUrl}/account/contact-details" style="color:#6b7280;">настройках аккаунта</a>.
              </p>
              <p style="margin:0;font-size:12px;line-height:18px;color:#9ca3af;">
                Вы получили это письмо, потому что пользуетесь YouDu.<br />
                <a href="${rootUrl}" style="color:#9ca3af;">${rootUrl}</a>
              </p>
            </div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
};

const cardLine = (text, style = 'margin:0 0 8px 0;font-size:15px;line-height:22px;color:#111827;') =>
  text ? `<p style="${style}">${text}</p>` : '';

/**
 * @param {Object} offer
 * @param {string} offer.recipientName
 * @param {string} offer.listingTitle
 * @param {string} offer.executorName
 * @param {string|number} [offer.price]
 * @param {string} [offer.currency]
 * @param {string} [offer.comment]
 * @param {string} offer.listingUrl
 */
const offerEmail = ({ rootUrl, recipientName, listingTitle, executorName, price, currency, comment, listingUrl }) => ({
  subject: `Новый отклик на задание «${listingTitle}»`,
  html: layout({
    rootUrl,
    title: 'Новый отклик на ваше задание',
    intro: `Здравствуйте, ${escapeHtml(recipientName)}! Специалист откликнулся на задание «${escapeHtml(listingTitle)}».`,
    cardLines: [
      cardLine(`<strong>${escapeHtml(executorName)}</strong>`),
      price
        ? cardLine(
            `${escapeHtml(price)} ${escapeHtml(currency || 'AED')}`,
            'margin:0 0 8px 0;font-size:20px;line-height:28px;font-weight:700;color:#111827;'
          )
        : '',
      comment ? cardLine(escapeHtml(comment), 'margin:0;font-size:15px;line-height:22px;color:#4b5563;') : '',
    ],
    ctaLabel: 'Посмотреть отклики',
    ctaUrl: listingUrl,
  }),
  text: [
    `Специалист ${executorName} откликнулся на задание «${listingTitle}».`,
    price ? `Цена: ${price} ${currency || 'AED'}` : '',
    comment || '',
    `Посмотреть отклики: ${listingUrl}`,
  ]
    .filter(Boolean)
    .join('\n\n'),
});

const messageEmail = ({ rootUrl, recipientName, senderName, listingTitle, preview, conversationUrl }) => ({
  subject: `Новое сообщение от ${senderName}`,
  html: layout({
    rootUrl,
    title: 'Новое сообщение',
    intro: `Здравствуйте, ${escapeHtml(recipientName)}! ${escapeHtml(senderName)} написал(а) вам${
      listingTitle ? ` по заданию «${escapeHtml(listingTitle)}»` : ''
    }.`,
    cardLines: [cardLine(escapeHtml(preview), 'margin:0;font-size:15px;line-height:22px;color:#4b5563;')],
    ctaLabel: 'Ответить',
    ctaUrl: conversationUrl,
  }),
  text: `${senderName}: «${preview}»\n\nОтветить: ${conversationUrl}`,
});

const BUILDERS = { offer: offerEmail, message: messageEmail };

/**
 * @param {'offer'|'message'} kind
 * @param {string} to
 * @param {Object} data fields of the matching builder
 * @returns {Promise<boolean>} Whether a letter was handed to SendGrid.
 */
const sendDealEmail = async (kind, to, data) => {
  const build = BUILDERS[kind];
  if (!build || !to || !process.env.SENDGRID_API_KEY) return false;

  const rootUrl = process.env.REACT_APP_MARKETPLACE_ROOT_URL || 'https://youdu.ae';
  const letter = build({ rootUrl, ...data });
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  await sgMail.send({
    to,
    from: { email: fromEmail, name: fromName },
    subject: letter.subject,
    text: letter.text,
    html: letter.html,
  });
  return true;
};

module.exports = { sendDealEmail, offerEmail, messageEmail };
