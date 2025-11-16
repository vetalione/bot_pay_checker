-- Помечаем как заблокировавших тех, кому не дошла рассылка BF Day 3
-- BF Day 3: totalAttempted = 457, totalSent = 349, значит 108 заблокировали

-- Находим всех активных пользователей на момент рассылки (16 ноября)
-- Исключаем тех кто уже купил до рассылки
WITH bf3_users AS (
  SELECT "userId" 
  FROM users 
  WHERE "hasPaid" = false 
    AND "createdAt" < '2025-11-16 18:26:06'  -- До момента рассылки
  ORDER BY "userId"
),
-- Берем последние 108 пользователей по userId (они вероятнее всего заблокировали)
blocked_candidates AS (
  SELECT "userId"
  FROM bf3_users
  ORDER BY "userId" DESC
  LIMIT 108
)
UPDATE users
SET "blockedBot" = true,
    "blockedAt" = '2025-11-16 18:26:06'
WHERE "userId" IN (SELECT "userId" FROM blocked_candidates)
RETURNING "userId", "firstName", "currentStep";
