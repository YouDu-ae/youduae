# Built-in email templates (YouDu)

Встроенные письма Sharetribe (регистрация, подтверждение email, сброс пароля и т.д.) не
деплоятся из репозитория — их шаблоны живут в Sharetribe Console:

**Console → Build → Advanced → Email notifications**

Тексты этих же писем (если шаблон использует хелпер `t`) редактируются отдельно в
**Console → Build → Content → Email texts**. Шаблоны ниже написаны с литеральным текстом,
чтобы все правки были в одном месте.

Файлы здесь — источник правды для верстки.

| Папка | Письмо в Console | Ключ в Email texts | Когда отправляется |
| --- | --- | --- | --- |
| `verify-email/` | Verify email address | `VerifyEmail` | сразу после регистрации |
| `verify-changed-email/` | Verify changed email address | `VerifyChangedEmail` | смена email |
| `user-joined/` | User joined | `UserJoined` | после подтверждения email |
| `reset-password/` | Reset password | `ResetPassword` | запрос «забыл пароль» |
| `password-changed/` | Password changed | `PasswordChanged` | пароль успешно изменён |
| `email-address-changed/` | Email address changed | `EmailChanged` | email успешно изменён |
| `new-message/` | New message | `NewMessage` | новое сообщение в чате сделки |
| `listing-approved/` | Listing approved | `ListingApproved` | задание прошло модерацию |
| `user-approved/` | User approved | `UserApproved` | аккаунт одобрен оператором |
| `user-permissions-changed/` | User permissions changed | `UserPermissionsChanged` | админ сменил права |

Письма по сделкам (новый отклик, принят, отклонён и т.д.) живут отдельно:
`ext/transaction-processes/assignment-flow-v3/templates/` и публикуются через `flex-cli`.

## Как обновить в Console

1. Открыть Console → Build → Advanced → Email notifications.
2. Выбрать письмо из таблицы.
3. Вставить содержимое `*-html.html` в редактор шаблона, тему — из `*-subject.txt`.
4. Отправить preview на свою почту кнопкой тестового письма.
5. Сохранить.

Приоритет для живой почты: **Reset password** и **Password changed** (сейчас ещё дефолтный фиолетовый шаблон Sharetribe).

## Фирменный стиль

Тот же, что в шаблонах `ext/transaction-processes/assignment-flow-v3/templates/`:
фон `#f4f4f5`, карточка 600px с радиусом 16px, текстовый логотип YouDu, зелёная кнопка
`#16a34a` с белым текстом, серый футер.
