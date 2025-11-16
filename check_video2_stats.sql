-- Общая статистика по VIDEO2 напоминаниям
SELECT 
  COUNT(*) FILTER (WHERE "currentStep" = 'video2') as on_video2_now,
  COUNT(*) FILTER (WHERE "reminderLevel1Video2" = true) as got_level1,
  COUNT(*) FILTER (WHERE "reminderLevel2Video2" = true) as got_level2,
  COUNT(*) FILTER (WHERE "reminderLevel3Video2" = true) as got_level3,
  COUNT(*) FILTER (WHERE "currentStep" = 'video2' AND "reminderLevel2Video2" = true) as on_video2_with_level2,
  COUNT(*) FILTER (WHERE "currentStep" = 'video2' AND "reminderLevel2Video2" = true AND "reminderLevel2Video2SentAt" IS NOT NULL) as ready_for_level3_check,
  COUNT(*) FILTER (WHERE "currentStep" = 'video2' AND "reminderLevel2Video2" = true AND "reminderLevel2Video2SentAt" < NOW() - INTERVAL '24 hours') as ready_for_level3_24h
FROM users
WHERE "hasPaid" = false;
