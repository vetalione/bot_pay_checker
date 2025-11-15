-- Добавление timestamp колонок для отслеживания времени отправки каждого уровня напоминаний
-- Это предотвратит спам при редеплое

-- START timestamps
ALTER TABLE users ADD COLUMN IF NOT EXISTS "reminderLevel1StartSentAt" TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "reminderLevel2StartSentAt" TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "reminderLevel3StartSentAt" TIMESTAMP;

-- VIDEO1 timestamps  
ALTER TABLE users ADD COLUMN IF NOT EXISTS "reminderLevel1Video1SentAt" TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "reminderLevel2Video1SentAt" TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "reminderLevel3Video1SentAt" TIMESTAMP;

-- VIDEO2 timestamps
ALTER TABLE users ADD COLUMN IF NOT EXISTS "reminderLevel1Video2SentAt" TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "reminderLevel2Video2SentAt" TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "reminderLevel3Video2SentAt" TIMESTAMP;

-- VIDEO3 timestamps
ALTER TABLE users ADD COLUMN IF NOT EXISTS "reminderLevel1Video3SentAt" TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "reminderLevel2Video3SentAt" TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "reminderLevel3Video3SentAt" TIMESTAMP;
