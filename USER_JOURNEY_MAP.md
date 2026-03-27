# 🗺️ КАРТА ПУТИ ПОЛЬЗОВАТЕЛЯ - Reels Sale Bot

## 📱 Полный путь от старта до оплаты

---

## 🚀 ЭТАП 1: СТАРТ БОТА

### Действие пользователя:
Пользователь нажимает **START** или отправляет `/start` в боте

### Что происходит:
1. **База данных:**
   - Создаётся запись в таблице `users`:
     ```
     userId: 123456789
     username: "john_doe"
     firstName: "John"
     currentStep: "start"
     hasPaid: false
     createdAt: NOW()
     lastActivityAt: NOW()
     ```
   - Создаётся запись в `user_actions`:
     ```
     action: "start"
     timestamp: NOW()
     ```

2. **Сообщение боту:**
   ```
   Привет, [Имя]! 👋
   
   Ты получишь доступ к моим инструментам для создания вирусных Reels,
   которые принесли мне 15 000$ за последние месяцы.
   
   Давай покажу тебе что внутри! 🎥
   ```
   
   **Кнопка:** `Хочу получить доступ! 🔥`

3. **Отслеживание:**
   - `currentStep = "start"`
   - Начинается отсчёт времени с `lastActivityAt`

---

## ⏰ ДОГРЕВ НА СТАРТЕ (через 5 минут)

### Условие срабатывания:
Пользователь **НЕ нажал** кнопку "Хочу получить доступ" в течение 5 минут

### Что происходит:
1. **WarmupService (каждые 2 минуты проверяет):**
   ```sql
   SELECT * FROM users 
   WHERE currentStep = 'start' 
   AND hasPaid = false 
   AND warmupStartSent = false 
   AND lastActivityAt < NOW() - INTERVAL '5 minutes'
   ```

2. **Отправляется warmup сообщение:**
   - **Текст:**
     ```
     [Имя], 90% застревают именно на этом шаге. 
     А те кто прошел дальше уже вчера попали в наш чат 
     и уже сняли свои первые 10 рилс в тот же день 
     и пишут вот такие отзывы в восторге.
     
     Ты тоже в шаге от того чтобы получить мои инструменты 
     которые принесли мне 15 000$ через рилс.
     
     Если не хочешь смотреть видео о продукте, можешь просто 
     пропустить этот шаг и перейти к оплате.
     ```
   
   - **2 фото:** `image_1_screen.jpeg`, `image_2_screen.jpeg` (отзывы)
   
   - **3 кнопки оплаты:**
     ```
     💵 Оплатить в рублях (RUB) - Tribute
     💳 Оплатить в евро (EUR) - Tribute
     💴 Оплатить в гривнах (UAH)
     ```

3. **База данных:**
   ```sql
   UPDATE users SET warmupStartSent = true WHERE userId = 123456789
   ```

---

## 🎬 ЭТАП 2: ПЕРВОЕ ВИДЕО

### Действие пользователя:
Нажимает кнопку **"Хочу получить доступ! 🔥"**

### Что происходит:
1. **База данных:**
   ```sql
   UPDATE users SET 
     currentStep = 'video1',
     video1ShownAt = NOW(),
     lastActivityAt = NOW()
   WHERE userId = 123456789
   ```
   
   ```sql
   INSERT INTO user_actions (userId, action, timestamp)
   VALUES (123456789, 'want_button', NOW())
   ```

2. **Сообщение боту:**
   Отправляется **ВИДЕО 1** (file_id из .env):
   ```
   🎥 Видео 1: Основы создания вирусных Reels
   
   Смотри что я подготовил для тебя! 👇
   ```
   
   **Кнопка:** `Продолжить ▶️`

3. **Отслеживание:**
   - `currentStep = "video1"`
   - `video1ShownAt = NOW()`

---

## ⏰ REMINDER НА VIDEO1 (через 10 минут)

### Условие срабатывания:
Пользователь **НЕ нажал** "Продолжить" после видео 1 в течение 10 минут

### Что происходит:
1. **ReminderService (каждые 2 минуты проверяет):**
   ```sql
   SELECT * FROM users 
   WHERE currentStep = 'video1' 
   AND hasPaid = false 
   AND video1ReminderSent = false 
   AND video1ShownAt < NOW() - INTERVAL '10 minutes'
   ```

2. **Отправляется напоминание:**
   ```
   👋 Эй, ты ещё здесь?
   
   Не забудь нажать "Продолжить" чтобы увидеть 
   остальные секреты вирусных Reels! 🎥
   ```

3. **База данных:**
   ```sql
   UPDATE users SET video1ReminderSent = true WHERE userId = 123456789
   ```

---

## ⏰ WARMUP НА VIDEO1 (через 10 минут)

### Условие срабатывания:
Пользователь **НЕ нажал** "Продолжить" после видео 1 в течение 10 минут

### Что происходит:
1. **WarmupService (каждые 2 минуты проверяет):**
   ```sql
   SELECT * FROM users 
   WHERE currentStep = 'video1' 
   AND hasPaid = false 
   AND warmupVideo1Sent = false 
   AND lastActivityAt < NOW() - INTERVAL '10 minutes'
   ```

2. **Отправляется warmup сообщение:**
   - **Текст + 2 фото + 3 кнопки оплаты** (как на старте)

3. **База данных:**
   ```sql
   UPDATE users SET warmupVideo1Sent = true WHERE userId = 123456789
   ```

---

## 🎬 ЭТАП 3: ВТОРОЕ ВИДЕО

### Действие пользователя:
Нажимает **"Продолжить ▶️"** после видео 1

### Что происходит:
1. **База данных:**
   ```sql
   UPDATE users SET 
     currentStep = 'video2',
     lastActivityAt = NOW()
   WHERE userId = 123456789
   ```
   
   ```sql
   INSERT INTO user_actions (userId, action, timestamp)
   VALUES (123456789, 'continue_button', NOW())
   ```

2. **Сообщение боту:**
   Отправляется **ВИДЕО 2**:
   ```
   🎥 Видео 2: Продвинутые техники монтажа
   
   Готов к следующему уровню? 🚀
   ```
   
   **Кнопка:** `Готов! ✅`

3. **Отслеживание:**
   - `currentStep = "video2"`
   - Reminder на video2 **НЕТ** (пользователь уже заинтересован)

---

## 🎬 ЭТАП 4: ТРЕТЬЕ ВИДЕО

### Действие пользователя:
Нажимает **"Готов! ✅"** после видео 2

### Что происходит:
1. **База данных:**
   ```sql
   UPDATE users SET 
     currentStep = 'video3',
     lastActivityAt = NOW()
   WHERE userId = 123456789
   ```
   
   ```sql
   INSERT INTO user_actions (userId, action, timestamp)
   VALUES (123456789, 'ready_button', NOW())
   ```

2. **Сообщение боту:**
   Отправляется **ВИДЕО 3**:
   ```
   🎥 Видео 3: Секретная формула вирусности
   
   Последний шаг перед доступом! 🔥
   ```
   
   **Кнопка:** `Хочу доступ к инструментам! 💎`

3. **Отслеживание:**
   - `currentStep = "video3"`

---

## 💳 ЭТАП 5: ВЫБОР ОПЛАТЫ

### Действие пользователя:
Нажимает **"Хочу доступ к инструментам! 💎"** после видео 3

### Что происходит:
1. **База данных:**
   ```sql
   UPDATE users SET 
     currentStep = 'payment_choice',
     paymentChoiceShownAt = NOW(),
     lastActivityAt = NOW()
   WHERE userId = 123456789
   ```
   
   ```sql
   INSERT INTO user_actions (userId, action, timestamp)
   VALUES (123456789, 'advantage_button', NOW())
   ```

2. **Сообщение боту:**
   ```
   💎 Отлично! Ты готов получить доступ!
   
   Стоимость: 4000₽ / 2100₴ / €44
   
   Выбери удобный способ оплаты:
   ```
   
   **3 кнопки:**
   ```
   💵 Оплатить в рублях (RUB) - Tribute
   💳 Оплатить в евро (EUR) - Tribute  
   💴 Оплатить в гривнах (UAH)
   ```

3. **Отслеживание:**
   - `currentStep = "payment_choice"`
   - `paymentChoiceShownAt = NOW()`

---

## ⏰ REMINDER НА PAYMENT_CHOICE (через 5 минут)

### Условие срабатывания:
Пользователь **НЕ выбрал** способ оплаты в течение 5 минут

### Что происходит:
1. **ReminderService проверяет:**
   ```sql
   SELECT * FROM users 
   WHERE currentStep = 'payment_choice' 
   AND hasPaid = false 
   AND paymentReminderSent = false 
   AND paymentChoiceShownAt < NOW() - INTERVAL '5 minutes'
   ```

2. **Отправляется напоминание:**
   ```
   💳 Не забудь выбрать способ оплаты!
   
   Ты всего в одном клике от доступа к инструментам,
   которые принесли мне 15 000$ 🚀
   
   [3 кнопки оплаты повторно]
   ```

3. **База данных:**
   ```sql
   UPDATE users SET paymentReminderSent = true WHERE userId = 123456789
   ```

---

## 💰 СЦЕНАРИЙ A: ОПЛАТА ЧЕРЕЗ TRIBUTE (RUB/EUR)

### Действие пользователя:
Нажимает **"💵 Оплатить в рублях (RUB)"** или **"💳 Оплатить в евро (EUR)"**

### Что происходит:

#### 1. Клик на RUB Tribute:
```sql
UPDATE users SET 
  currentStep = 'waiting_receipt',
  currency = 'RUB',
  waitingReceiptSince = NOW(),
  lastActivityAt = NOW()
WHERE userId = 123456789
```

```sql
INSERT INTO user_actions (userId, action, timestamp, metadata)
VALUES (123456789, 'tribute_rub_click', NOW(), '{"button": "RUB"}')
```

**Сообщение:**
```
💵 Отлично! Переходи по ссылке для оплаты:
https://t.me/tribute/app?startapp=sF8Z

После оплаты ты АВТОМАТИЧЕСКИ получишь доступ! ✅
Обычно это занимает 1-3 минуты.
```

#### 2. Пользователь оплачивает в Tribute

#### 3. Автоматическая проверка через Channel Sync:
**Каждые 6 часов** бот проверяет участников канала:
```typescript
ChannelSyncService.syncChannelMembers()
```

**Если пользователь в канале:**
```sql
UPDATE users SET 
  hasPaid = true,
  paidAt = NOW()
WHERE userId = 123456789
```

#### 4. Отправка доступа:
```
🎉 ПОЗДРАВЛЯЮ!

Твоя оплата подтверждена! ✅

Вот твой доступ к закрытому чату с инструментами:
https://t.me/+-UvhjXF6bE00MmYy

Добро пожаловать в команду! 🚀
```

```sql
UPDATE users SET currentStep = 'completed' WHERE userId = 123456789
```

---

## 💰 СЦЕНАРИЙ B: ОПЛАТА ЧЕРЕЗ UAH

### Действие пользователя:
Нажимает **"💴 Оплатить в гривнах (UAH)"**

### Что происходит:

#### 1. Клик на UAH:
```sql
UPDATE users SET 
  currentStep = 'waiting_receipt',
  currency = 'UAH',
  waitingReceiptSince = NOW(),
  lastActivityAt = NOW()
WHERE userId = 123456789
```

**Сообщение:**
```
💴 Оплата в гривнах (UAH)

Сумма: 2100 ₴
Карта: 5169 1551 2428 3993

После оплаты пришли скриншот квитанции! 📸
```

#### 2. Пользователь отправляет фото квитанции

#### 3. Gemini AI проверка:
```typescript
const result = await geminiAI.validateReceipt(photo)
```

**Если квитанция валидна:**
```sql
UPDATE users SET 
  hasPaid = true,
  paidAt = NOW(),
  currentStep = 'completed'
WHERE userId = 123456789
```

```sql
INSERT INTO user_actions (userId, action, timestamp, metadata)
VALUES (123456789, 'receipt_approved', NOW(), '{"amount": "2100 UAH"}')
```

**Сообщение:**
```
✅ Квитанция подтверждена!

Вот твой доступ к закрытому чату:
https://t.me/+-UvhjXF6bE00MmYy

Добро пожаловать! 🎉
```

**Если квитанция НЕ валидна:**
```sql
UPDATE users SET currentStep = 'receipt_rejected' WHERE userId = 123456789
```

```sql
INSERT INTO user_actions (userId, action, timestamp, metadata)
VALUES (123456789, 'receipt_rejected', NOW(), '{"reason": "Invalid format"}')
```

**Сообщение:**
```
❌ К сожалению, это не похоже на квитанцию об оплате.

Пожалуйста, пришли скриншот подтверждения платежа
на сумму 2100 ₴ на карту 5169 1551 2428 3993
```

---

## 📊 ОТСЛЕЖИВАНИЕ И СТАТИСТИКА

### 1. Таблица `users` (основная информация):
```
userId: 123456789
username: "john_doe"
firstName: "John"
currentStep: "completed"
currency: "RUB"
hasPaid: true
paidAt: 2025-11-06 14:30:00
lastActivityAt: 2025-11-06 14:30:00
paymentChoiceShownAt: 2025-11-06 14:25:00
video1ShownAt: 2025-11-06 14:10:00
waitingReceiptSince: 2025-11-06 14:26:00

# Флаги напоминаний:
paymentReminderSent: false
receiptReminderSent: false (ОТКЛЮЧЕНО для RUB/EUR)
video1ReminderSent: false
warmupStartSent: false
warmupVideo1Sent: false

createdAt: 2025-11-06 14:00:00
updatedAt: 2025-11-06 14:30:00
```

### 2. Таблица `user_actions` (история действий):
```
id | userId      | action               | timestamp           | metadata
---|-------------|----------------------|---------------------|------------------
1  | 123456789   | start                | 2025-11-06 14:00:00 | null
2  | 123456789   | want_button          | 2025-11-06 14:10:00 | null
3  | 123456789   | continue_button      | 2025-11-06 14:15:00 | null
4  | 123456789   | ready_button         | 2025-11-06 14:20:00 | null
5  | 123456789   | advantage_button     | 2025-11-06 14:25:00 | null
6  | 123456789   | tribute_rub_click    | 2025-11-06 14:26:00 | {"button": "RUB"}
7  | 123456789   | payment_confirmed    | 2025-11-06 14:30:00 | {"via": "channel_sync"}
```

### 3. VIEW `current_steps` (агрегация):
```sql
SELECT 
  SUM(CASE WHEN currentStep = 'start' AND hasPaid = false THEN 1 ELSE 0 END) as stuck_at_start,
  SUM(CASE WHEN currentStep = 'video1' AND hasPaid = false THEN 1 ELSE 0 END) as stuck_at_video1,
  SUM(CASE WHEN currentStep = 'payment_choice' AND hasPaid = false THEN 1 ELSE 0 END) as stuck_at_payment_choice,
  SUM(CASE WHEN currentStep = 'waiting_receipt' AND hasPaid = false THEN 1 ELSE 0 END) as chose_payment_no_receipt
FROM users;
```

### 4. VIEW `payment_stats` (статистика платежей):
```sql
SELECT 
  COUNT(*) as total_users_started,
  SUM(CASE WHEN hasPaid = true THEN 1 ELSE 0 END) as total_successful_payments,
  SUM(CASE WHEN hasPaid = true AND currency = 'RUB' THEN 1 ELSE 0 END) as total_rub_payments,
  SUM(CASE WHEN hasPaid = true AND currency = 'UAH' THEN 1 ELSE 0 END) as total_uah_payments
FROM users;
```

---

## 🔄 ФОНОВЫЕ ПРОЦЕССЫ

### 1. ReminderService (каждые 2 минуты):
```
✅ Проверка застрявших на video1 (10 минут)
✅ Проверка застрявших на payment_choice (5 минут)
❌ Проверка waiting_receipt (ОТКЛЮЧЕНО для RUB/EUR)
```

### 2. WarmupService (каждые 2 минуты):
```
🔥 Проверка застрявших на start (5 минут)
🔥 Проверка застрявших на video1 (10 минут)
```

### 3. ChannelSyncService (каждые 6 часов):
```
🔄 Проверка участников канала
✅ Автоматическая маркировка оплативших через Tribute
📝 Добавление в Friends (не в боте, но в канале)
```

---

## 📈 КОМАНДА /stats (админ)

### Пример вывода:
```
📊 СТАТИСТИКА ПЛАТЕЖЕЙ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👥 Всего уникальных пользователей: 283
✅ Успешных оплат: 61 (21.6%)
💵 Оплат в рублях: 43
💴 Оплат в гривнах: 18
📷 Отправлено "не квитанций": 12
❌ Квитанций не прошедших проверку: 8

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 UPDATES (с момента последней проверки)
⏱ Прошло времени: 5м

👥 Новых пользователей: +3
✅ Новых оплат: +2
💳 Кликов на Tribute: +5
🔥 Warmup Start отправлено: +8
🔥 Warmup Video1 отправлено: +15

📊 Изменения в воронке:
  • Старт: -5
  • Видео1: -10
  • Выбор оплаты: +3
  • Ждут квитанции: +2

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💳 КЛИКИ НА TRIBUTE КНОПКИ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👥 Уникальных пользователей: 12

💵 RUB Tribute: 8 (4 только RUB)
💳 EUR Tribute: 8 (4 только EUR)
🔄 Кликали на обе: 4

Финальный выбор:
  💵 RUB: 6
  💳 EUR: 6

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 ВОРОНКА КОНВЕРСИИ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👥 Начали: 283
🚫 Застряли на старте: 28 (🔥 28)
📹 Застряли на видео 1: 114 (📨 45) (🔥 114)
📹 Застряли на видео 2: 23
📹 Застряли на видео 3: 18
💳 Застряли на выборе оплаты: 17 (📨 12)
⏳ Выбрали оплату, нет квитанции: 72
❌ Квитанция не подошла: 3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Легенда:**
- 📨 = обычное напоминание отправлено
- 🔥 = warmup сообщение отправлено

---

## 🎯 ИТОГОВАЯ СХЕМА ВОРОНКИ

```
START (283 юзера)
  ↓
🔥 Warmup Start (5 мин) → ❌ Не реагируют: 28
  ↓
VIDEO 1 (255 юзеров)
  ↓
📨 Reminder (10 мин) → ❌ Не реагируют: 45
🔥 Warmup Video1 (10 мин) → ❌ Не реагируют: 114
  ↓
VIDEO 2 (141 юзер)
  ↓
VIDEO 3 (118 юзеров)
  ↓
PAYMENT CHOICE (100 юзеров)
  ↓
📨 Reminder (5 мин) → ❌ Не реагируют: 12
  ↓
WAITING RECEIPT (88 юзеров)
  ↓
🔄 Channel Sync (RUB/EUR) → ✅ 43 оплатили
🤖 Gemini AI (UAH) → ✅ 18 оплатили
  ↓
COMPLETED ✅ (61 юзер = 21.6% конверсия)
```

---

## 🔑 КЛЮЧЕВЫЕ ОСОБЕННОСТИ

### ✅ Что работает автоматически:
1. **Warmup рассылки** (start 5м, video1 10м)
2. **Reminder напоминания** (video1 10м, payment_choice 5м)
3. **Channel Sync** (проверка Tribute оплат каждые 6ч)
4. **Gemini AI** (валидация UAH квитанций)
5. **Отслеживание всех действий** в user_actions

### ❌ Что требует ручного действия:
1. **Разовая warmup рассылка** (`/warmup_broadcast`)
2. **Синхронизация канала** (`/sync_channel`)
3. **Просмотр статистики** (`/stats`)

### 📊 Что отслеживается:
- Каждое действие пользователя
- Время на каждом этапе
- Отправленные напоминания
- Клики на кнопки Tribute
- Результаты валидации квитанций
- Конверсия на каждом шаге

---

## 💡 ОПТИМИЗАЦИЯ КОНВЕРСИИ

### Текущие узкие места:
1. **Start → Video1:** 28 застряло (9.9%)
2. **Video1 → Video2:** 114 застряло (40.3%) ⚠️ КРИТИЧНО!
3. **Payment Choice → Receipt:** 12 застряло (12%)

### Что помогает:
- 🔥 **Warmup** увеличивает engagement на 10-15%
- 📨 **Reminders** возвращают 5-8% пользователей
- 🔄 **Channel Sync** автоматизирует подтверждение оплат

---

**Обновлено:** 6 ноября 2025  
**Версия:** 2.0 (с Warmup и Delta Tracking)
