# 🔔 ПОЛНАЯ СИСТЕМА АВТОМАТИЧЕСКИХ РАССЫЛОК

## Обзор всех автоматических сообщений

Бот имеет **2 типа автоматических рассылок:**
1. **WARMUP** (догрев) - мотивационные сообщения с фото и кнопками оплаты
2. **REMINDER** (напоминания) - простые текстовые напоминания

---

# 🔥 WARMUP СИСТЕМА (WarmupService)

## 1️⃣ WARMUP НА СТАРТЕ

### 📍 Условия срабатывания:
```sql
SELECT * FROM users 
WHERE currentStep = 'start' 
AND hasPaid = false 
AND warmupStartSent = false 
AND lastActivityAt < NOW() - INTERVAL '5 minutes'
```

**Проще говоря:**
- Пользователь **застрял** на этапе `start`
- **Не оплатил**
- **Не получал** warmup ранее (`warmupStartSent = false`)
- **Прошло 5+ минут** с момента последней активности

### ⏰ Когда проверяется:
**Каждые 2 минуты** (фоновый процесс `WarmupService.sendWarmupReminders()`)

### 📨 Что отправляется:

#### Сообщение 1: MediaGroup (2 фото + текст)
```
[Имя], 90% застревают именно на этом шаге. А те кто прошел дальше уже вчера попали в наш чат и уже сняли свои первые 10 рилс в тот же день и пишут вот такие отзывы в восторге. Ты тоже в шаге от того чтобы получить мои инструменты которые принесли мне 15 000$ через рилс. 

Если не хочешь смотреть видео о продукте, можешь просто пропустить этот шаг и перейти к оплате.
```

**Фото:**
- `image_1_screen.jpeg` (скриншот отзывов)
- `Image_2_screen.jpeg` (скриншот отзывов)

#### Сообщение 2: Кнопки оплаты
```
💳 Выбери способ оплаты:
```

**Кнопки:**
```
[💵 Оплатить в рублях (RUB) - Tribute]
[💳 Оплатить в евро (EUR) - Tribute]
[💴 Оплатить в гривнах (UAH)]
```

### 🗄️ Что записывается в БД:
```sql
UPDATE users 
SET warmupStartSent = true,
    updatedAt = NOW()
WHERE userId = 123456789
```

### 📊 Как отображается в статистике:

**В /stats в воронке:**
```
🚫 Застряли на старте: 28 (🔥 28)
                            ↑
                    все получили warmup
```

**В /stats в UPDATES:**
```
🔥 Warmup Start отправлено: +28
```

### 🎯 Что происходит дальше:

#### Вариант A: Пользователь кликает на кнопку оплаты
```sql
-- Запись клика
INSERT INTO user_actions (userId, action, timestamp, metadata)
VALUES (123456789, 'tribute_rub_click', NOW(), '{"button": "RUB"}')

-- Обновление статуса
UPDATE users SET 
  currentStep = 'waiting_receipt',
  currency = 'RUB',
  waitingReceiptSince = NOW(),
  lastActivityAt = NOW()
WHERE userId = 123456789
```

**В /stats в UPDATES:**
```
📊 Изменения в воронке:
  • Старт: -1 (ушёл с этапа)
  • Ждут квитанции: +1 (попал на новый этап)
```

#### Вариант B: Пользователь нажимает "Хочу получить доступ!"
```sql
UPDATE users SET 
  currentStep = 'video1',
  video1ShownAt = NOW(),
  lastActivityAt = NOW()
WHERE userId = 123456789
```

**В /stats в UPDATES:**
```
📊 Изменения в воронке:
  • Старт: -1
  • Видео1: +1
```

#### Вариант C: Пользователь игнорирует
- Остаётся на этапе `start`
- Флаг `warmupStartSent = true` не даст отправить повторно
- Больше автоматических сообщений на этом этапе **НЕТ**

---

## 2️⃣ WARMUP НА VIDEO1

### 📍 Условия срабатывания:
```sql
SELECT * FROM users 
WHERE currentStep = 'video1' 
AND hasPaid = false 
AND warmupVideo1Sent = false 
AND lastActivityAt < NOW() - INTERVAL '10 minutes'
```

**Проще говоря:**
- Пользователь **застрял** на этапе `video1` (посмотрел первое видео, но не нажал "Продолжить")
- **Не оплатил**
- **Не получал** warmup на video1 (`warmupVideo1Sent = false`)
- **Прошло 10+ минут** с момента последней активности

### ⏰ Когда проверяется:
**Каждые 2 минуты** (фоновый процесс `WarmupService.sendWarmupReminders()`)

### 📨 Что отправляется:

**ТОЧНО ТО ЖЕ** сообщение что и на старте:
- MediaGroup (2 фото + текст)
- Кнопки оплаты (RUB/EUR/UAH)

### 🗄️ Что записывается в БД:
```sql
UPDATE users 
SET warmupVideo1Sent = true,
    updatedAt = NOW()
WHERE userId = 123456789
```

### 📊 Как отображается в статистике:

**В /stats в воронке:**
```
📹 Застряли на видео 1: 114 (📨 45) (🔥 114)
                             ↑        ↑
                    45 reminder   114 warmup
```

**В /stats в UPDATES:**
```
🔥 Warmup Video1 отправлено: +114
```

### 🎯 Что происходит дальше:

#### Вариант A: Нажимает кнопку оплаты
```sql
UPDATE users SET 
  currentStep = 'waiting_receipt',
  currency = 'RUB',
  lastActivityAt = NOW()
WHERE userId = 123456789
```

**В /stats:**
```
📊 Изменения в воронке:
  • Видео1: -1
  • Ждут квитанции: +1
```

#### Вариант B: Нажимает "Продолжить ▶️"
```sql
UPDATE users SET 
  currentStep = 'video2',
  lastActivityAt = NOW()
WHERE userId = 123456789
```

**В /stats:**
```
📊 Изменения в воронке:
  • Видео1: -1
  • Видео2: +1
```

#### Вариант C: Игнорирует
- Остаётся на `video1`
- `warmupVideo1Sent = true`
- Больше warmup **НЕТ**
- Но есть ещё **REMINDER** (см. ниже)!

---

# 📨 REMINDER СИСТЕМА (ReminderService)

## 3️⃣ REMINDER НА VIDEO1

### 📍 Условия срабатывания:
```sql
SELECT * FROM users 
WHERE currentStep = 'video1' 
AND hasPaid = false 
AND video1ReminderSent = false 
AND video1ShownAt < NOW() - INTERVAL '10 minutes'
```

**Проще говоря:**
- Застрял на `video1`
- **Не получал** обычное напоминание (`video1ReminderSent = false`)
- **Прошло 10+ минут** с момента **показа видео** (`video1ShownAt`)

### ⏰ Когда проверяется:
**Каждые 2 минуты** (фоновый процесс `ReminderService.checkReminders()`)

### 📨 Что отправляется:

```
👋 Эй, не забудь нажать "Продолжить" чтобы посмотреть следующее видео! 

Ты уже прошёл больше половины пути к моим инструментам для создания вирусных Reels 🎥
```

**Кнопка повторно:**
```
[Продолжить ▶️]
```

### 🗄️ Что записывается в БД:
```sql
UPDATE users 
SET video1ReminderSent = true,
    updatedAt = NOW()
WHERE userId = 123456789
```

### 📊 Как отображается в статистике:

**В /stats в воронке:**
```
📹 Застряли на видео 1: 114 (📨 45) (🔥 114)
                             ↑
                    45 получили reminder
```

### 🎯 Что происходит дальше:

#### Вариант A: Нажимает "Продолжить"
```sql
UPDATE users SET 
  currentStep = 'video2',
  lastActivityAt = NOW()
WHERE userId = 123456789
```

**В /stats:**
```
📊 Изменения в воронке:
  • Видео1: -1
  • Видео2: +1
```

#### Вариант B: Игнорирует
- Остаётся на `video1`
- `video1ReminderSent = true`
- Уже получил и **warmup** и **reminder**
- Больше автоматических сообщений **НЕТ**

---

## 4️⃣ REMINDER НА PAYMENT_CHOICE

### 📍 Условия срабатывания:
```sql
SELECT * FROM users 
WHERE currentStep = 'payment_choice' 
AND hasPaid = false 
AND paymentReminderSent = false 
AND paymentChoiceShownAt < NOW() - INTERVAL '5 minutes'
```

**Проще говоря:**
- Дошёл до выбора оплаты, но **не выбрал** способ
- **Не получал** reminder (`paymentReminderSent = false`)
- **Прошло 5+ минут** с момента показа выбора оплаты

### ⏰ Когда проверяется:
**Каждые 2 минуты** (фоновый процесс `ReminderService.checkReminders()`)

### 📨 Что отправляется:

```
💳 Не забудь выбрать способ оплаты!

Ты всего в одном клике от доступа к инструментам, которые принесли мне 15 000$ через Reels 🚀

Выбери удобный способ:
```

**Кнопки повторно:**
```
[💵 Оплатить в рублях (RUB) - Tribute]
[💳 Оплатить в евро (EUR) - Tribute]
[💴 Оплатить в гривнах (UAH)]
```

### 🗄️ Что записывается в БД:
```sql
UPDATE users 
SET paymentReminderSent = true,
    updatedAt = NOW()
WHERE userId = 123456789
```

### 📊 Как отображается в статистике:

**В /stats в воронке:**
```
💳 Застряли на выборе оплаты: 17 (📨 12)
                                   ↑
                          12 получили reminder
```

### 🎯 Что происходит дальше:

#### Вариант A: Нажимает кнопку оплаты
```sql
UPDATE users SET 
  currentStep = 'waiting_receipt',
  currency = 'RUB',
  lastActivityAt = NOW()
WHERE userId = 123456789
```

**В /stats:**
```
📊 Изменения в воронке:
  • Выбор оплаты: -1
  • Ждут квитанции: +1
```

#### Вариант B: Игнорирует
- Остаётся на `payment_choice`
- `paymentReminderSent = true`
- Больше автоматических сообщений **НЕТ**

---

## 5️⃣ REMINDER НА WAITING_RECEIPT (UAH)

### ⚠️ ВАЖНО: ОТКЛЮЧЕНО ДЛЯ RUB/EUR!

### 📍 Условия срабатывания:
```sql
SELECT * FROM users 
WHERE currentStep = 'waiting_receipt' 
AND hasPaid = false 
AND receiptReminderSent = false 
AND currency = 'UAH'  -- ТОЛЬКО для UAH!
AND waitingReceiptSince < NOW() - INTERVAL '30 minutes'
```

**Проще говоря:**
- Выбрал оплату UAH, но **не прислал** квитанцию
- **Прошло 30+ минут**
- Только для **UAH** (RUB/EUR автоматические через Tribute)

### ⏰ Когда проверяется:
**Каждые 2 минуты** (фоновый процесс `ReminderService.checkReminders()`)

### 📨 Что отправляется:

```
📸 Не забудь прислать скриншот квитанции!

Реквизиты для оплаты:
💴 Сумма: 2100 ₴
💳 Карта: 5169 1551 2428 3993

После оплаты просто пришли скриншот подтверждения 📱
```

### 🗄️ Что записывается в БД:
```sql
UPDATE users 
SET receiptReminderSent = true,
    updatedAt = NOW()
WHERE userId = 123456789
```

### 📊 Как отображается в статистике:

**В /stats в воронке:**
```
⏳ Выбрали оплату, нет квитанции: 72 (📨 0)
                                       ↑
                            0 для RUB/EUR (автомат)
                            могут быть для UAH
```

### 🎯 Что происходит дальше:

#### Вариант A: Присылает квитанцию
- Gemini AI проверяет
- Если валидна → `hasPaid = true`, `currentStep = 'completed'`
- Если НЕ валидна → `currentStep = 'receipt_rejected'`

#### Вариант B: Игнорирует
- Остаётся на `waiting_receipt`
- `receiptReminderSent = true`
- Больше автоматических сообщений **НЕТ**

---

# 📊 СВОДНАЯ ТАБЛИЦА ВСЕХ РАССЫЛОК

| # | Этап | Тип | Задержка | Условие | Сообщение | Флаг БД |
|---|------|-----|----------|---------|-----------|---------|
| 1 | `start` | 🔥 WARMUP | 5 мин | `lastActivityAt` | 2 фото + текст + 3 кнопки | `warmupStartSent` |
| 2 | `video1` | 🔥 WARMUP | 10 мин | `lastActivityAt` | 2 фото + текст + 3 кнопки | `warmupVideo1Sent` |
| 3 | `video1` | 📨 REMINDER | 10 мин | `video1ShownAt` | Текст "Продолжить" + кнопка | `video1ReminderSent` |
| 4 | `payment_choice` | 📨 REMINDER | 5 мин | `paymentChoiceShownAt` | Текст + 3 кнопки оплаты | `paymentReminderSent` |
| 5 | `waiting_receipt` | 📨 REMINDER | 30 мин | `waitingReceiptSince` (UAH) | Напоминание отправить квитанцию | `receiptReminderSent` |

---

# 🔄 ПРИМЕРЫ ДВИЖЕНИЯ ПОЛЬЗОВАТЕЛЯ

## Пример 1: Активный пользователь (идеальный путь)

```
⏰ 14:00 - START
          ├─ Сразу нажал "Хочу доступ" → video1
          
⏰ 14:02 - VIDEO 1
          ├─ Сразу нажал "Продолжить" → video2
          
⏰ 14:05 - VIDEO 2
          ├─ Нажал "Готов" → video3
          
⏰ 14:08 - VIDEO 3
          ├─ Нажал "Хочу доступ" → payment_choice
          
⏰ 14:10 - PAYMENT CHOICE
          ├─ Нажал RUB Tribute → waiting_receipt
          
⏰ 14:12 - Оплатил через Tribute
          
⏰ 14:15 - Channel Sync проверил → hasPaid = true
          ├─ Получил доступ! → completed

Статистика:
- Warmup отправлено: 0
- Reminder отправлено: 0
- Время до оплаты: 15 минут
```

---

## Пример 2: Застрял на старте

```
⏰ 14:00 - START
          ├─ Ничего не нажал
          
⏰ 14:05 - ⚡ WARMUP START (5 мин)
          ├─ Получил 2 фото + текст + кнопки
          ├─ Нажал кнопку RUB → waiting_receipt
          
⏰ 14:07 - WAITING RECEIPT
          ├─ Оплатил через Tribute
          
⏰ 14:10 - Channel Sync → hasPaid = true
          ├─ Получил доступ! → completed

Статистика:
- Warmup отправлено: 1 (start)
- Reminder отправлено: 0
- Время до оплаты: 10 минут
- Эффект warmup: +1 конверсия ✅

В /stats UPDATES:
  🔥 Warmup Start отправлено: +1
  
  📊 Изменения в воронке:
    • Старт: -1
    • Ждут квитанции: +1
```

---

## Пример 3: Застрял на video1

```
⏰ 14:00 - START
          ├─ Нажал "Хочу доступ" → video1
          
⏰ 14:02 - VIDEO 1
          ├─ Посмотрел видео, но НЕ нажал "Продолжить"
          
⏰ 14:12 - ⚡ REMINDER VIDEO1 (10 мин от video1ShownAt)
          ├─ Получил "Не забудь продолжить"
          ├─ Игнорировал
          
⏰ 14:12 - ⚡ WARMUP VIDEO1 (10 мин от lastActivityAt)
          ├─ Получил 2 фото + текст + кнопки
          ├─ Нажал кнопку EUR → waiting_receipt
          
⏰ 14:15 - Оплатил через Tribute EUR
          
⏰ 14:18 - Channel Sync → hasPaid = true
          ├─ Получил доступ! → completed

Статистика:
- Warmup отправлено: 1 (video1)
- Reminder отправлено: 1 (video1)
- Время до оплаты: 18 минут
- Эффект warmup+reminder: +1 конверсия ✅

В /stats UPDATES:
  🔥 Warmup Video1 отправлено: +1
  
  📊 Изменения в воронке:
    • Видео1: -1
    • Ждут квитанции: +1
```

---

## Пример 4: Дошёл до оплаты, но застрял

```
⏰ 14:00 - Прошёл start → video1 → video2 → video3
          
⏰ 14:15 - PAYMENT CHOICE
          ├─ Увидел кнопки оплаты, но ничего не нажал
          
⏰ 14:20 - ⚡ REMINDER PAYMENT (5 мин от paymentChoiceShownAt)
          ├─ Получил "Не забудь выбрать оплату"
          ├─ Нажал UAH → waiting_receipt
          
⏰ 14:22 - Отправил неправильное фото
          ├─ Gemini AI: ❌ не квитанция
          ├─ currentStep = 'receipt_rejected'
          
⏰ 14:25 - Отправил правильную квитанцию
          ├─ Gemini AI: ✅ валидна
          ├─ hasPaid = true → completed

Статистика:
- Warmup отправлено: 0
- Reminder отправлено: 1 (payment_choice)
- Эффект reminder: +1 конверсия ✅

В /stats UPDATES:
  📊 Изменения в воронке:
    • Выбор оплаты: -1
    • Ждут квитанции: +1
```

---

## Пример 5: Полностью игнорирует

```
⏰ 14:00 - START
          ├─ Ничего не нажал
          
⏰ 14:05 - ⚡ WARMUP START
          ├─ Получил, игнорировал
          
⏰ 15:00 - Всё ещё на start
          ├─ warmupStartSent = true
          ├─ Больше сообщений НЕТ
          
В /stats воронка:
  🚫 Застряли на старте: 1 (🔥 1)
                              ↑
                    получил warmup, но игнорировал
```

---

# 🎯 ЭФФЕКТИВНОСТЬ РАССЫЛОК

## Реальные данные из /stats:

```
📹 Застряли на видео 1: 114 (📨 45) (🔥 114)

Интерпретация:
- Всего застряло: 114 человек
- Получили reminder: 45 (39%)
- Получили warmup: 114 (100%)
- 
- Если 114 получили warmup, но остались:
  → Warmup НЕ помог: 0% эффективность? ❌
  
  НЕТ! Это ТЕКУЩЕЕ состояние!
  
- Правильная интерпретация:
  → Сейчас застряло 114
  → Из них 114 уже получили warmup
  → Сколько ушло после warmup смотрим в UPDATES!
```

## В секции UPDATES видим реальный эффект:

```
📈 UPDATES (за последние 5 минут)

🔥 Warmup Video1 отправлено: +15
    ↓
📊 Изменения в воронке:
  • Видео1: -8 (уменьшилось!)
  • Видео2: +3
  • Выбор оплаты: +2
  • Ждут квитанции: +3

Вывод: из 15 получивших warmup:
- 8 продвинулись (53% эффективность)
- 7 остались на месте
```

---

# 🔧 ТЕХНИЧЕСКАЯ РЕАЛИЗАЦИЯ

## Фоновые процессы запускаются в index.ts:

```typescript
// 1. ReminderService (каждые 2 минуты)
reminderService = new ReminderService(bot);
reminderService.start();

// 2. WarmupService (каждые 2 минуты)
const warmupService = new WarmupService(bot);
await warmupService.sendWarmupReminders();
setInterval(async () => {
  await warmupService.sendWarmupReminders();
}, 2 * 60 * 1000);

// 3. ChannelSyncService (каждые 6 часов)
const channelSyncService = new ChannelSyncService(bot);
setInterval(async () => {
  await channelSyncService.syncChannelMembers(channelId);
}, 6 * 60 * 60 * 1000);
```

## Логи в консоли Railway:

```
🔔 Запуск сервиса напоминаний...
✅ ReminderService запущен
✅ WarmupService запущен (проверка каждые 2 минуты)

🔥 Warmup: найдено 3 на start, 7 на video1
✅ Warmup отправлен пользователю 123456 (start)
✅ Warmup отправлен пользователю 789012 (video1)
❌ Ошибка отправки warmup пользователю 345678: USER_IS_BLOCKED

🔔 Проверка напоминаний...
✅ Reminder video1 отправлен пользователю 456789
✅ Reminder payment отправлен пользователю 901234
```

---

# 📋 CHECKLIST ДЛЯ АДМИНА

## Как понять что рассылки работают:

### 1. Проверь логи на Railway:
```
✅ WarmupService запущен
✅ ReminderService запущен
🔥 Warmup: найдено X на start, Y на video1
```

### 2. Отправь /stats и проверь:
```
📹 Застряли на видео 1: 114 (📨 45) (🔥 114)
                             ↑        ↑
                      есть счётчики
```

### 3. Подожди 5 минут, снова /stats:
```
📈 UPDATES
🔥 Warmup Start отправлено: +3
🔥 Warmup Video1 отправлено: +7

📊 Изменения в воронке:
  • Старт: -2 (warmup помог!)
  • Видео1: -5 (warmup помог!)
```

### 4. Проверь БД напрямую:
```sql
SELECT 
  COUNT(*) FILTER (WHERE warmupStartSent = true) as warmup_start_sent,
  COUNT(*) FILTER (WHERE warmupVideo1Sent = true) as warmup_video1_sent,
  COUNT(*) FILTER (WHERE video1ReminderSent = true) as video1_reminder_sent,
  COUNT(*) FILTER (WHERE paymentReminderSent = true) as payment_reminder_sent
FROM users;
```

---

**Обновлено:** 6 ноября 2025  
**Версия:** 2.0  
**Статус:** Все рассылки активны и работают ✅
