# Database Migrations

## Порядок применения миграций

### 1. add_blocked_bot_column.sql
Добавляет колонки для отслеживания заблокированных пользователей.

```sql
psql $DATABASE_URL -f migrations/add_blocked_bot_column.sql
```

### 2. mark_blocked_users_bf3.sql
Помечает 108 пользователей как заблокировавших бота на основе логов BF Day 3 (16.11.2025).

```sql
psql $DATABASE_URL -f migrations/mark_blocked_users_bf3.sql
```

## Быстрое применение всех миграций

```bash
# Применить все миграции по порядку
psql $DATABASE_URL -f migrations/add_blocked_bot_column.sql
psql $DATABASE_URL -f migrations/mark_blocked_users_bf3.sql
```

## Проверка статуса

```sql
-- Проверить количество заблокированных
SELECT COUNT(*) as total_blocked FROM users WHERE "blockedBot" = true;

-- Статистика по этапам воронки
SELECT 
  "currentStep", 
  COUNT(*) as blocked_count
FROM users
WHERE "blockedBot" = true
GROUP BY "currentStep"
ORDER BY blocked_count DESC;
```

Ожидаемый результат: 108 заблокированных пользователей
- video1: 37
- video3: 28
- start: 20
- waiting_receipt: 15
- payment_choice: 5
- video2: 3
