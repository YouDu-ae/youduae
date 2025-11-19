# 🔔 Система уведомлений - Улучшения

## ✅ **Что реализовано:**

### **Красная точка (NotificationBadge) в топбаре теперь показывается для:**

1. **📬 Provider (Заказчики):**
   - Новые отклики на их задания (state: `inquiry`)
   - Задания где исполнитель был принят и работает (state: `accepted`)
   - Новые непрочитанные сообщения в чатах

2. **✅ Customer (Исполнители):**
   - Новые отклики которые они оставили (state: `inquiry`)
   - Когда их выбрали исполнителем (state: `accepted`)
   - Новые непрочитанные сообщения в чатах

3. **💬 Все пользователи:**
   - Непрочитанные сообщения в транзакциях

---

## 📝 **Изменения в коде:**

### 1. **`src/transactions/transactionProcessAssignment.js`**

Добавлено:
```javascript
// States where customer needs to take action
export const statesNeedingCustomerAttention = [states.INQUIRY, states.ACCEPTED];
```

**Зачем:**
- `INQUIRY` - Customer (заказчик) должен увидеть новые отклики на свои задания
- `ACCEPTED` - Customer (исполнитель) должен знать что его приняли

---

### 2. **`src/transactions/transaction.js`**

Добавлено:
```javascript
export const getTransitionsNeedingCustomerAttention = () => {
  return PROCESSES.reduce((accTransitions, processInfo) => {
    const statesNeedingCustomerAttention = processInfo.process.statesNeedingCustomerAttention || [];
    const process = processInfo.process;
    const processTransitions = statesNeedingCustomerAttention.reduce(
      (pickedTransitions, stateName) => {
        return [...pickedTransitions, ...getTransitionsToState(process, stateName)];
      },
      []
    );
    return [...new Set([...accTransitions, ...processTransitions])];
  }, []);
};
```

**Зачем:**
- Собирает все transitions которые требуют внимания Customer
- Аналогично `getTransitionsNeedingProviderAttention`

---

### 3. **`src/ducks/user.duck.js`**

Полностью переписан `fetchCurrentUserNotifications()`:

**Было:**
```javascript
// Только для Provider (sales)
const apiQueryParams = {
  only: 'sale',
  last_transitions: transitionsNeedingAttention,
  ...
};
```

**Стало:**
```javascript
// Для Provider (sales) + Customer (orders)
Promise.all([
  sdk.transactions.query(providerQueryParams), // sales
  sdk.transactions.query(customerQueryParams), // orders
])
  .then(([salesResponse, ordersResponse]) => {
    const allTransactions = [...salesTransactions, ...ordersTransactions];
    
    // Фильтруем:
    // 1. Транзакции с нужными transitions
    // 2. Транзакции с непрочитанными сообщениями
    const transactionsNeedingAttention = allTransactions.filter(tx => {
      const hasTransitionNeedingAttention = 
        providerTransitions.includes(tx.attributes.lastTransition) ||
        customerTransitions.includes(tx.attributes.lastTransition);
      
      const hasUnread = hasUnreadUpdates(tx, currentUserId);
      
      return hasTransitionNeedingAttention || hasUnread;
    });

    dispatch(fetchCurrentUserNotificationsSuccess(transactionsNeedingAttention));
  })
```

**Зачем:**
- Теперь уведомления работают для **всех** типов пользователей
- Учитываются **непрочитанные сообщения** (через `hasUnreadUpdates`)
- Красная точка показывается если есть хотя бы одно условие

---

## 🎯 **Логика работы:**

### **Provider (Заказчик):**
1. Создал задание
2. Пришел отклик → **🔴 Красная точка** (state: `inquiry`)
3. Принял исполнителя → Красная точка исчезла
4. Исполнитель работает → **🔴 Красная точка** (state: `accepted`, нужно следить)
5. Получил сообщение в чате → **🔴 Красная точка** (unread message)

### **Customer (Исполнитель):**
1. Оставил отклик → **🔴 Красная точка** (state: `inquiry`, ждет ответа)
2. Его выбрали → **🔴 Красная точка** (state: `accepted`, нужно выполнять)
3. Получил сообщение в чате → **🔴 Красная точка** (unread message)

---

## 🧪 **Как протестировать:**

### **Тест 1: Provider (Заказчик)**
1. Зайти как Provider
2. Создать задание
3. Попросить другого пользователя (Customer) откликнуться
4. ✅ Красная точка должна появиться на "Inbox"

### **Тест 2: Customer (Исполнитель)**
1. Зайти как Customer
2. Откликнуться на задание
3. ✅ Красная точка должна появиться (ждет ответа)
4. Попросить Provider принять отклик
5. ✅ Красная точка остается (нужно выполнять задание)

### **Тест 3: Непрочитанные сообщения**
1. Зайти как любой пользователь
2. Открыть транзакцию, написать сообщение
3. Выйти из чата
4. ✅ Красная точка должна появиться
5. Зайти в чат, прочитать сообщение
6. ✅ Красная точка должна исчезнуть

---

## 📱 **UI компоненты:**

Красная точка рендерится в:
- **Десктоп:** `TopbarDesktop` → `InboxLink` → `NotificationBadge`
- **Мобильный:** `TopbarMobileMenu` → `NamedLink (Inbox)` → `NotificationBadge`

Компонент: `src/components/NotificationBadge/NotificationBadge.js`

---

## 🚀 **Деплой:**

После тестирования на localhost:
```bash
git add -A
git commit -m "🔔 Улучшена система уведомлений"
git push origin main
git push heroku main
```

---

**Автор:** AI Assistant  
**Дата:** 2025-11-19

