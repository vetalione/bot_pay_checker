-- 📊 ПРЕДВАРИТЕЛЬНЫЙ ПРОСМОТР: Кому будет отправлена рассылка?

-- 1️⃣ Общая статистика
SELECT 
  '1. Общая статистика' as info,
  COUNT(*) as total_users,
  COUNT(CASE WHEN "currentStep" = 'start' THEN 1 END) as stuck_at_start,
  COUNT(CASE WHEN "currentStep" = 'video1' THEN 1 END) as stuck_at_video1
FROM users 
WHERE "currentStep" IN ('start', 'video1') 
  AND "hasPaid" = false;

-- 2️⃣ Детальный список (первые 50 пользователей)
SELECT 
  "userId",
  username,
  "currentStep",
  "createdAt",
  "lastActivityAt",
  EXTRACT(EPOCH FROM (NOW() - "lastActivityAt"))/3600 as hours_inactive
FROM users 
WHERE "currentStep" IN ('start', 'video1') 
  AND "hasPaid" = false
ORDER BY "lastActivityAt" DESC
LIMIT 50;

-- 3️⃣ Распределение по времени неактивности
SELECT 
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - "lastActivityAt"))/3600 < 1 THEN '< 1 час'
    WHEN EXTRACT(EPOCH FROM (NOW() - "lastActivityAt"))/3600 < 24 THEN '1-24 часа'
    WHEN EXTRACT(EPOCH FROM (NOW() - "lastActivityAt"))/86400 < 7 THEN '1-7 дней'
    WHEN EXTRACT(EPOCH FROM (NOW() - "lastActivityAt"))/86400 < 30 THEN '1-4 недели'
    ELSE '> месяца'
  END as inactive_period,
  COUNT(*) as count
FROM users 
WHERE "currentStep" IN ('start', 'video1') 
  AND "hasPaid" = false
GROUP BY inactive_period
ORDER BY 
  CASE inactive_period
    WHEN '< 1 час' THEN 1
    WHEN '1-24 часа' THEN 2
    WHEN '1-7 дней' THEN 3
    WHEN '1-4 недели' THEN 4
    ELSE 5
  END;

-- 4️⃣ Проверка на дубликаты (не должно быть)
SELECT 
  "userId",
  COUNT(*) as occurrences
FROM users 
WHERE "currentStep" IN ('start', 'video1') 
  AND "hasPaid" = false
GROUP BY "userId"
HAVING COUNT(*) > 1;

-- 5️⃣ Самые активные периоды (когда пользователи застревали)
SELECT 
  DATE("createdAt") as date,
  COUNT(*) as stuck_users,
  COUNT(CASE WHEN "currentStep" = 'start' THEN 1 END) as start_stuck,
  COUNT(CASE WHEN "currentStep" = 'video1' THEN 1 END) as video1_stuck
FROM users 
WHERE "currentStep" IN ('start', 'video1') 
  AND "hasPaid" = false
GROUP BY DATE("createdAt")
ORDER BY date DESC
LIMIT 10;
