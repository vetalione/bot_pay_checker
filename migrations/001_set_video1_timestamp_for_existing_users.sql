-- 🔄 МИГРАЦИЯ: Установка video1ShownAt для существующих пользователей
-- 
-- Цель: Включить старых пользователей застрявших на video1 в систему автоматических напоминаний
-- 
-- Что делает:
-- 1. Находит всех пользователей с currentStep = 'video1'
-- 2. Которые еще не оплатили (hasPaid = false)
-- 3. У которых нет timestamp video1ShownAt (NULL)
-- 4. Устанавливает video1ShownAt = lastActivityAt
--
-- Результат:
-- - Пользователи застрявшие >10 минут назад получат напоминание при следующей проверке
-- - Пользователи застрявшие <10 минут назад получат напоминание через 10 минут с момента lastActivityAt

-- Шаг 1: Проверяем сколько пользователей будет затронуто (БЕЗ ИЗМЕНЕНИЙ)
SELECT 
  '1. Предварительный просмотр' as step,
  COUNT(*) as total_users_to_update,
  MIN("lastActivityAt") as oldest_activity,
  MAX("lastActivityAt") as newest_activity,
  COUNT(CASE WHEN "lastActivityAt" <= NOW() - INTERVAL '10 minutes' THEN 1 END) as will_get_reminder_immediately,
  COUNT(CASE WHEN "lastActivityAt" > NOW() - INTERVAL '10 minutes' THEN 1 END) as will_get_reminder_later
FROM users 
WHERE "currentStep" = 'video1' 
  AND "hasPaid" = false 
  AND "video1ShownAt" IS NULL;

-- Шаг 2: Просмотр первых 20 пользователей которые будут обновлены
SELECT 
  '2. Примеры пользователей' as step,
  "userId",
  username,
  "currentStep",
  "lastActivityAt",
  EXTRACT(EPOCH FROM (NOW() - "lastActivityAt"))/60 as minutes_since_last_activity,
  CASE 
    WHEN "lastActivityAt" <= NOW() - INTERVAL '10 minutes' THEN 'Получит напоминание СРАЗУ'
    ELSE 'Получит через ' || ROUND(EXTRACT(EPOCH FROM ("lastActivityAt" + INTERVAL '10 minutes' - NOW()))/60) || ' мин'
  END as reminder_timing
FROM users 
WHERE "currentStep" = 'video1' 
  AND "hasPaid" = false 
  AND "video1ShownAt" IS NULL
ORDER BY "lastActivityAt" DESC
LIMIT 20;

-- Шаг 3: ВЫПОЛНИТЬ МИГРАЦИЮ (ОБНОВЛЕНИЕ ДАННЫХ)
-- ⚠️ ВНИМАНИЕ: Это изменит данные в продакшн базе!
-- ⚠️ Убедитесь что вы проверили результаты шагов 1 и 2!

UPDATE users 
SET 
  "video1ShownAt" = "lastActivityAt",
  "video1ReminderSent" = false
WHERE "currentStep" = 'video1' 
  AND "hasPaid" = false 
  AND "video1ShownAt" IS NULL;

-- Шаг 4: Проверка результатов миграции
SELECT 
  '3. Результаты миграции' as step,
  COUNT(*) as total_video1_users,
  COUNT(CASE WHEN "video1ShownAt" IS NOT NULL THEN 1 END) as has_timestamp,
  COUNT(CASE WHEN "video1ShownAt" IS NULL THEN 1 END) as no_timestamp,
  COUNT(CASE WHEN "video1ReminderSent" = false THEN 1 END) as ready_for_reminder
FROM users 
WHERE "currentStep" = 'video1' 
  AND "hasPaid" = false;

-- Шаг 5: Проверка кто получит напоминание в следующей проверке (через 1 минуту)
SELECT 
  '4. Готовы к отправке напоминания' as step,
  COUNT(*) as will_receive_reminder_in_next_check
FROM users 
WHERE "currentStep" = 'video1' 
  AND "hasPaid" = false 
  AND "video1ReminderSent" = false 
  AND "video1ShownAt" IS NOT NULL
  AND "video1ShownAt" <= NOW() - INTERVAL '10 minutes';

-- ═══════════════════════════════════════════════════════════════
-- ИНСТРУКЦИЯ ПО ПРИМЕНЕНИЮ:
-- ═══════════════════════════════════════════════════════════════
--
-- 1. Скопируйте и выполните ШАГ 1 (SELECT) - проверьте количество
-- 2. Скопируйте и выполните ШАГ 2 (SELECT) - посмотрите примеры
-- 3. Если все ОК - выполните ШАГ 3 (UPDATE) - применение миграции
-- 4. Выполните ШАГ 4 (SELECT) - проверьте результаты
-- 5. Выполните ШАГ 5 (SELECT) - сколько получат напоминание сейчас
--
-- ═══════════════════════════════════════════════════════════════

-- ОТКАТ (если что-то пошло не так):
-- UPDATE users SET "video1ShownAt" = NULL WHERE "currentStep" = 'video1' AND "hasPaid" = false;
