-- Миграция: Добавление 3-уровневой системы напоминаний для этапа START
-- Дата: 15 November 2025

-- Добавляем новые колонки для уровней напоминаний START
ALTER TABLE users ADD COLUMN IF NOT EXISTS "reminderLevel1Start" BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "reminderLevel2Start" BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "reminderLevel3Start" BOOLEAN DEFAULT false;

-- Добавляем timestamp для отслеживания когда пользователь перешел на текущий этап
ALTER TABLE users ADD COLUMN IF NOT EXISTS "currentStepChangedAt" TIMESTAMP;

-- Для существующих пользователей устанавливаем currentStepChangedAt = lastActivityAt
UPDATE users 
SET "currentStepChangedAt" = "lastActivityAt" 
WHERE "currentStepChangedAt" IS NULL AND "lastActivityAt" IS NOT NULL;

-- Для пользователей без lastActivityAt используем createdAt
UPDATE users 
SET "currentStepChangedAt" = "createdAt" 
WHERE "currentStepChangedAt" IS NULL;

-- Для новых пользователей на этапе start, которые уже получили старый warmupStartSent,
-- мигрируем флаг в новую систему (считаем что они получили Level 1)
UPDATE users 
SET "reminderLevel1Start" = true 
WHERE "warmupStartSent" = true AND "currentStep" = 'start';

-- Проверяем результат
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN "reminderLevel1Start" = true THEN 1 END) as level1_sent,
  COUNT(CASE WHEN "reminderLevel2Start" = true THEN 1 END) as level2_sent,
  COUNT(CASE WHEN "reminderLevel3Start" = true THEN 1 END) as level3_sent,
  COUNT(CASE WHEN "currentStepChangedAt" IS NOT NULL THEN 1 END) as with_timestamp
FROM users;
