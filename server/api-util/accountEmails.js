/**
 * Letters about account deletion.
 *
 * Apple asks for a confirmation once deletion is done, and deletion through
 * Console can take days, so the person hears from us twice on that path: when
 * the request arrives and when the account is gone.
 */

const sgMail = require('@sendgrid/mail');

const fromName = process.env.SENDGRID_FROM_NAME || 'YouDu';
const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@mail.youdu.ae';

// Deletion must not depend on mail; a missing key only means no letter.
const isEmailConfigured = () => !!process.env.SENDGRID_API_KEY;

const layout = (title, paragraphs) => `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:#f7f9fc;color:#111827;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
    <h1 style="margin:0 0 20px;font-size:22px;">${title}</h1>
    ${paragraphs.map(p => `<p style="margin:0 0 14px;font-size:15px;line-height:1.5;">${p}</p>`).join('')}
    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">Если вы этого не делали, напишите нам: info@youdu.ae</p>
  </div>
</body></html>`;

const TEMPLATES = {
  requested: {
    subject: 'YouDu: запрос на удаление аккаунта принят',
    title: 'Запрос на удаление аккаунта принят',
    paragraphs: [
      'Мы получили ваш запрос на удаление аккаунта YouDu.',
      'Удалим аккаунт в течение 30 дней и пришлём письмо, когда это будет сделано.',
    ],
  },
  deleted: {
    subject: 'YouDu: аккаунт удалён',
    title: 'Ваш аккаунт удалён',
    paragraphs: [
      'Аккаунт YouDu и ваши задания удалены.',
      'Сообщения и отзывы, которые вы отправляли другим пользователям, остались у них, но ваш профиль показан как удалённый.',
    ],
  },
};

/**
 * @param {'requested'|'deleted'} kind
 * @param {string} email
 * @returns {Promise<boolean>} Whether a letter was handed to SendGrid.
 */
const sendAccountEmail = async (kind, email) => {
  const template = TEMPLATES[kind];
  if (!template || !email || !isEmailConfigured()) return false;

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  await sgMail.send({
    to: email,
    from: { email: fromEmail, name: fromName },
    subject: template.subject,
    text: template.paragraphs.join('\n\n'),
    html: layout(template.title, template.paragraphs),
  });
  return true;
};

module.exports = { sendAccountEmail };
