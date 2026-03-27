# 📊 Отслеживание кликов на кнопки оплаты Tribute

## Обновление от 5 ноября 2025

### ✅ Что изменилось

Теперь **ВСЕ клики на кнопки оплаты отслеживаются** в базе данных!

## 🎯 Новый флоу с отслеживанием

### Шаг 1: Пользователь видит кнопки
```
💵 Оплатить рублями (4000 ₽)
💳 Иностранные карты (44€)
💴 Оплатить гривнами (2100 ₴)
```

### Шаг 2: Клик на кнопку RUB

**Что происходит:**
1. ✅ Бот получает callback `pay_rub_tribute`
2. ✅ Записывает в БД: `actionType = 'choose_rub_tribute'`
3. ✅ Отправляет сообщение:

```
💵 Отлично! Нажмите на кнопку ниже и у вас откроется окно оплаты, где вы получите доступ в канал с платными материалами и наш чат автоматически.

Подойдет карта любого российского банка, даже кредитная. Если что-то не получается нажмите "Написать ассистенту" и вам ответят в течение часа.

[💳 Оплатить 4000 ₽] [📨 Написать ассистенту]
```

4. Пользователь нажимает "Оплатить 4000 ₽" → открывается Tribute → оплачивает → получает доступ

### Шаг 3: Клик на кнопку EUR

**Что происходит:**
1. ✅ Бот получает callback `pay_eur_tribute`
2. ✅ Записывает в БД: `actionType = 'choose_eur_tribute'`
3. ✅ Отправляет сообщение:

```
💳 Отлично! Нажмите на кнопку ниже и у вас откроется окно оплаты, где вы получите доступ в канал с платными материалами и наш чат автоматически.

Подойдет любая иностранная карта любой страны. Если что-то не получается нажмите "Написать ассистенту" и вам ответят в течение часа.

[💳 Оплатить 44€] [📨 Написать ассистенту]
```

4. Пользователь нажимает "Оплатить 44€" → открывается Tribute → оплачивает → получает доступ

### Шаг 4: Клик на кнопку UAH

**Что происходит:**
1. ✅ Бот получает callback `pay_uah`
2. ✅ Записывает в БД: `actionType = 'choose_uah'`
3. ✅ Отправляет реквизиты карты для UAH
4. Пользователь отправляет скриншот → валидация → invite-ссылки

---

## 📊 SQL запросы для аналитики

### 1. Сколько раз нажали на каждую кнопку

```sql
SELECT 
  actionType,
  COUNT(*) as clicks
FROM user_actions
WHERE actionType IN ('choose_rub_tribute', 'choose_eur_tribute', 'choose_uah')
GROUP BY actionType
ORDER BY clicks DESC;
```

**Пример результата:**
```
actionType           | clicks
---------------------|-------
choose_rub_tribute   | 150
choose_eur_tribute   | 45
choose_uah           | 30
```

### 2. Клики по дням

```sql
SELECT 
  DATE(createdAt) as date,
  actionType,
  COUNT(*) as clicks
FROM user_actions
WHERE actionType IN ('choose_rub_tribute', 'choose_eur_tribute', 'choose_uah')
GROUP BY DATE(createdAt), actionType
ORDER BY date DESC, clicks DESC;
```

### 3. Топ пользователей по кликам

```sql
SELECT 
  u.userId,
  u.username,
  COUNT(*) as total_clicks,
  COUNT(CASE WHEN ua.actionType = 'choose_rub_tribute' THEN 1 END) as rub_clicks,
  COUNT(CASE WHEN ua.actionType = 'choose_eur_tribute' THEN 1 END) as eur_clicks,
  COUNT(CASE WHEN ua.actionType = 'choose_uah' THEN 1 END) as uah_clicks
FROM users u
LEFT JOIN user_actions ua ON u.userId = ua.userId
WHERE ua.actionType IN ('choose_rub_tribute', 'choose_eur_tribute', 'choose_uah')
GROUP BY u.userId, u.username
ORDER BY total_clicks DESC
LIMIT 20;
```

### 4. Конверсия в клики (от показа до выбора)

```sql
SELECT 
  COUNT(DISTINCT CASE WHEN currentStep = 'payment_choice' THEN userId END) as shown_buttons,
  COUNT(DISTINCT CASE WHEN actionType IN ('choose_rub_tribute', 'choose_eur_tribute', 'choose_uah') THEN ua.userId END) as clicked,
  ROUND(
    COUNT(DISTINCT CASE WHEN actionType IN ('choose_rub_tribute', 'choose_eur_tribute', 'choose_uah') THEN ua.userId END)::numeric / 
    COUNT(DISTINCT CASE WHEN currentStep = 'payment_choice' THEN userId END)::numeric * 100, 
    2
  ) as click_rate_percent
FROM users u
LEFT JOIN user_actions ua ON u.userId = ua.userId;
```

### 5. Последние 50 кликов

```sql
SELECT 
  ua.createdAt,
  u.userId,
  u.username,
  ua.actionType,
  CASE 
    WHEN ua.actionType = 'choose_rub_tribute' THEN 'RUB (4000₽)'
    WHEN ua.actionType = 'choose_eur_tribute' THEN 'EUR (44€)'
    WHEN ua.actionType = 'choose_uah' THEN 'UAH (2100₴)'
  END as payment_method
FROM user_actions ua
JOIN users u ON ua.userId = u.userId
WHERE ua.actionType IN ('choose_rub_tribute', 'choose_eur_tribute', 'choose_uah')
ORDER BY ua.createdAt DESC
LIMIT 50;
```

---

## 🔧 Технические детали

### Обработчики

**Файл:** `src/index.ts`  
**Строки:** ~493-540

```typescript
// RUB Tribute
bot.action('pay_rub_tribute', async (ctx) => {
  await trackUserAction(userService, ctx, 'choose_rub_tribute', 'payment_choice');
  // ... отправка сообщения с URL-кнопкой
});

// EUR Tribute
bot.action('pay_eur_tribute', async (ctx) => {
  await trackUserAction(userService, ctx, 'choose_eur_tribute', 'payment_choice');
  // ... отправка сообщения с URL-кнопкой
});

// UAH (без изменений)
bot.action('pay_uah', async (ctx) => {
  await trackUserAction(userService, ctx, 'choose_uah', 'waiting_receipt');
  // ... отправка реквизитов
});
```

### Кнопки

Все 3 места обновлены:
1. ✅ `showPaymentButton()` - после просмотра всех видео
2. ✅ `get_advantage` - после клика "Забрать преимущество!"
3. ✅ `video1_skip_to_payment` - после клика "Хочу!" из напоминания

**Было (URL-кнопки, не отслеживались):**
```typescript
[{ text: '💵 Оплатить рублями (4000 ₽)', url: 'https://...' }]
[{ text: '💳 Иностранные карты (44€)', url: 'https://...' }]
```

**Стало (callback-кнопки, отслеживаются):**
```typescript
[{ text: '💵 Оплатить рублями (4000 ₽)', callback_data: 'pay_rub_tribute' }]
[{ text: '💳 Иностранные карты (44€)', callback_data: 'pay_eur_tribute' }]
```

---

## 📈 Преимущества нового подхода

### ✅ Полная аналитика

| Метрика | Было | Стало |
|---------|------|-------|
| **Клики RUB** | ❌ Не отслеживались | ✅ Отслеживаются |
| **Клики EUR** | ❌ Не отслеживались | ✅ Отслеживаются |
| **Клики UAH** | ✅ Отслеживались | ✅ Отслеживаются |
| **Конверсия** | ❌ Неизвестна для RUB/EUR | ✅ Известна для всех |
| **Динамика** | ❌ Нет данных | ✅ Можно строить графики |

### ✅ UX не пострадал

- **Было:** Клик → сразу Tribute (1 клик)
- **Стало:** Клик → сообщение → клик на Tribute (2 клика)

**НО:** Второе сообщение содержит важную информацию и кнопку "Написать ассистенту", что снижает отток из-за проблем с оплатой!

### ✅ Лучшая поддержка

В каждом сообщении есть кнопка **"Написать ассистенту"** → меньше брошенных оплат!

---

## 🎯 Что теперь можно отслеживать

### 1. Популярность способов оплаты
```sql
-- RUB vs EUR vs UAH
SELECT actionType, COUNT(*) FROM user_actions 
WHERE actionType LIKE 'choose_%' 
GROUP BY actionType;
```

### 2. A/B тестирование текстов кнопок
Можно менять тексты и сравнивать CTR

### 3. Время дня для оплат
```sql
SELECT EXTRACT(HOUR FROM createdAt) as hour, COUNT(*) 
FROM user_actions 
WHERE actionType IN ('choose_rub_tribute', 'choose_eur_tribute', 'choose_uah')
GROUP BY hour ORDER BY hour;
```

### 4. Путь пользователя до оплаты
```sql
-- Откуда пришли к оплате: прошли все видео или скипнули?
SELECT 
  u.userId,
  STRING_AGG(ua.actionType, ' → ' ORDER BY ua.createdAt) as user_journey
FROM users u
JOIN user_actions ua ON u.userId = ua.userId
WHERE u.userId IN (
  SELECT userId FROM user_actions 
  WHERE actionType IN ('choose_rub_tribute', 'choose_eur_tribute', 'choose_uah')
)
GROUP BY u.userId;
```

---

## ⚠️ Важно понимать

### ❌ Чего мы ВСЁ ещё не можем отследить:

1. **Реальные оплаты RUB через Tribute** - Tribute не отправляет webhook
2. **Реальные оплаты EUR через Tribute** - Tribute не отправляет webhook
3. **Конверсия клик → оплата для RUB/EUR** - только для UAH

### ✅ Что можем:

1. **Клики на все кнопки** - ДА ✅
2. **Популярность каждого способа** - ДА ✅
3. **Динамика кликов по дням** - ДА ✅
4. **Конверсия показ → клик** - ДА ✅
5. **Реальные оплаты UAH** - ДА ✅ (через скриншоты)
6. **Конверсия UAH клик → оплата** - ДА ✅

### 🔄 Для полной картины:

Сверяйте клики с количеством новых участников в канале/чате (вручную или через Telegram API)

---

## 🚀 Деплой

**Дата:** 5 ноября 2025  
**Файлы изменены:** `src/index.ts`  
**Новых обработчиков:** 2 (pay_rub_tribute, pay_eur_tribute)  
**Breaking changes:** НЕТ

---

✅ **Готово! Теперь можно отслеживать ВСЕ клики на кнопки оплаты!** 🎉
