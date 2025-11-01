# 🎯 Retargeting Campaigns - Руководство

## Что это такое?

Retargeting (ретаргетинг) - это повторный контакт с пользователями, которые начали, но не завершили воронку.

## Зачем это нужно?

❌ **Без retargeting:**
- Пользователь посмотрел video1 → забыл → потерян навсегда

✅ **С retargeting:**
- Пользователь посмотрел video1 → через 24ч напоминание → вернулся → купил

## Доступные кампании

### 1️⃣ Застрявшие на video1
```bash
npm run retargeting stuck_video1
```

**Кому отправляется:**
- Посмотрели video1
- НЕ нажали "Смотреть дальше"
- Прошло 24+ часов

**Результат:**
- Напоминание о пользе видео 2 и 3
- Кнопка "Смотреть дальше"

---

### 2️⃣ Застрявшие на video2
```bash
npm run retargeting stuck_video2
```

**Кому отправляется:**
- Посмотрели video2
- НЕ нажали "Готов!"
- Прошло 24+ часов

**Результат:**
- Мотивация досмотреть последнее видео
- Кнопка "Готов!"

---

### 3️⃣ Незавершённая оплата
```bash
npm run retargeting abandoned_payment
```

**Кому отправляется:**
- Дошли до выбора валюты ИЛИ загрузки чека
- НЕ завершили оплату
- Прошло 24+ часов

**Результат:**
- Напоминание об ограниченности мест
- Кнопка "Оплатить"

---

## Аналитика

### 📊 Статистика воронки
```bash
npm run retargeting stats
```

**Показывает:**
```
start                 1000 пользователей
video1                800 пользователей
video2                600 пользователей
payment_choice        400 пользователей
waiting_receipt       200 пользователей
completed             150 пользователей
```

---

### 💰 Конверсия в оплату
```bash
npm run retargeting conversion
```

**Показывает:**
```
Всего пользователей:  1000
Оплатили:             150
Конверсия:            15.00%
```

---

## Как часто запускать кампании?

### Рекомендуемая частота:

**stuck_video1**: Каждые 48 часов
- Понедельник 10:00
- Среда 10:00
- Пятница 10:00

**stuck_video2**: Каждые 48 часов
- Вторник 10:00
- Четверг 10:00
- Суббота 10:00

**abandoned_payment**: Каждый день в 18:00
- Самый критичный сегмент!
- Высокая вероятность конверсии

---

## Автоматизация через cron

### Railway (Production)

1. Создайте новый сервис: "Cron Jobs"
2. Добавьте в Procfile:
```
retargeting_video1: npm run retargeting stuck_video1
retargeting_video2: npm run retargeting stuck_video2
retargeting_payment: npm run retargeting abandoned_payment
```

3. Настройте расписание через Railway Cron:
```
0 10 * * 1,3,5 retargeting_video1    # Пн, Ср, Пт в 10:00
0 10 * * 2,4,6 retargeting_video2    # Вт, Чт, Сб в 10:00
0 18 * * * retargeting_payment       # Каждый день в 18:00
```

### macOS/Linux (Локально)

```bash
crontab -e
```

Добавьте:
```bash
# Застрявшие на video1 (Пн, Ср, Пт в 10:00)
0 10 * * 1,3,5 cd /path/to/bot && npm run retargeting stuck_video1

# Застрявшие на video2 (Вт, Чт, Сб в 10:00)
0 10 * * 2,4,6 cd /path/to/bot && npm run retargeting stuck_video2

# Незавершённая оплата (каждый день в 18:00)
0 18 * * * cd /path/to/bot && npm run retargeting abandoned_payment
```

---

## Примеры использования

### Ручной запуск перед выходными
```bash
# Пятница вечером - мощный пуш застрявших
npm run retargeting stuck_video1
npm run retargeting stuck_video2
npm run retargeting abandoned_payment
```

### Проверка эффективности
```bash
# Понедельник утром - смотрим результаты
npm run retargeting stats
npm run retargeting conversion
```

---

## Продвинутые стратегии

### Сегментация по времени

Вместо 24ч используйте разные интервалы:

```typescript
// В src/retargeting.ts измените:
const users = await userService.getUsersStuckAtStep('video1', 48); // 48ч вместо 24ч
```

**Рекомендация:**
- 24ч: Первое напоминание
- 72ч: Второе напоминание
- 168ч (неделя): Финальное напоминание

### A/B тестирование сообщений

Создайте 2 варианта текста и отправляйте разным группам:

```typescript
const message = userId % 2 === 0 
  ? "Вариант A: Мягкое напоминание"
  : "Вариант B: Срочность и FOMO";
```

---

## Метрики успеха

### Что отслеживать:

1. **Open Rate** - Сколько пользователей открыли напоминание
2. **Click Rate** - Сколько нажали на кнопку
3. **Conversion Rate** - Сколько дошли до оплаты
4. **ROI** - Прибыль vs затраты времени

### Хороший результат:

- Open Rate: >50%
- Click Rate: >20%
- Conversion Rate: >5%

---

## Важно! ⚠️

### Rate Limits Telegram:

- Не более 30 сообщений в секунду
- В скрипте уже есть delay 100ms между отправками
- Не запускайте кампании слишком часто

### Spam Prevention:

- Не отправляйте чаще 1 раза в 24ч одному пользователю
- Следите за unsubscribe rate
- Если пользователь заблокировал бота - удалите из списка

---

## Troubleshooting

### Ошибка: Cannot connect to database
```bash
# Проверьте DATABASE_URL в .env
echo $DATABASE_URL

# Локально убедитесь что PostgreSQL запущен
brew services list
```

### Ошибка: Bot token is invalid
```bash
# Проверьте BOT_TOKEN в .env
echo $BOT_TOKEN
```

### Не отправляются сообщения
```bash
# Проверьте что userService инициализирован
npm run retargeting stats  # Если работает - всё ОК
```

---

## Следующие шаги

После mastering retargeting добавьте:

1. **Email notifications** - Дублируйте важные напоминания на email
2. **SMS notifications** - Для критичных сегментов
3. **Push notifications** - Через Telegram Web App
4. **Персонализация** - Обращение по имени, упоминание прошлых действий

---

Готово! 🚀 Теперь у вас есть мощный инструмент для возврата пользователей в воронку.
