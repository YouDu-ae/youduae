# 🚀 ИНСТРУКЦИЯ ПО ДЕПЛОЮ НА HEROKU

## ✅ Шаг 1: Установка Heroku CLI (ВЫПОЛНЕНО)

Heroku CLI версии `10.15.0` успешно установлен!

---

## 🔐 Шаг 2: Авторизация в Heroku

### Вариант A: Логин через браузер (рекомендуется)

```bash
heroku login
```

Эта команда откроет браузер для авторизации через OAuth.

### Вариант B: Логин через терминал

```bash
heroku login -i
```

Введите ваш email и пароль (или API key) от Heroku аккаунта.

**После успешной авторизации продолжайте:**

---

## 📦 Шаг 3: Создание Heroku приложения

### Вариант A: Создать новое приложение

```bash
cd /Users/admin/web-template
heroku create youdu-marketplace
```

### Вариант B: Подключить существующее приложение

```bash
cd /Users/admin/web-template
heroku git:remote -a your-app-name
```

---

## ⚙️ Шаг 4: Настройка переменных окружения

### Обязательные переменные для Sharetribe Web Template:

```bash
# Sharetribe SDK
heroku config:set REACT_APP_SHARETRIBE_SDK_CLIENT_ID=your-client-id
heroku config:set SHARETRIBE_SDK_CLIENT_SECRET=your-client-secret
heroku config:set REACT_APP_SHARETRIBE_SDK_BASE_URL=https://flex-api.sharetribe.com

# Marketplace
heroku config:set REACT_APP_MARKETPLACE_ROOT_URL=https://your-app-name.herokuapp.com
heroku config:set REACT_APP_MARKETPLACE_NAME="YouDu Marketplace"

# Stripe (для платежей)
heroku config:set REACT_APP_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
heroku config:set STRIPE_SECRET_KEY=your-stripe-secret-key

# Google Maps (для карт)
heroku config:set REACT_APP_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Node environment
heroku config:set NODE_ENV=production
heroku config:set NPM_CONFIG_PRODUCTION=false

# Server Port
heroku config:set SERVER_SHARETRIBE_TRUST_PROXY=true
```

### Дополнительные переменные (опционально):

```bash
# Mapbox (если используете Mapbox вместо Google Maps)
heroku config:set REACT_APP_MAPBOX_ACCESS_TOKEN=your-mapbox-token

# Sentry (для мониторинга ошибок)
heroku config:set REACT_APP_SENTRY_DSN=your-sentry-dsn

# Facebook App ID (для соц. сетей)
heroku config:set REACT_APP_FACEBOOK_APP_ID=your-facebook-app-id

# SSL
heroku config:set REACT_APP_SHARETRIBE_USING_SSL=true

# CSP (Content Security Policy)
heroku config:set REACT_APP_CSP=block
```

### Проверить установленные переменные:

```bash
heroku config
```

---

## 🔧 Шаг 5: Настройка buildpacks

```bash
# Установить Node.js buildpack
heroku buildpacks:set heroku/nodejs

# Проверить buildpacks
heroku buildpacks
```

---

## 📝 Шаг 6: Подготовка к деплою

### Проверить package.json

Убедитесь что в `package.json` есть:

```json
{
  "engines": {
    "node": ">=18.0.0",
    "yarn": ">=1.22.0"
  },
  "scripts": {
    "heroku-postbuild": "yarn build"
  }
}
```

### Создать Procfile (если его нет)

Создайте файл `Procfile` в корне проекта:

```
web: yarn start
```

---

## 🚀 Шаг 7: Деплой на Heroku

### Убедитесь что все изменения закоммичены:

```bash
git status
git add .
git commit -m "Prepare for Heroku deployment"
```

### Деплой:

```bash
git push heroku main
```

Если ваша ветка называется `master`:

```bash
git push heroku master
```

---

## 📊 Шаг 8: Проверка статуса и логов

### Открыть приложение в браузере:

```bash
heroku open
```

### Проверить логи:

```bash
heroku logs --tail
```

### Проверить статус dyno:

```bash
heroku ps
```

---

## 🔧 Troubleshooting (Решение проблем)

### Проблема 1: Ошибка при деплое

```bash
# Проверить логи
heroku logs --tail

# Перезапустить приложение
heroku restart
```

### Проблема 2: Приложение не запускается

```bash
# Проверить переменные окружения
heroku config

# Проверить buildpacks
heroku buildpacks

# Масштабировать dyno
heroku ps:scale web=1
```

### Проблема 3: Ошибка базы данных

Если требуется PostgreSQL:

```bash
heroku addons:create heroku-postgresql:mini
```

### Проблема 4: Нужно изменить переменную окружения

```bash
heroku config:set VARIABLE_NAME=new-value
```

### Проблема 5: Откатиться к предыдущей версии

```bash
# Посмотреть релизы
heroku releases

# Откатиться к предыдущей версии
heroku rollback
```

---

## 📱 Дополнительные команды

### Открыть Heroku Dashboard:

```bash
heroku dashboard
```

### Запустить команды на Heroku:

```bash
heroku run bash
heroku run node
```

### Масштабирование:

```bash
# Бесплатный план (1 dyno)
heroku ps:scale web=1

# Платный план (несколько dyno)
heroku ps:scale web=2
```

### Добавление custom domain:

```bash
heroku domains:add www.youdu.ae
heroku domains:add youdu.ae
```

---

## ⚠️ Важные замечания

1. **Бесплатный план Heroku больше не доступен** с 28 ноября 2022 года
   - Минимальный платный план: **Eco Dynos** ($5/месяц)
   - Для продакшена рекомендуется: **Basic** или **Standard** план

2. **Переменные окружения обязательны:**
   - `REACT_APP_SHARETRIBE_SDK_CLIENT_ID`
   - `SHARETRIBE_SDK_CLIENT_SECRET`
   - `REACT_APP_MARKETPLACE_ROOT_URL`
   - `REACT_APP_STRIPE_PUBLISHABLE_KEY`
   - `REACT_APP_GOOGLE_MAPS_API_KEY`

3. **SSL сертификат:**
   - Heroku автоматически выдает SSL сертификат для `*.herokuapp.com`
   - Для custom domain нужен платный план

4. **Node.js версия:**
   - Убедитесь что версия Node.js совместима с вашим проектом
   - Укажите версию в `package.json` → `engines`

5. **Build time:**
   - Первый деплой может занять 5-10 минут
   - Последующие деплои обычно быстрее

---

## 🔗 Полезные ссылки

- [Heroku Dev Center](https://devcenter.heroku.com/)
- [Heroku Node.js Support](https://devcenter.heroku.com/articles/nodejs-support)
- [Heroku Custom Domains](https://devcenter.heroku.com/articles/custom-domains)
- [Heroku SSL](https://devcenter.heroku.com/articles/ssl)
- [Sharetribe Web Template Docs](https://www.sharetribe.com/docs/template/how-to-deploy-template-to-production/)

---

## 📞 Нужна помощь?

Если возникли проблемы:
1. Проверьте логи: `heroku logs --tail`
2. Проверьте переменные окружения: `heroku config`
3. Проверьте статус: `heroku ps`
4. Обратитесь в поддержку Heroku или Sharetribe

