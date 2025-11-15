-- Миграция: Добавление 3-уровневой системы напоминаний для этапа VIDEO2
-- Дата: 15 November 2025

-- Добавляем новые колонки для уровней напоминаний VIDEO2
ALTER TABLE users ADD COLUMN IF NOT EXISTS "reminderLevel1Video2" BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "reminderLevel2Video2" BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "reminderLevel3Video2" BOOLEAN DEFAULT false;

-- Проверяем результат
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN "reminderLevel1Video2" = true THEN 1 END) as level1_sent,
  COUNT(CASE WHEN "reminderLevel2Video2" = true THEN 1 END) as level2_sent,
  COUNT(CASE WHEN "reminderLevel3Video2" = true THEN 1 END) as level3_sent,
  COUNT(CASE WHEN "currentStep" = 'video2' THEN 1 END) as on_video2
FROM users;
