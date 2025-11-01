# 🔍 Анализ покрытия tracking - Ответы на вопросы

## ✅ Что можем ответить СЕЙЧАС

### 1. **Сколько всего человек стартанули бота?**
**Ответ:** ✅ **ДА**

```sql
SELECT COUNT(*) FROM users;
-- ИЛИ
SELECT COUNT(*) FROM user_actions WHERE action = 'start';
```

**Источник данных:**
- Таблица `users` - каждый кто запустил /start создается
- Таблица `user_actions` - записывается action='start'

---

### 2. **Сколько человек оплатили в рублях?**
**Ответ:** ✅ **ДА**

```sql
SELECT COUNT(*) 
FROM users 
WHERE currency = 'RUB' AND "hasPaid" = true;
```

**Источник данных:**
- `users.currency` = 'RUB'
- `users.hasPaid` = true

---

### 3. **Сколько человек оплатили в гривнах?**
**Ответ:** ✅ **ДА**

```sql
SELECT COUNT(*) 
FROM users 
WHERE currency = 'UAH' AND "hasPaid" = true;
```

**Источник данных:**
- `users.currency` = 'UAH'
- `users.hasPaid` = true

---

### 4. **Сколько уникальных человек и сколько раз попытались прислать НЕ платежную квитанцию?**
**Ответ:** ❌ **НЕТ** (не отслеживается)

**Проблема:**
- Мы НЕ записываем отказы валидации
- Нет action для "photo_rejected" или "not_a_receipt"

**Что нужно добавить:**
```typescript
// В обработчике фото, когда validationResult.isValid === false
await trackUserAction(userService, ctx, 'receipt_rejected', state.step, {
  reason: validationResult.reason,
  isReceipt: validationResult.isReceipt
});
```

**Потом можно будет:**
```sql
-- Уникальных человек
SELECT COUNT(DISTINCT "userId") 
FROM user_actions 
WHERE action = 'receipt_rejected';

-- Всего попыток
SELECT COUNT(*) 
FROM user_actions 
WHERE action = 'receipt_rejected';
```

---

### 5. **Сколько уникальных человек прислали платежную квитанцию, но она не подошла?**
**Ответ:** ❌ **НЕТ** (не отслеживается)

**Проблема:**
- Нет разделения между "не квитанция" и "квитанция не подходит"
- Нужно записывать `isReceipt: true` + причину отказа

**Что нужно добавить:**
```typescript
// Когда isReceipt=true но другие проблемы (сумма/карта/fraud)
await trackUserAction(userService, ctx, 'receipt_validation_failed', state.step, {
  reason: validationResult.reason,
  isReceipt: true,
  isFraud: validationResult.isFraud,
  extractedAmount: validationResult.extractedAmount,
  extractedCardNumber: validationResult.extractedCardNumber
});
```

**Потом можно будет:**
```sql
-- Уникальных человек
SELECT COUNT(DISTINCT "userId") 
FROM user_actions 
WHERE action = 'receipt_validation_failed' 
  AND metadata->>'isReceipt' = 'true';

-- Всего попыток
SELECT COUNT(*) 
FROM user_actions 
WHERE action = 'receipt_validation_failed';
```

---

### 6. **Сколько всего человек обратились за помощью к ассистенту?**
**Ответ:** ❌ **НЕТ** (не отслеживается)

**Проблема:**
- Нет кнопки "Помощь ассистента" в текущем коде
- Или есть, но мы не записываем клики

**Что нужно добавить:**
```typescript
// Когда пользователь нажимает "Помощь ассистента"
bot.action('need_help', async (ctx) => {
  await trackUserAction(userService, ctx, 'request_help', state.step);
  // ... остальной код
});
```

**Потом можно будет:**
```sql
-- Уникальных человек
SELECT COUNT(DISTINCT "userId") 
FROM user_actions 
WHERE action = 'request_help';

-- По этапам воронки
SELECT step, COUNT(DISTINCT "userId") as users
FROM user_actions 
WHERE action = 'request_help'
GROUP BY step;
```

---

### 7. **Сколько человек не продвинулись дальше каждой кнопки?**
**Ответ:** ⚠️ **ЧАСТИЧНО**

#### 7.1. **Кнопка "Хочу!"** - ✅ **ДА**
```sql
-- Всего нажали "Хочу!"
SELECT COUNT(DISTINCT "userId") 
FROM user_actions 
WHERE action = 'click_want_more';

-- Не продвинулись дальше (застряли на video1)
SELECT COUNT(*) 
FROM users 
WHERE "currentStep" = 'video1';
```

#### 7.2. **Кнопка "Смотреть дальше"** - ❌ **НЕТ**
**Проблема:** Нет tracking для этой кнопки

**Нужно добавить:**
```typescript
bot.action('continue_watching', async (ctx) => {
  await trackUserAction(userService, ctx, 'click_continue_watching', 'video2');
  // ...
});
```

#### 7.3. **Кнопка "Готов!"** - ❌ **НЕТ**
**Проблема:** Нет tracking

**Нужно добавить:**
```typescript
bot.action('ready_for_more', async (ctx) => {
  await trackUserAction(userService, ctx, 'click_ready', 'video3');
  // ...
});
```

#### 7.4. **Кнопка "Забрать преимущество!"** - ❌ **НЕТ**
**Проблема:** Нет tracking

**Нужно добавить:**
```typescript
bot.action('get_advantage', async (ctx) => {
  await trackUserAction(userService, ctx, 'click_get_advantage', 'payment_choice');
  // ...
});
```

#### 7.5. **Выбор метода оплаты (RUB/UAH)** - ✅ **ДА**
```sql
-- Выбрали RUB
SELECT COUNT(DISTINCT "userId") 
FROM user_actions 
WHERE action = 'choose_rub';

-- Выбрали UAH
SELECT COUNT(DISTINCT "userId") 
FROM user_actions 
WHERE action = 'choose_uah';

-- Не загрузили чек после выбора
SELECT COUNT(*) 
FROM users 
WHERE "currentStep" = 'waiting_receipt' AND "hasPaid" = false;
```

---

### 8. **Сколько человек перешли по одноразовым инвайт ссылкам?**
**Ответ:** ❌ **НЕТ** (невозможно отследить напрямую)

**Проблема:**
- Telegram не дает webhook когда кто-то переходит по invite link
- Можем только предположить через:
  - Bot API method `getChatMember` после выдачи ссылки
  - Webhook events когда пользователь присоединился к каналу

**Частичное решение:**
```typescript
// После создания invite link
await trackUserAction(userService, ctx, 'invite_link_generated', 'completed', {
  channelLink: channelInviteLink,
  chatLink: chatInviteLink
});

// Потом можно проверять вручную через Telegram API
// или ждать когда пользователь напишет в чате
```

**Лучшее решение:**
Использовать Telegram Bot API для мониторинга:
```typescript
// Периодически проверять членство в канале
setInterval(async () => {
  const users = await userService.getCompletedUsers();
  for (const user of users) {
    const member = await bot.telegram.getChatMember(config.channelId, user.userId);
    if (member.status !== 'left' && member.status !== 'kicked') {
      // Пользователь в канале - значит перешел по ссылке
      await trackUserAction(userService, ctx, 'joined_channel', 'completed');
    }
  }
}, 3600000); // Каждый час
```

---

## ❌ Что НЕ МОЖЕМ ответить (нужно добавить tracking)

### Критически важные метрики:

1. **Отказы валидации чека**
   - Не квитанция
   - Квитанция не подходит
   - Причины отказов

2. **Клики по кнопкам воронки**
   - "Смотреть дальше"
   - "Готов!"
   - "Забрать преимущество!"

3. **Обращения к ассистенту**
   - Кто и когда
   - На каком этапе

4. **Переходы по invite links**
   - Сколько присоединились к каналу
   - Сколько к чату

---

## 📋 TODO: Что добавить для полного tracking

### Priority 1 (Критично):
```typescript
// 1. Отказ валидации - НЕ квитанция
await trackUserAction(userService, ctx, 'photo_rejected', state.step, {
  reason: 'not_a_receipt',
  imageDescription: validationResult.imageDescription
});

// 2. Отказ валидации - квитанция НЕ подходит
await trackUserAction(userService, ctx, 'receipt_validation_failed', state.step, {
  reason: validationResult.reason,
  isReceipt: true,
  isFraud: validationResult.isFraud
});

// 3. Клик "Смотреть дальше"
bot.action('continue_watching', async (ctx) => {
  await trackUserAction(userService, ctx, 'click_continue_watching', 'video2');
});

// 4. Клик "Готов!"
bot.action('ready_for_more', async (ctx) => {
  await trackUserAction(userService, ctx, 'click_ready', 'video3');
});

// 5. Клик "Забрать преимущество!"
bot.action('get_advantage', async (ctx) => {
  await trackUserAction(userService, ctx, 'click_get_advantage', 'payment_choice');
});
```

### Priority 2 (Желательно):
```typescript
// 6. Запрос помощи
bot.action('need_help', async (ctx) => {
  await trackUserAction(userService, ctx, 'request_help', state.step);
});

// 7. Отправка фото чека (до валидации)
await trackUserAction(userService, ctx, 'receipt_uploaded', state.step);

// 8. Генерация invite links
await trackUserAction(userService, ctx, 'invite_links_generated', 'completed');
```

### Priority 3 (Nice to have):
```typescript
// 9. Просмотр видео (если можно отследить)
await trackUserAction(userService, ctx, 'video_watched', 'video1', {
  videoNumber: 1
});

// 10. Мониторинг присоединения к каналу
// (через periodic check)
```

---

## 📊 Summary

### ✅ Можем ответить (5 из 8):
1. ✅ Сколько стартанули бота
2. ✅ Сколько оплатили в RUB
3. ✅ Сколько оплатили в UAH
4. ❌ Попытки прислать НЕ квитанцию
5. ❌ Квитанция не подошла
6. ❌ Обращения к ассистенту
7. ⚠️ Застряли на кнопках (частично - только "Хочу!" и выбор валюты)
8. ❌ Переходы по invite links

### Покрытие: **~40%**

### Чтобы ответить на ВСЕ вопросы, нужно:
- Добавить 5 новых actions (priority 1)
- Добавить 3 дополнительных actions (priority 2)
- Реализовать мониторинг каналов (priority 3)

**Хотите, чтобы я добавил недостающий tracking?** 🚀
