# Assignment Flow v3 — процесс транзакций YouDu

Пользовательский процесс транзакций для маркетплейса заданий.

## Роли

В YouDu роли Sharetribe инвертированы относительно привычной логики маркетплейса:

| Роль Sharetribe | Кто это в YouDu | Почему |
| --- | --- | --- |
| `provider` | Заказчик, автор задания | Задание — это листинг, его владелец «предоставляет» листинг |
| `customer` | Специалист, исполнитель | Специалист инициирует транзакцию, откликаясь на задание |

Эту инверсию нужно держать в голове при любых правках: `:to :actor.role/provider`
в уведомлении означает письмо **заказчику**, а не исполнителю.

## Workflow

1. **inquiry** — специалист отправляет отклик с ценой и комментарием
2. **accepted** — заказчик принимает отклик
3. **declined** — заказчик отклоняет отклик (финальное состояние)
4. **completed** — заказчик отмечает задание выполненным
5. **reviewed** — обе стороны оставили отзывы (публикуются одновременно)

Если одна из сторон не оставит отзыв за 7 дней, отзывы публикуются автоматически.

## Email-уведомления

Все письма — часть процесса, отдельной настройки в Console не требуют.
Шаблоны лежат в `templates/<имя-шаблона>/` и состоят из двух обязательных файлов:
`<имя>-subject.txt` и `<имя>-html.html`. Текстовая версия письма генерируется
Sharetribe из HTML автоматически.

| Событие | Получатель | Шаблон |
| --- | --- | --- |
| Новый отклик | Заказчик | `new-inquiry` |
| Отклик без ответа сутки | Заказчик | `new-inquiry-reminder` |
| Отклик принят | Специалист | `offer-accepted` |
| Отклик отклонён | Специалист | `offer-declined` |
| Задание завершено | Специалист | `work-completed` |
| Заказчик оставил отзыв первым | Специалист | `review-by-provider-first` |
| Специалист оставил отзыв первым | Заказчик | `review-by-customer-first` |
| Отзывы опубликованы | Специалист | `review-by-provider-second` |
| Отзывы опубликованы | Заказчик | `review-by-customer-second` |

`new-inquiry-reminder` — отложенное уведомление (`:at`, сутки после входа в
`state/inquiry`). Sharetribe отменяет его автоматически, если заказчик успел
принять или отклонить отклик. Напоминание приходит по каждому неотвеченному
отклику отдельно, группировки на стороне процесса нет.

### Доступные переменные

Контекст письма описан в
[Email templates reference](https://www.sharetribe.com/docs/references/email-templates/).
Часто используемое:

- `{{recipient.display-name}}` — получатель письма
- `{{marketplace.name}}`, `{{marketplace.url}}`
- `{{transaction.id}}`, `{{transaction.listing.id}}`, `{{transaction.listing.title}}`
- `{{transaction.provider.display-name}}` — заказчик
- `{{transaction.customer.display-name}}` — специалист
- `{{transaction.protected-data.offer.price}}`, `.currency`, `.comment` — данные отклика

Пути указываются полностью от корня контекста. Сокращения вида `{{listing.title}}`
не резолвятся и молча дают пустую строку.

Ссылки на страницу сделки различаются по роли: заказчику — `/sale/<id>`,
специалисту — `/order/<id>`. Заказчика в письмах о новом отклике ведём на
страницу задания `/l/<listing-id>`, где видны все отклики сразу.

## Деплой

Локальная проверка процесса и шаблонов:

```bash
flex-cli process --path ext/transaction-processes/assignment-flow-v3
```

Предпросмотр письма в браузере (и текстовой версии в терминале):

```bash
flex-cli notifications preview \
  --template ext/transaction-processes/assignment-flow-v3/templates/new-inquiry \
  -m <marketplace-ident>
```

Публикация новой версии и перевод алиаса на неё:

```bash
flex-cli process push \
  --process assignment-flow-v3 \
  --path ext/transaction-processes/assignment-flow-v3 \
  -m <marketplace-ident>

flex-cli process list --process assignment-flow-v3 -m <marketplace-ident>

flex-cli process update-alias \
  --process assignment-flow-v3 \
  --alias release-1 \
  --version <новая-версия> \
  -m <marketplace-ident>
```

Транзакции закреплены за той версией процесса, на которой были созданы, поэтому
перевод алиаса влияет только на новые сделки. Алиас `release-1` захардкожен во
фронтенде, менять его не нужно.

CTA-кнопки в HTML-шаблонах — зелёные `#16a34a` с белым текстом. Жёлтый `#ffc934`
в тёмной теме почтовых клиентов (Gmail, iOS Mail) становится грязно-коричневым.

## Документация

Sharetribe: https://www.sharetribe.com/docs/
