# Шаблон для создания статьи в блоге YouDu

## Шаг 1: Добавить в articles.json

Откройте файл `src/data/blog/articles.json` и добавьте в массив `"articles"`:

```json
{
  "id": "slug-stati-na-latinice",
  "slug": "slug-stati-na-latinice",
  "category": "client-guide",
  "title": {
    "ru": "Заголовок статьи на русском",
    "en": "Article Title in English"
  },
  "description": {
    "ru": "Краткое описание для карточки и SEO (до 160 символов)",
    "en": "Short description for card and SEO (up to 160 characters)"
  },
  "image": "/static/blog/your-image.jpg",
  "readTime": 5,
  "createdAt": "2026-07-27",
  "author": null,
  "relatedCategory": null,
  "featured": false
}
```

### Категории (category):
- `cases` — Реальные проекты (кейсы)
- `client-guide` — Гид клиента
- `specialist-guide` — Гид специалиста
- `uae-life` — Жизнь в ОАЭ

### Связанные категории (relatedCategory):
Если хотите показать CTA-блок "Найти специалиста":
```json
"relatedCategory": {
  "id": "repair",
  "name": { "ru": "Ремонт", "en": "Repair" }
}
```

Доступные id: `repair`, `cleaning`, `training`, `beauty`, `transport`, `events`, `it`, `other`

---

## Шаг 2: Создать файл контента

Создайте файл: `src/data/blog/articles/slug-stati-na-latinice.json`

```json
{
  "id": "slug-stati-na-latinice",
  "content": {
    "ru": "<h2>Введение</h2><p>Первый параграф статьи...</p><h2>Основная часть</h2><p>Текст...</p><h2>Заключение</h2><p>Итоги...</p>",
    "en": "<h2>Introduction</h2><p>First paragraph...</p><h2>Main part</h2><p>Text...</p><h2>Conclusion</h2><p>Summary...</p>"
  },
  "gallery": [],
  "tags": ["тег1", "тег2", "tag1", "tag2"]
}
```

---

## Шаг 3: Добавить изображения

Загрузите в папку: `public/static/blog/`

Рекомендации:
- Главное фото: 1200×630 px
- Фото в статье: 800-1200 px по ширине
- Формат: JPG или WebP
- Сжать на tinypng.com

---

## HTML-разметка для контента

### Заголовки
```html
<h2>Главный заголовок раздела</h2>
<h3>Подзаголовок</h3>
```

### Параграфы
```html
<p>Обычный текст параграфа.</p>
<p>Текст с <strong>жирным</strong> и <em>курсивом</em>.</p>
```

### Списки
```html
<ul>
  <li>Пункт 1</li>
  <li>Пункт 2</li>
</ul>

<ol>
  <li>Первый шаг</li>
  <li>Второй шаг</li>
</ol>
```

### Список с выделением
```html
<ul>
  <li><strong>Бюджет:</strong> 50 000 AED</li>
  <li><strong>Сроки:</strong> 2 недели</li>
  <li><strong>Площадь:</strong> 100 кв.м</li>
</ul>
```

### Изображения в тексте
```html
<img src="/static/blog/photo-name.jpg" alt="Описание фото" />
```

### Цитата
```html
<blockquote>Текст цитаты или отзыва клиента</blockquote>
```

---

## Шаблон для кейса (с автором)

В `articles.json` добавьте поле `author`:

```json
{
  "id": "remont-vannoy-v-marina",
  "slug": "remont-vannoy-v-marina",
  "category": "cases",
  "title": {
    "ru": "Ремонт ванной комнаты в Dubai Marina",
    "en": "Bathroom Renovation in Dubai Marina"
  },
  "description": {
    "ru": "Полный ремонт санузла 8 кв.м за 10 дней: от демонтажа до финишной отделки",
    "en": "Complete 8 sqm bathroom renovation in 10 days"
  },
  "image": "/static/blog/marina-bathroom.jpg",
  "readTime": 6,
  "createdAt": "2026-07-27",
  "author": {
    "name": "Алексей Смирнов",
    "rating": 4.9,
    "specialty": {
      "ru": "Мастер по ремонту",
      "en": "Renovation Specialist"
    },
    "profileId": null,
    "isVerified": true
  },
  "relatedCategory": {
    "id": "repair",
    "name": { "ru": "Ремонт и строительство", "en": "Repair and Construction" }
  },
  "featured": true
}
```

Если у мастера есть профиль на YouDu, укажите его UUID в `profileId`.

---

## Чек-лист перед публикацией

- [ ] Slug уникальный и на латинице
- [ ] Заголовок и описание на RU и EN
- [ ] Главное изображение загружено в /static/blog/
- [ ] Контент отформатирован в HTML
- [ ] Указана правильная категория
- [ ] Указано время чтения (примерно 200 слов = 1 минута)
- [ ] Для кейса: добавлен автор
- [ ] Для гида: добавлена связанная категория

---

## Деплой

```bash
git add .
git commit -m "Add blog article: название-статьи"
git push heroku main
```

Статья появится на сайте через 1-2 минуты после деплоя.

---

## Импорт из Telegram

### Способ 1: Импорт истории (для старых постов)

1. Откройте Telegram Desktop
2. Зайдите в группу @youdu_uae
3. Меню ⋮ → **Export chat history**
4. Выберите формат **JSON**
5. Экспортируйте в папку
6. Запустите скрипт:

```bash
node scripts/import-telegram-export.js путь/к/result.json
```

Скрипт импортирует посты от админов длиной > 100 символов.

### Способ 2: Автоматический сбор новых постов

После настройки webhook, посты от админов автоматически сохраняются в `pending_posts.json`.

**Настройка:**
1. Добавьте бота @YouDuAE_bot в группу
2. Дайте боту права читать сообщения
3. Добавьте переменные окружения:
   ```
   TELEGRAM_BLOG_ADMIN_IDS=123456789,987654321
   TELEGRAM_BLOG_GROUP_ID=-1001234567890
   ```
4. Настройте webhook в Telegram:
   ```
   https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://youdu.ae/api/telegram/blog-webhook
   ```

**Управление постами:**
- `GET /api/blog/pending` — список ожидающих постов
- `POST /api/blog/approve` — одобрить пост `{ postId, category }`
- `POST /api/blog/reject` — отклонить пост `{ postId }`

Чтобы исключить пост из импорта, добавьте хештег `#noblog` в сообщение.
