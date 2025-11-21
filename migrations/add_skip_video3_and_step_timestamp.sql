-- Миграция: Добавление полей для отслеживания пропуска видео3 и изменения шага
-- Дата: 15 November 2025

-- Добавляем поле для отслеживания изменения текущего шага
ALTER TABLE users ADD COLUMN IF NOT EXISTS "currentStepChangedAt" TIMESTAMP;

-- Добавляем поля для отслеживания пропуска видео3
ALTER TABLE users ADD COLUMN IF NOT EXISTS "skippedVideo3" BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "skippedVideo3At" TIMESTAMP;

-- Проверяем результат
SELECT
  COUNT(*) as total_users,
  COUNT(CASE WHEN "skippedVideo3" = true THEN 1 END) as skipped_video3_count,
  COUNT(CASE WHEN "currentStep" = 'video3' THEN 1 END) as on_video3_step
FROM users;