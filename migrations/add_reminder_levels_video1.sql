-- Миграция: Добавление 3-уровневой системы напоминаний для этапа VIDEO1
-- Дата: 15 November 2025

-- Добавляем новые колонки для уровней напоминаний VIDEO1
ALTER TABLE users ADD COLUMN IF NOT EXISTS "reminderLevel1Video1" BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "reminderLevel2Video1" BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "reminderLevel3Video1" BOOLEAN DEFAULT false;

-- Для пользователей на этапе video1, которые уже получили старый video1ReminderSent,
-- мигрируем флаг в новую систему (считаем что они получили Level 1)
UPDATE users 
SET "reminderLevel1Video1" = true 
WHERE "video1ReminderSent" = true AND "currentStep" = 'video1';

-- Проверяем результат
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN "reminderLevel1Video1" = true THEN 1 END) as level1_sent,
  COUNT(CASE WHEN "reminderLevel2Video1" = true THEN 1 END) as level2_sent,
  COUNT(CASE WHEN "reminderLevel3Video1" = true THEN 1 END) as level3_sent,
  COUNT(CASE WHEN "currentStep" = 'video1' THEN 1 END) as on_video1
FROM users;
