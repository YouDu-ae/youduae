#!/bin/bash

# Скрипт для backup .env файлов
# Использование: ./scripts/backup-env.sh

BACKUP_DIR="$HOME/Dropbox/youdo-backups"  # или iCloud Drive
DATE=$(date +%Y-%m-%d)
BACKUP_FILE="youdo-env-$DATE.zip"

echo "🔐 Creating encrypted backup of .env files..."

# Создать папку если не существует
mkdir -p "$BACKUP_DIR"

# Создать зашифрованный архив
zip -e -j "$BACKUP_DIR/$BACKUP_FILE" .env .env.development .env.test 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Backup created: $BACKUP_DIR/$BACKUP_FILE"
    echo "📁 Location: $BACKUP_DIR"
    
    # Удалить старые backup (старше 30 дней)
    find "$BACKUP_DIR" -name "youdo-env-*.zip" -mtime +30 -delete
    echo "🗑️  Old backups cleaned (>30 days)"
else
    echo "❌ Backup failed!"
    exit 1
fi

echo ""
echo "💡 Remember to store the password in 1Password!"

