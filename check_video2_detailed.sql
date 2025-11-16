-- Детальная статистика по VIDEO2
SELECT 
  -- Всего застряло на video2
  COUNT(*) FILTER (WHERE "currentStep" = 'video2' AND "hasPaid" = false) as total_stuck_on_video2,
  
  -- Получили Level 1
  COUNT(*) FILTER (WHERE "currentStep" = 'video2' AND "hasPaid" = false AND "reminderLevel1Video2" = true) as got_level1,
  
  -- Получили Level 2
  COUNT(*) FILTER (WHERE "currentStep" = 'video2' AND "hasPaid" = false AND "reminderLevel2Video2" = true) as got_level2,
  
  -- Получили Level 3
  COUNT(*) FILTER (WHERE "currentStep" = 'video2' AND "hasPaid" = false AND "reminderLevel3Video2" = true) as got_level3,
  
  -- Level 2 БЕЗ timestamp (старые пользователи)
  COUNT(*) FILTER (WHERE "currentStep" = 'video2' AND "hasPaid" = false AND "reminderLevel2Video2" = true AND "reminderLevel2Video2SentAt" IS NULL) as level2_without_timestamp,
  
  -- Level 2 С timestamp (новые пользователи)
  COUNT(*) FILTER (WHERE "currentStep" = 'video2' AND "hasPaid" = false AND "reminderLevel2Video2" = true AND "reminderLevel2Video2SentAt" IS NOT NULL) as level2_with_timestamp,
  
  -- Кто ПОЛУЧИТ Level 3 если проставим timestamp сейчас (25+ часов назад)
  COUNT(*) FILTER (WHERE 
    "currentStep" = 'video2' 
    AND "hasPaid" = false 
    AND "reminderLevel2Video2" = true 
    AND "reminderLevel3Video2" = false
    AND "reminderLevel2Video2SentAt" IS NULL
  ) as will_get_level3_after_fix,
  
  -- У кого уже есть timestamp и они готовы к Level 3 (24+ часа прошло)
  COUNT(*) FILTER (WHERE 
    "currentStep" = 'video2' 
    AND "hasPaid" = false 
    AND "reminderLevel2Video2" = true 
    AND "reminderLevel3Video2" = false
    AND "reminderLevel2Video2SentAt" IS NOT NULL
    AND "reminderLevel2Video2SentAt" < NOW() - INTERVAL '24 hours'
  ) as ready_for_level3_now

FROM users;
