-- Добавляем флаги для отслеживания отправки warmup сообщений
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS "warmupStartSent" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "warmupVideo1Sent" boolean DEFAULT false;

-- Индексы для быстрого поиска пользователей для warmup
CREATE INDEX IF NOT EXISTS idx_users_warmup_start ON users("currentStep", "hasPaid", "warmupStartSent", "lastActivityAt") 
WHERE "currentStep" = 'start' AND "hasPaid" = false AND "warmupStartSent" = false;

CREATE INDEX IF NOT EXISTS idx_users_warmup_video1 ON users("currentStep", "hasPaid", "warmupVideo1Sent", "lastActivityAt") 
WHERE "currentStep" = 'video1' AND "hasPaid" = false AND "warmupVideo1Sent" = false;
