/**
 * API для уведомления админа о новых документах верификации
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

async function notifyVerification(req, res) {
  try {
    const { userId, userName, userEmail, documentType, documentsCount } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) {
      console.log('⚠️ Telegram not configured for verification notifications');
      return res.json({ success: true, message: 'Telegram not configured' });
    }

    const documentTypeLabels = {
      passport: '🛂 Паспорт',
      emirates_id: '🪪 Emirates ID',
      driver_license: '🚗 Водительские права',
      other: '📄 Другой документ',
    };

    const text = `🔐 <b>Новая заявка на верификацию</b>

👤 <b>${userName || 'Без имени'}</b>
📧 ${userEmail || 'Email не указан'}
🆔 User ID: <code>${userId}</code>

📎 Тип документа: ${documentTypeLabels[documentType] || documentType || 'Не указан'}
📄 Загружено файлов: ${documentsCount || 1}

━━━━━━━━━━━━━━━
<b>Для одобрения:</b>
1. Откройте Sharetribe Console → Users
2. Найдите пользователя по ID
3. Проверьте protectedData.verificationDocuments
4. Установите publicData.isVerified = true

🔗 <a href="https://console.sharetribe.com">Sharetribe Console</a>`;

    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_ADMIN_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();

    if (data.ok) {
      console.log(`✅ Verification notification sent for user ${userId}`);
      res.json({ success: true });
    } else {
      console.error('Telegram API error:', data);
      res.json({ success: false, error: data.description });
    }
  } catch (error) {
    console.error('Error sending verification notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
}

module.exports = notifyVerification;
