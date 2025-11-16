-- Добавляем колонку для отслеживания заблокировавших бота
ALTER TABLE users ADD COLUMN IF NOT EXISTS "blockedBot" boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "blockedAt" TIMESTAMP;

-- Индекс для быстрого поиска заблокировавших
CREATE INDEX IF NOT EXISTS idx_users_blocked_bot ON users("blockedBot") WHERE "blockedBot" = true;

-- Статистика: сколько заблокировали по этапам
CREATE INDEX IF NOT EXISTS idx_users_blocked_by_step ON users("currentStep", "blockedBot") WHERE "blockedBot" = true;
