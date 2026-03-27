# 💳 Изменение флоу оплат - Telegram Tribute

## Что изменилось (5 ноября 2025)

### ✅ Новый флоу оплат

Теперь бот предлагает **3 способа оплаты** вместо 2:

| Кнопка | Ссылка | Что происходит |
|--------|--------|----------------|
| 💵 **Оплатить рублями (4000 ₽)** | `https://t.me/tribute/app?startapp=sF8Z` | Telegram Tribute → оплата → автоматический доступ к каналу+чату |
| 💳 **Иностранные карты (44€)** | `https://t.me/tribute/app?startapp=sFe6` | Telegram Tribute → оплата → автоматический доступ к каналу+чату |
| 💴 **Оплатить гривнами (2100 ₴)** | callback: `pay_uah` | Старый флоу → скриншот квитанции → валидация → invite-ссылки |

### 🔄 Что было изменено в коде

**Файл:** `src/index.ts`

#### 1. Заменены кнопки в 3 местах:

- ✅ После просмотра всех видео (функция `showPaymentButton`)
- ✅ При клике на "Забрать преимущество!" (обработчик `get_advantage`)
- ✅ При клике на "Хочу!" из напоминания video1 (обработчик `video1_skip_to_payment`)

**Было:**
```typescript
inline_keyboard: [
  [{ text: '💵 Оплатить рублями (4000 ₽)', callback_data: 'pay_rub' }],
  [{ text: '💴 Оплатить гривнами (2100 ₴)', callback_data: 'pay_uah' }]
]
```

**Стало:**
```typescript
inline_keyboard: [
  [{ text: '💵 Оплатить рублями (4000 ₽)', url: 'https://t.me/tribute/app?startapp=sF8Z' }],
  [{ text: '💳 Иностранные карты (44€)', url: 'https://t.me/tribute/app?startapp=sFe6' }],
  [{ text: '💴 Оплатить гривнами (2100 ₴)', callback_data: 'pay_uah' }]
]
```

#### 2. Закомментирован старый обработчик `pay_rub`

Обработчик `bot.action('pay_rub', ...)` больше не используется, так как кнопка "Оплатить рублями" теперь **URL-кнопка**, а не callback.

**Строки ~492-551** закомментированы:
```typescript
/*
bot.action('pay_rub', async (ctx) => {
  // ... весь старый код для приёма платежей рублями
});
*/
```

#### 3. Флоу UAH остался без изменений

- ✅ Кнопка "Оплатить гривнами" работает как прежде
- ✅ Обработчик `bot.action('pay_uah', ...)` не изменён
- ✅ Валидация квитанции через Gemini AI работает
- ✅ Генерация invite-ссылок работает

---

## 📊 Отслеживание кликов

### ✅ Что отслеживается

Бот записывает в базу данных (`user_actions`) когда пользователь нажал на кнопки:

```sql
-- Клики на UAH (старый флоу с callback)
SELECT COUNT(*) FROM user_actions WHERE actionType = 'choose_uah';

-- НО! Клики на RUB и EUR (Tribute) НЕ отслеживаются
-- Потому что это URL-кнопки, не callback
```

### ❌ Что НЕ отслеживается

1. **Клики на "Оплатить рублями"** - это URL-кнопка, Telegram не отправляет callback
2. **Клики на "Иностранные карты (44€)"** - это URL-кнопка, Telegram не отправляет callback
3. **Реальные оплаты через Tribute** - Telegram Tribute не отправляет webhook боту

### 🎯 Как отслеживать вручную

#### Метод 1: Проверка участников канала/чата

```bash
# Telegram API: получить список участников канала
# Сравнить с предыдущим снимком
```

#### Метод 2: Статистика Telegram Tribute

Если у вас есть доступ к панели Telegram Tribute:
- Смотрите статистику оплат RUB
- Смотрите статистику оплат EUR
- Сравните с количеством кликов в боте (для UAH)

#### Метод 3: SQL запросы для сравнения

```sql
-- Сколько нажали UAH (есть в логах)
SELECT COUNT(*) FROM user_actions WHERE actionType = 'choose_uah';

-- Сколько реально оплатили UAH (есть в логах)
SELECT COUNT(*) FROM users WHERE currency = 'UAH' AND hasPaid = true;

-- Конверсия UAH
SELECT 
  COUNT(CASE WHEN actionType = 'choose_uah' THEN 1 END) as clicks,
  COUNT(CASE WHEN currency = 'UAH' AND hasPaid = true THEN 1 END) as paid,
  ROUND(COUNT(CASE WHEN currency = 'UAH' AND hasPaid = true THEN 1 END)::numeric / 
        COUNT(CASE WHEN actionType = 'choose_uah' THEN 1 END) * 100, 2) as conversion_rate
FROM users LEFT JOIN user_actions ON users.userId = user_actions.userId;
```

---

## 🚀 Как работает Telegram Tribute

### Флоу пользователя (RUB):

1. Пользователь нажимает "💵 Оплатить рублями (4000 ₽)"
2. Открывается `https://t.me/tribute/app?startapp=sF8Z`
3. Telegram показывает форму оплаты Tribute
4. Пользователь оплачивает 4000 ₽
5. **Telegram автоматически** выдаёт доступ к каналу и чату
6. Пользователь получает доступ ✅

### Флоу пользователя (EUR):

1. Пользователь нажимает "💳 Иностранные карты (44€)"
2. Открывается `https://t.me/tribute/app?startapp=sFe6`
3. Telegram показывает форму оплаты Tribute
4. Пользователь оплачивает 44€
5. **Telegram автоматически** выдаёт доступ к каналу и чату
6. Пользователь получает доступ ✅

### Флоу пользователя (UAH) - старый:

1. Пользователь нажимает "💴 Оплатить гривнами (2100 ₴)"
2. Бот отправляет реквизиты карты
3. Пользователь делает перевод и отправляет скриншот
4. Бот валидирует квитанцию через Gemini AI
5. Бот генерирует invite-ссылки для канала и чата
6. Бот отправляет ссылки пользователю
7. Пользователь получает доступ ✅

---

## 🔧 Технические детали

### Tribute ссылки

```
RUB: https://t.me/tribute/app?startapp=sF8Z
EUR: https://t.me/tribute/app?startapp=sFe6
```

Параметр `startapp=XXX` - это уникальный идентификатор вашего Tribute предложения.

### Где обрабатывается UAH

**Файл:** `src/index.ts`  
**Строки:** ~553-650

**Обработчик:**
```typescript
bot.action('pay_uah', async (ctx) => {
  // Отправляет реквизиты карты
  // Переводит пользователя в состояние waiting_receipt
  // Ждёт скриншот квитанции
});
```

**Валидация:**
```typescript
bot.on(message('photo'), async (ctx) => {
  if (user.currentStep === 'waiting_receipt') {
    // Валидирует квитанцию через Gemini AI
    // Если валидация успешна → генерирует invite-ссылки
    // Отправляет ссылки пользователю
  }
});
```

---

## ⚠️ Важные моменты

### 1. URL-кнопки vs Callback-кнопки

| Тип | Как работает | Отслеживание |
|-----|--------------|--------------|
| **URL-кнопка** | Открывает ссылку, бот НЕ получает уведомление | ❌ НЕТ |
| **Callback-кнопка** | Отправляет callback боту | ✅ ДА |

### 2. Telegram Tribute не отправляет webhook

- Telegram Tribute сам управляет доступом к каналу/чату
- Бот НЕ получает уведомление о успешной оплате
- Нужно сверять вручную или через Telegram API

### 3. Конверсия UAH vs RUB/EUR

- Для UAH можно посчитать конверсию (клики → оплаты)
- Для RUB/EUR можно только посчитать общее количество оплат в Tribute
- Нельзя связать конкретного пользователя с оплатой (без дополнительных инструментов)

---

## 📈 Аналитика

### Доступная статистика:

```sql
-- Общее количество показов кнопок оплаты
SELECT COUNT(*) FROM users WHERE currentStep = 'payment_choice';

-- Количество выборов UAH
SELECT COUNT(*) FROM users WHERE currency = 'UAH';

-- Количество оплат UAH
SELECT COUNT(*) FROM users WHERE currency = 'UAH' AND hasPaid = true;

-- Конверсия UAH
SELECT 
  ROUND(
    COUNT(CASE WHEN hasPaid = true THEN 1 END)::numeric / 
    COUNT(*)::numeric * 100, 
    2
  ) as conversion_rate
FROM users 
WHERE currency = 'UAH';
```

### Недоступная статистика (без Tribute API):

- ❌ Сколько кликнули на RUB
- ❌ Сколько кликнули на EUR
- ❌ Сколько оплатили RUB
- ❌ Сколько оплатили EUR
- ❌ Конверсия RUB/EUR

---

## ✅ Итоги

| Параметр | Значение |
|----------|----------|
| **Дата изменения** | 5 ноября 2025 |
| **Изменённый файл** | `src/index.ts` |
| **Новых кнопок** | 1 (Иностранные карты 22€) |
| **Удалённых обработчиков** | 1 (pay_rub закомментирован) |
| **Изменённых обработчиков** | 0 (UAH остался без изменений) |
| **Новых зависимостей** | 0 |
| **Breaking changes** | НЕТ |

---

**Готово! 🎉**  
Новый флоу оплат через Telegram Tribute активирован.
