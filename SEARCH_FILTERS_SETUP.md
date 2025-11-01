# Настройка фильтров поиска в Sharetribe Console

## Проблема
Фильтры "Дата выполнения" и "Способ оплаты" отправляют параметры в URL (`pub_deadline`, `pub_paymentMethod`), но API не может их использовать для фильтрации, потому что они не настроены в search schema.

## Решение: Добавить поля в Sharetribe Console

### Шаг 1: Откройте Sharetribe Console
1. Перейдите на https://console.sharetribe.com
2. Выберите ваш маркетплейс
3. Перейдите в **Build → Listing fields**

### Шаг 2: Добавьте поле "deadline"
1. Нажмите **"Add new field"**
2. Заполните:
   - **Field key**: `deadline`
   - **Field type**: `Enum` (single value)
   - **Scope**: `Public`
   - **Options**:
     - `today` - Сегодня
     - `tomorrow` - Завтра
     - `week` - В течении недели
     - `long-term` - Долгосрочно
3. В разделе **Search**:
   - ✅ Включите **"Enable search by this field"**
   - **Search filter type**: `SelectSingleFilter`
4. Нажмите **Save**

### Шаг 3: Добавьте поле "paymentMethod"
1. Нажмите **"Add new field"**
2. Заполните:
   - **Field key**: `paymentMethod`
   - **Field type**: `Enum` (single value)
   - **Scope**: `Public`
   - **Options**:
     - `cash` - Наличными
     - `bank-transfer` - Банковский перевод (Карта/перевод)
3. В разделе **Search**:
   - ✅ Включите **"Enable search by this field"**
   - **Search filter type**: `SelectSingleFilter`
4. Нажмите **Save**

### Шаг 4: Обновите search schema
После добавления полей Sharetribe автоматически обновит search schema.
Это может занять несколько минут.

### Шаг 5: Проверьте работу
1. Обновите страницу `/s`
2. Выберите фильтр "Дата выполнения" → "Сегодня"
3. Результаты должны отфильтроваться ✅

## Альтернатива: Использование Flex CLI

Если у вас есть доступ к Flex CLI, вы можете добавить поля через командную строку:

```bash
# Добавить поле deadline
flex-cli listings add-field --key deadline --type enum --scope public --enumOptions "today,tomorrow,week,long-term"

# Добавить поле paymentMethod  
flex-cli listings add-field --key paymentMethod --type enum --scope public --enumOptions "cash,bank-transfer"

# Обновить search schema
flex-cli search update-schema
```

## Примечание
После настройки в Console фильтры будут работать **автоматически** - код уже готов! ✅

## Текущий статус
- ✅ Код фильтров реализован (`configListing.js`)
- ✅ UI фильтров отображается на странице `/s`
- ✅ Параметры отправляются в URL (`pub_deadline`, `pub_paymentMethod`)
- ⏳ Ожидается: Добавление полей в Sharetribe Console

