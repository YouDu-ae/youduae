# 🚨 ИНСТРУКЦИЯ ПО ИСПРАВЛЕНИЮ УТЕЧКИ СЕКРЕТОВ

## Проблема
В Git репозиторий были закоммичены файлы с секретными ключами:
- `.env-template`
- `.env.development`
- `.env.test`

Эти файлы содержат:
- `SHARETRIBE_SDK_CLIENT_SECRET`
- `REACT_APP_SHARETRIBE_SDK_CLIENT_ID`

## ✅ Решение (по шагам)

### Шаг 1: Ротировать секреты в Sharetribe Console

1. Откройте https://console.sharetribe.com
2. Перейдите: **Build → Applications**
3. Найдите текущее приложение с Client ID: `8e494770-470c-47c4-9d95-f8d99baf3a07`
4. **Удалите его** или создайте новое приложение
5. Скопируйте **новые**:
   - Client ID
   - Client Secret

### Шаг 2: Обновить локальные .env файлы

Создайте файл `.env` в корне проекта (если его нет):

```bash
REACT_APP_SHARETRIBE_SDK_CLIENT_ID=<НОВЫЙ_CLIENT_ID>
SHARETRIBE_SDK_CLIENT_SECRET=<НОВЫЙ_CLIENT_SECRET>
REACT_APP_STRIPE_PUBLISHABLE_KEY=<ВАШ_STRIPE_KEY>
REACT_APP_MAPBOX_ACCESS_TOKEN=<ВАШ_MAPBOX_TOKEN>
REACT_APP_MARKETPLACE_ROOT_URL=http://localhost:3000
```

### Шаг 3: Очистить .env-template от реальных ключей

Отредактируйте `.env-template` и замените реальные ключи на placeholder:

```bash
REACT_APP_SHARETRIBE_SDK_CLIENT_ID=your-client-id-here
SHARETRIBE_SDK_CLIENT_SECRET=your-client-secret-here
```

### Шаг 4: Добавить .env файлы в .gitignore (если еще не добавлены)

```bash
# .gitignore
.env
.env.local
.env.development
.env.test
.env.production
```

### Шаг 5: Удалить файлы из Git репозитория

```bash
# Удалить из индекса, но оставить локально
git rm --cached .env.development
git rm --cached .env.test

# Закоммитить удаление
git commit -m "security: Remove sensitive env files from repository"

# Запушить изменения
git push origin main
```

### Шаг 6: Очистить историю Git (ОПЦИОНАЛЬНО, но РЕКОМЕНДУЕТСЯ)

⚠️ **ВНИМАНИЕ**: Это перепишет всю историю Git! Все, кто работает с репозиторием, должны будут сделать `git pull --rebase`.

```bash
# Использовать BFG Repo-Cleaner (проще чем git filter-branch)
# Установка (macOS):
brew install bfg

# Удалить все упоминания секретов из истории
bfg --replace-text secrets.txt

# secrets.txt содержит:
# 25f4efffdbf69b57b3e97a98c855dc30edb0359d
# 8e494770-470c-47c4-9d95-f8d99baf3a07

# Запустить сборку мусора
git reflog expire --expire=now --all && git gc --prune=now --aggressive

# Force push (это перепишет удаленный репозиторий!)
git push origin main --force
```

### Шаг 7: Уведомить команду

Если с репозиторием работают другие разработчики:
1. Сообщите им о смене ключей
2. Они должны получить новые ключи
3. Они должны сделать `git pull --rebase` после force push

## 📋 Checklist

- [ ] Ротировал ключи в Sharetribe Console
- [ ] Обновил локальный .env файл
- [ ] Очистил .env-template от реальных значений
- [ ] Удалил .env.development и .env.test из Git
- [ ] Закоммитил и запушил изменения
- [ ] (Опционально) Очистил историю Git от старых ключей
- [ ] Уведомил команду о смене ключей

## 🔒 Рекомендации на будущее

1. **Никогда** не коммитить файлы с реальными секретами
2. Использовать `.env` только локально
3. В `.env-template` использовать только placeholder значения
4. Регулярно проверять репозиторий на утечки: https://github.com/trufflesecurity/trufflehog
5. Настроить pre-commit hooks для проверки секретов

## 📚 Полезные ссылки

- BFG Repo-Cleaner: https://rtyley.github.io/bfg-repo-cleaner/
- GitHub: Removing sensitive data: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
- TruffleHog (поиск секретов): https://github.com/trufflesecurity/trufflehog

