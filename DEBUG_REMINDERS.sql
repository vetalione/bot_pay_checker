-- 🔍 ПРОВЕРКА НАПОМИНАНИЙ: Почему находит 0 пользователей?

-- 1️⃣ Общая статистика waiting_receipt
SELECT 
  '1. Общая статистика' as check_type,
  COUNT(*) as total_waiting,
  COUNT(CASE WHEN currency = 'RUB' THEN 1 END) as rub_count,
  COUNT(CASE WHEN currency = 'UAH' THEN 1 END) as uah_count,
  COUNT(CASE WHEN currency IS NULL THEN 1 END) as null_currency_count
FROM users 
WHERE "currentStep" = 'waiting_receipt' AND "hasPaid" = false;

-- 2️⃣ Проверка поля waitingReceiptSince (КЛЮЧЕВОЕ!)
SELECT 
  '2. Поле waitingReceiptSince' as check_type,
  COUNT(*) as total_waiting,
  COUNT(CASE WHEN "waitingReceiptSince" IS NOT NULL THEN 1 END) as has_timestamp,
  COUNT(CASE WHEN "waitingReceiptSince" IS NULL THEN 1 END) as no_timestamp,
  COUNT(CASE WHEN currency = 'RUB' AND "waitingReceiptSince" IS NOT NULL THEN 1 END) as rub_with_timestamp,
  COUNT(CASE WHEN currency = 'UAH' AND "waitingReceiptSince" IS NOT NULL THEN 1 END) as uah_with_timestamp
FROM users 
WHERE "currentStep" = 'waiting_receipt' AND "hasPaid" = false;

-- 3️⃣ Проверка флага receiptReminderSent
SELECT 
  '3. Флаг receiptReminderSent' as check_type,
  COUNT(*) as total_rub_waiting,
  COUNT(CASE WHEN "receiptReminderSent" = true THEN 1 END) as already_sent,
  COUNT(CASE WHEN "receiptReminderSent" = false THEN 1 END) as not_sent_yet,
  COUNT(CASE WHEN "waitingReceiptSince" IS NOT NULL AND "receiptReminderSent" = false THEN 1 END) as can_send
FROM users 
WHERE "currentStep" = 'waiting_receipt' 
  AND "hasPaid" = false 
  AND currency = 'RUB';

-- 4️⃣ Проверка времени (прошло ли 5 минут?)
SELECT 
  '4. Временной фильтр (5 мин)' as check_type,
  COUNT(*) as rub_with_timestamp,
  COUNT(CASE WHEN "waitingReceiptSince" <= NOW() - INTERVAL '5 minutes' THEN 1 END) as older_than_5min,
  COUNT(CASE WHEN "waitingReceiptSince" > NOW() - INTERVAL '5 minutes' THEN 1 END) as newer_than_5min,
  COUNT(CASE WHEN 
    "waitingReceiptSince" <= NOW() - INTERVAL '5 minutes' 
    AND "receiptReminderSent" = false 
  THEN 1 END) as ready_to_send
FROM users 
WHERE "currentStep" = 'waiting_receipt' 
  AND "hasPaid" = false 
  AND currency = 'RUB'
  AND "waitingReceiptSince" IS NOT NULL;

-- 5️⃣ Детальный список RUB пользователей
SELECT 
  '5. Детали RUB пользователей' as check_type,
  "userId",
  username,
  currency,
  "waitingReceiptSince",
  "receiptReminderSent",
  CASE 
    WHEN "waitingReceiptSince" IS NULL THEN 'НЕТ TIMESTAMP'
    WHEN "waitingReceiptSince" > NOW() - INTERVAL '5 minutes' THEN 'МЕНЬШЕ 5 МИН'
    WHEN "receiptReminderSent" = true THEN 'УЖЕ ОТПРАВЛЕНО'
    ELSE 'ГОТОВ К ОТПРАВКЕ'
  END as status,
  EXTRACT(EPOCH FROM (NOW() - "waitingReceiptSince"))/60 as minutes_waiting
FROM users 
WHERE "currentStep" = 'waiting_receipt' 
  AND "hasPaid" = false 
  AND currency = 'RUB'
ORDER BY "waitingReceiptSince" DESC NULLS LAST
LIMIT 20;

-- 6️⃣ Детальный список UAH пользователей (должны иметь NULL в waitingReceiptSince)
SELECT 
  '6. Детали UAH пользователей' as check_type,
  "userId",
  username,
  currency,
  "waitingReceiptSince",
  "currentStep",
  "createdAt"
FROM users 
WHERE "currentStep" = 'waiting_receipt' 
  AND "hasPaid" = false 
  AND currency = 'UAH'
ORDER BY "createdAt" DESC
LIMIT 10;

-- 7️⃣ ТОЧНЫЙ ЗАПРОС из reminderService.ts
SELECT 
  '7. Точный запрос напоминаний' as check_type,
  COUNT(*) as found_by_reminder_service
FROM users
WHERE "currentStep" = 'waiting_receipt'
  AND currency = 'RUB'
  AND "receiptReminderSent" = false
  AND "waitingReceiptSince" > '1970-01-01'::timestamp  -- MoreThan(new Date(0))
  AND "waitingReceiptSince" <= NOW() - INTERVAL '5 minutes';
