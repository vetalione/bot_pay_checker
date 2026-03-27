# 📊 Отслеживаемые метрики и действия пользователей

## 📋 База данных: `telegram_bot`

---

## 1️⃣ Таблица `users` - Профиль пользователя

### Отслеживаемые поля:

| Поле | Тип | Описание |
|------|-----|----------|
| **userId** | bigint | Telegram ID пользователя (Primary Key) |
| **username** | varchar | @username из Telegram |
| **firstName** | varchar | Имя пользователя |
| **lastName** | varchar | Фамилия пользователя |
| **currentStep** | varchar | Текущий шаг в воронке |
| **currency** | varchar | Выбранная валюта (RUB/UAH) |
| **hasPaid** | boolean | Статус оплаты (true/false) |
| **paidAt** | timestamp | Дата и время оплаты |
| **lastActivityAt** | timestamp | Последняя активность пользователя |
| **createdAt** | timestamp | Дата регистрации (первый /start) |
| **updatedAt** | timestamp | Дата последнего обновления |

### Возможные значения `currentStep`:
- `start` - Начальный этап (/start)
- `video1` - Посмотрел приветствие, ждет video1
- `video2` - Посмотрел video1, ждет video2
- `video3` - Посмотрел video2, ждет video3
- `payment_choice` - Выбирает валюту для оплаты
- `waiting_receipt` - Ожидает загрузки чека
- `completed` - Успешно оплатил

### Возможные значения `currency`:
- `RUB` - Российский рубль (4000₽)
- `UAH` - Украинская гривна (2100₴)

---

## 2️⃣ Таблица `user_actions` - История действий

### Отслеживаемые поля:

| Поле | Тип | Описание |
|------|-----|----------|
| **id** | integer | Уникальный ID действия (Auto-increment) |
| **userId** | bigint | ID пользователя (Foreign Key → users) |
| **action** | varchar | Название действия |
| **step** | varchar | Шаг воронки на момент действия |
| **metadata** | jsonb | Дополнительные данные (JSON) |
| **timestamp** | timestamp | Время совершения действия |

### Отслеживаемые действия (`action`):

| Action | Описание | Когда происходит |
|--------|----------|------------------|
| **start** | Запуск бота | Пользователь отправил /start |
| **click_want_more** | Клик "Хочу!" | Нажал кнопку "🔥 Хочу!" после приветствия |
| **choose_rub** | Выбрал RUB | Нажал кнопку "💵 Оплатить в RUB" |
| **choose_uah** | Выбрал UAH | Нажал кнопку "💴 Оплатить в UAH" |
| **payment_success** | Успешная оплата | Чек прошел валидацию, получил инвайт ссылки |

### Metadata (дополнительные данные):
В поле `metadata` сохраняется JSON с контекстом:
```json
{
  "username": "vetalsmirnov",
  "firstName": "Vitaliy",
  "lastName": "Smirnov"
}
```

---

## 3️⃣ Аналитические метрики

### 📈 Воронка (Funnel):
```sql
SELECT currentStep, COUNT(*) as users
FROM users
GROUP BY currentStep
ORDER BY users DESC;
```

**Результат:**
- `start` - Сколько начали
- `video1` - Сколько дошли до video1
- `waiting_receipt` - Сколько дошли до оплаты
- `completed` - Сколько завершили

### 💰 Конверсия:
```sql
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN "hasPaid" = true THEN 1 ELSE 0 END) as paid,
  ROUND(100.0 * SUM(CASE WHEN "hasPaid" = true THEN 1 ELSE 0 END) / COUNT(*), 2) as conversion_rate
FROM users;
```

**Метрики:**
- Total users - Всего пользователей
- Paid users - Оплативших
- Conversion rate (%) - Процент конверсии

### 📊 По валютам:
```sql
SELECT currency, COUNT(*) as users
FROM users
WHERE currency IS NOT NULL
GROUP BY currency;
```

**Результат:**
- RUB - Сколько выбрали рубли
- UAH - Сколько выбрали гривны

### ⏱ Время в воронке:
```sql
SELECT 
  "userId",
  MIN(timestamp) as first_action,
  MAX(timestamp) as last_action,
  MAX(timestamp) - MIN(timestamp) as time_in_funnel
FROM user_actions
GROUP BY "userId";
```

**Метрики:**
- Среднее время от /start до payment
- Самые быстрые конверсии
- Застрявшие пользователи

---

## 4️⃣ Retargeting сегменты

### 🎯 Застрявшие на video1 (24ч+):
```sql
SELECT * FROM users
WHERE "currentStep" = 'video1'
  AND "hasPaid" = false
  AND "lastActivityAt" < NOW() - INTERVAL '24 hours';
```

### 🎯 Незавершенная оплата (24ч+):
```sql
SELECT * FROM users
WHERE "currentStep" IN ('payment_choice', 'waiting_receipt')
  AND "hasPaid" = false
  AND "lastActivityAt" < NOW() - INTERVAL '24 hours';
```

### 🎯 Оплатившие (для допродаж):
```sql
SELECT * FROM users
WHERE "hasPaid" = true;
```

### 🎯 Новые (за последние 24ч):
```sql
SELECT * FROM users
WHERE "createdAt" > NOW() - INTERVAL '24 hours';
```

---

## 5️⃣ Текущий статус tracking

### ✅ Что отслеживается СЕЙЧАС:

#### Действия пользователя:
1. ✅ **Запуск бота** (`/start`)
2. ✅ **Клик "Хочу!"** (переход к воронке)
3. ✅ **Выбор валюты** (RUB/UAH)
4. ✅ **Успешная оплата** (после валидации чека)

#### Профиль пользователя:
1. ✅ Telegram ID, username, имя, фамилия
2. ✅ Текущий шаг в воронке
3. ✅ Выбранная валюта
4. ✅ Статус оплаты (да/нет)
5. ✅ Время оплаты
6. ✅ Последняя активность
7. ✅ Дата регистрации

---

## 6️⃣ Что МОЖНО отслеживать дополнительно

### 🔮 Потенциальные улучшения:

#### Дополнительные действия:
- ❌ Просмотр video1, video2, video3
- ❌ Клики на кнопки "Смотреть дальше", "Готов!"
- ❌ Загрузка чека (даже если не прошел валидацию)
- ❌ Отказ от валидации чека
- ❌ Переход по инвайт ссылкам

#### Дополнительные метрики:
- ❌ Источник трафика (откуда пришел)
- ❌ Устройство (iOS/Android/Desktop)
- ❌ Язык интерфейса
- ❌ Геолокация (по IP или Telegram)
- ❌ Количество попыток загрузки чека

#### Behavioral метрики:
- ❌ Время просмотра каждого видео
- ❌ Скорость прохождения воронки
- ❌ Drop-off точки (где отваливаются)
- ❌ Re-engagement (возвраты после паузы)

---

## 7️⃣ Примеры использования данных

### 📈 Анализ воронки:
```bash
npm run retargeting stats
# Показывает распределение по шагам
```

### 💰 Конверсия:
```bash
npm run retargeting conversion
# Показывает % оплативших
```

### 🎯 Retargeting кампании:
```bash
# Напомнить застрявшим на video1
npm run retargeting stuck_video1

# Напомнить о незавершенной оплате
npm run retargeting abandoned_payment
```

### 🔍 SQL запросы:
```sql
-- Средняя конверсия по валютам
SELECT 
  currency,
  COUNT(*) as total,
  SUM(CASE WHEN "hasPaid" = true THEN 1 ELSE 0 END) as paid,
  ROUND(100.0 * SUM(CASE WHEN "hasPaid" = true THEN 1 ELSE 0 END) / COUNT(*), 2) as rate
FROM users
WHERE currency IS NOT NULL
GROUP BY currency;

-- Пользователи с наибольшим количеством действий
SELECT 
  u."userId",
  u.username,
  COUNT(a.id) as actions_count
FROM users u
LEFT JOIN user_actions a ON u."userId" = a."userId"
GROUP BY u."userId", u.username
ORDER BY actions_count DESC
LIMIT 10;

-- Средняя скорость прохождения воронки
SELECT 
  AVG(EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp)))) / 60 as avg_minutes
FROM user_actions
GROUP BY "userId"
HAVING COUNT(*) >= 2;
```

---

## 📊 Summary

### Текущее покрытие tracking:

**Users table:**
- ✅ 11 полей
- ✅ 4 шага воронки
- ✅ 2 валюты

**User_actions table:**
- ✅ 5 типов действий
- ✅ История с timestamps
- ✅ Metadata в JSON

**Analytics:**
- ✅ Воронка по шагам
- ✅ Конверсия в оплату
- ✅ Retargeting сегменты
- ✅ Время в воронке

**Retargeting готов:**
- ✅ Застрявшие пользователи
- ✅ Незавершенная оплата
- ✅ Сегментация по валюте
- ✅ Временные фильтры

---

**Дата:** 2 ноября 2025  
**Статус:** PRODUCTION READY ✅
