-- Проверяем пользователей в waiting_receipt
SELECT 
  COUNT(*) as total_waiting,
  COUNT(CASE WHEN currency = 'RUB' THEN 1 END) as rub_waiting,
  COUNT(CASE WHEN currency = 'UAH' THEN 1 END) as uah_waiting,
  COUNT(CASE WHEN currency IS NULL THEN 1 END) as null_currency
FROM users 
WHERE "currentStep" = 'waiting_receipt' AND "hasPaid" = false;

-- Проверяем пользователей в payment_choice
SELECT 
  COUNT(*) as total_at_choice,
  COUNT(CASE WHEN currency IS NULL THEN 1 END) as no_currency_chosen,
  COUNT(CASE WHEN currency IS NOT NULL THEN 1 END) as currency_chosen
FROM users 
WHERE "currentStep" = 'payment_choice' AND "hasPaid" = false;

-- Детальный список waiting_receipt пользователей
SELECT 
  "userId",
  username,
  currency,
  "currentStep",
  "waitingReceiptSince",
  "receiptReminderSent",
  "createdAt"
FROM users 
WHERE "currentStep" = 'waiting_receipt' AND "hasPaid" = false
ORDER BY "waitingReceiptSince" DESC
LIMIT 10;
