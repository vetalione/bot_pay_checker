-- Проверяем пользователей готовых для VIDEO2 Level 3
SELECT 
  "userId",
  "firstName",
  "currentStep",
  "reminderLevel1Video2",
  "reminderLevel2Video2",
  "reminderLevel3Video2",
  "reminderLevel2Video2SentAt",
  NOW() - "reminderLevel2Video2SentAt" as time_since_level2
FROM users
WHERE "currentStep" = 'video2'
  AND "hasPaid" = false
  AND "reminderLevel2Video2" = true
  AND "reminderLevel3Video2" = false
  AND "reminderLevel2Video2SentAt" IS NOT NULL
ORDER BY "reminderLevel2Video2SentAt" ASC
LIMIT 10;
