# Built-in email templates (YouDu)

Встроенные письма Sharetribe (регистрация, подтверждение email, сброс пароля и т.д.) не
деплоятся из репозитория — их шаблоны живут в Sharetribe Console:

**Console → Build → Advanced → Email notifications**

Тексты этих же писем (если шаблон использует хелпер `t`) редактируются отдельно в
**Console → Build → Content → Email texts**. Шаблоны ниже написаны с литеральным текстом,
чтобы всё правки были в одном месте.

Файлы здесь — источник правды для верстки, чтобы изменения были в git и их можно было
восстановить или отредактировать.

| Папка | Письмо в Console | Ключ в Email texts | Когда отправляется |
| --- | --- | --- | --- |
| `verify-email/` | Verify email address | `VerifyEmail` | сразу после регистрации |
| `user-joined/` | User joined | `UserJoined` | после подтверждения email |

## Как обновить в Console

1. Открыть Console → Build → Advanced → Email notifications.
2. Выбрать нужное письмо (Verify email address / User joined).
3. Вставить содержимое `*-html.html` в редактор шаблона, тему — из `*-subject.txt`.
4. Отправить preview на свою почту кнопкой отправки тестового письма.
5. Сохранить.

## Контекстные переменные

`verify-email`: `recipient` (в т.ч. `recipient.public-data`), `marketplace.name`,
`marketplace.url`, `email-verification.token`.

`user-joined`: `recipient`, `marketplace.name`, `marketplace.url`.

## Роли

Письмо User joined ветвится по `recipient.public-data.userType`:

- `provider` — Заказчик, размещает задания (CTA: `/l/new`);
- `customer` — Исполнитель, откликается на задания (CTA: `/s`).

Нейминг инвертирован относительно стандартного Sharetribe — см. `src/config/configUser.js`.

## Фирменный стиль

Тот же, что в шаблонах `ext/transaction-processes/assignment-flow-v3/templates/`:
фон `#f4f4f5`, карточка 600px с радиусом 16px, текстовый логотип YouDu, жёлтая кнопка
`#ffc934` с тёмным текстом, серый футер.
