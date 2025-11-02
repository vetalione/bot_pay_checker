-- 🔍 БЫСТРАЯ ПРОВЕРКА: Сколько на самом деле пользователей для напоминаний?

-- 1️⃣ Простой подсчет - VIEW показывает 22
SELECT * FROM current_steps;

-- 2️⃣ Разбивка по валютам
SELECT 
  currency,
  COUNT(*) as total,
  COUNT(CASE WHEN "waitingReceiptSince" IS NOT NULL THEN 1 END) as has_timestamp,
  COUNT(CASE WHEN "waitingReceiptSince" IS NULL THEN 1 END) as no_timestamp,
  COUNT(CASE WHEN "receiptReminderSent" = true THEN 1 END) as already_sent_reminder,
  COUNT(CASE WHEN "receiptReminderSent" = false THEN 1 END) as can_send_reminder
FROM users 
WHERE "currentStep" = 'waiting_receipt' AND "hasPaid" = false
GROUP BY currency;

-- 3️⃣ ТОЧНЫЙ запрос из reminderService для RUB
SELECT 
  "userId",
  username,
  currency,
  "waitingReceiptSince",
  "receiptReminderSent",
  EXTRACT(EPOCH FROM (NOW() - "waitingReceiptSince"))/60 as minutes_waiting,
  CASE 
    WHEN "waitingReceiptSince" IS NULL THEN '❌ НЕТ TIMESTAMP'
    WHEN "waitingReceiptSince" > NOW() - INTERVAL '5 minutes' THEN '⏰ МЕНЬШЕ 5 МИН'
    WHEN "receiptReminderSent" = true THEN '✅ УЖЕ ОТПРАВЛЕНО'
    ELSE '🔔 ГОТОВ К ОТПРАВКЕ'
  END as reminder_status
FROM users
WHERE "currentStep" = 'waiting_receipt'
  AND currency = 'RUB'
  AND "receiptReminderSent" = false
  AND "waitingReceiptSince" > '1970-01-01'::timestamp
ORDER BY "waitingReceiptSince" DESC;

-- 4️⃣ Сколько найдет система напоминаний ПРЯМО СЕЙЧАС?
SELECT 
  COUNT(*) as will_find_for_reminders
FROM users
WHERE "currentStep" = 'waiting_receipt'
  AND currency = 'RUB'
  AND "receiptReminderSent" = false
  AND "waitingReceiptSince" > '1970-01-01'::timestamp
  AND "waitingReceiptSince" <= NOW() - INTERVAL '5 minutes';

-- 5️⃣ UAH пользователи (должны иметь NULL в waitingReceiptSince ДО исправления)
SELECT 
  "userId",
  username,
  currency,
  "waitingReceiptSince",
  "createdAt",
  CASE 
    WHEN "waitingReceiptSince" IS NULL THEN '❌ БАГ: НЕТ TIMESTAMP'
    ELSE '✅ ОК: ЕСТЬ TIMESTAMP'
  END as status
FROM users 
WHERE "currentStep" = 'waiting_receipt' 
  AND "hasPaid" = false 
  AND currency = 'UAH'
ORDER BY "createdAt" DESC
LIMIT 10;
