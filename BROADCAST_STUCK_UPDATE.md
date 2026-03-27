# 🔄 Обновление скрипта broadcast-stuck

## Дата: 5 ноября 2025

### ✅ Что изменилось

Скрипт `scripts/send_stuck_users_message.ts` обновлен для использования новых кнопок оплаты с отслеживанием кликов.

---

## 📋 Было (старые кнопки):

```typescript
Markup.inlineKeyboard([
  [
    Markup.button.callback('💵 Рубли (RUB)', 'pay_rub'),      // ❌ Не работает!
    Markup.button.callback('💴 Гривны (UAH)', 'pay_uah')
  ]
])
```

**Проблема:**
- ❌ Кнопка `pay_rub` ведет на закомментированный обработчик
- ❌ Нет кнопки для EUR (иностранных карт)
- ❌ Только 2 способа оплаты вместо 3

---

## 📋 Стало (новые кнопки):

```typescript
Markup.inlineKeyboard([
  [Markup.button.callback('💵 Оплатить рублями (4000 ₽)', 'pay_rub_tribute')],
  [Markup.button.callback('💳 Иностранные карты (44€)', 'pay_eur_tribute')],
  [Markup.button.callback('💴 Оплатить гривнами (2100 ₴)', 'pay_uah')]
])
```

**Преимущества:**
- ✅ Все 3 способа оплаты
- ✅ Кнопки работают и ведут на актуальные обработчики
- ✅ Клики отслеживаются в БД
- ✅ Пользователи получают понятные инструкции с кнопкой "Написать ассистенту"

---

## 🎯 Что происходит после клика

### Клик на "Оплатить рублями":

1. ✅ Записывается в БД: `actionType = 'choose_rub_tribute'`
2. Отправляется сообщение:
```
💵 Отлично! Нажмите на кнопку ниже и у вас откроется окно оплаты, 
где вы получите доступ в канал с платными материалами и наш чат автоматически.

Подойдет карта любого российского банка, даже кредитная. 
Если что-то не получается нажмите "Написать ассистенту" и вам ответят в течение часа.

[💳 Оплатить 4000 ₽]  [📨 Написать ассистенту]
```

### Клик на "Иностранные карты":

1. ✅ Записывается в БД: `actionType = 'choose_eur_tribute'`
2. Отправляется сообщение:
```
💳 Отлично! Нажмите на кнопку ниже и у вас откроется окно оплаты, 
где вы получите доступ в канал с платными материалами и наш чат автоматически.

Подойдет любая иностранная карта любой страны. 
Если что-то не получается нажмите "Написать ассистенту" и вам ответят в течение часа.

[💳 Оплатить 44€]  [📨 Написать ассистенту]
```

### Клик на "Оплатить гривнами":

1. ✅ Записывается в БД: `actionType = 'choose_uah'`
2. Отправляются реквизиты карты для UAH
3. Пользователь отправляет скриншот → валидация → invite-ссылки

---

## 📊 Отслеживание результатов рассылки

После запуска `npm run broadcast-stuck` можно проверить эффективность:

```sql
-- Сколько человек получили рассылку и нажали на кнопки
SELECT 
  actionType,
  COUNT(*) as clicks,
  COUNT(DISTINCT userId) as unique_users
FROM user_actions
WHERE actionType IN ('choose_rub_tribute', 'choose_eur_tribute', 'choose_uah')
  AND createdAt > '2025-11-05'  -- дата рассылки
GROUP BY actionType;
```

**Пример результата:**
```
actionType           | clicks | unique_users
---------------------|--------|-------------
choose_rub_tribute   | 45     | 43
choose_eur_tribute   | 12     | 12
choose_uah           | 8      | 8
```

**Конверсия рассылки:**
```sql
-- Процент откликнувшихся
SELECT 
  COUNT(DISTINCT CASE WHEN currentStep IN ('start', 'video1') AND hasPaid = false THEN userId END) as sent_to,
  COUNT(DISTINCT CASE WHEN actionType IN ('choose_rub_tribute', 'choose_eur_tribute', 'choose_uah') AND createdAt > '2025-11-05' THEN ua.userId END) as clicked,
  ROUND(
    COUNT(DISTINCT CASE WHEN actionType IN ('choose_rub_tribute', 'choose_eur_tribute', 'choose_uah') AND createdAt > '2025-11-05' THEN ua.userId END)::numeric /
    COUNT(DISTINCT CASE WHEN currentStep IN ('start', 'video1') AND hasPaid = false THEN userId END)::numeric * 100,
    2
  ) as conversion_percent
FROM users u
LEFT JOIN user_actions ua ON u.userId = ua.userId;
```

---

## 🚀 Как запустить обновленную рассылку

### Локально (тест):

```bash
npm run broadcast-stuck
```

### На Railway (продакшн):

1. Временно измените `package.json` → `scripts` → `start`:
```json
"start": "npm run broadcast-stuck && npm run build && node dist/index.js"
```

2. Задеплойте на Railway (git push)

3. После выполнения рассылки верните обратно:
```json
"start": "node dist/index.js"
```

4. Снова задеплойте

**⚠️ ВАЖНО:** Рассылка выполнится ОДИН РАЗ при деплое!

---

## 📈 Ожидаемые результаты

**Кому отправится:**
- Застрявшие на `start` (не начали смотреть видео)
- Застрявшие на `video1` (начали, но не дошли до оплаты)
- Не оплатившие (`hasPaid = false`)

**Что произойдет:**
- Получат сообщение с 3 способами оплаты
- Клики будут отслеживаться
- Смогут выбрать удобный способ оплаты
- Получат помощь через кнопку "Написать ассистенту"

**Конверсия:**
- Ожидаемая конверсия: 15-30% (от получивших рассылку до клика на кнопку)
- Из них 40-60% дойдут до оплаты

---

## ✅ Итоги обновления

| Параметр | Было | Стало |
|----------|------|-------|
| **Кнопок** | 2 | 3 |
| **Способов оплаты** | RUB (не работает), UAH | RUB (Tribute), EUR (Tribute), UAH |
| **Отслеживание** | Только UAH | Все 3 способа |
| **Поддержка** | Нет | Кнопка "Написать ассистенту" |
| **Статус** | ❌ Сломан | ✅ Работает |

---

**Обновлено:** 5 ноября 2025  
**Файлы изменены:** 
- `scripts/send_stuck_users_message.ts`
- `scripts/README_STUCK_USERS.md`

✅ **Готово к использованию!**
