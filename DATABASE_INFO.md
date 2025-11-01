# Интеграция PostgreSQL с ботом

## Что было добавлено:

### 1. База данных
- **src/database.ts** - подключение к PostgreSQL через TypeORM
- **src/entities/User.ts** - модель пользователя
- **src/entities/UserAction.ts** - модель действий пользователя

### 2. Сервисы
- **src/userService.ts** - основной сервис для работы с БД
  - Создание/получение пользователей
  - Отслеживание действий
  - **Retargeting**: Запросы для сегментации пользователей
  - **Analytics**: Статистика воронки и конверсии

### 3. Helper функции
- **src/dbHelpers.ts** - вспомогательные функции для интеграции с ботом

## Как это работает:

### Двойное хранение (Map + БД)
```
Map (userStates) - быстрый доступ в runtime
      ↓
PostgreSQL - persistence, аналитика, retargeting
```

### Примеры retargeting запросов:

```typescript
// Пользователи, которые видели video1, но не пошли дальше (24ч+)
const stuckUsers = await userService.getUsersStuckAtStep('video1', 24);

// Пользователи, которые дошли до оплаты, но не оплатили
const abandonedPayment = await userService.getUsersAbandonedPayment(24);

// Статистика по воронке
const stats = await userService.getFunnelStats();
// { start: 1000, video1: 800, video2: 600, ... }

// Конверсия
const conversion = await userService.getConversionRate();
// { total: 1000, paid: 150, rate: 15 }
```

## Настройка для Railway:

### 1. Добавьте PostgreSQL в Railway:
```bash
railway add postgresql
```

### 2. Railway автоматически установит переменную:
```
DATABASE_URL=postgresql://user:pass@host:port/dbname
```

### 3. Ваш бот автоматически подключится к БД

## Локальное тестирование:

### 1. Установите PostgreSQL локально:
```bash
# macOS
brew install postgresql
brew services start postgresql

# Создайте БД
createdb telegram_bot
```

### 2. Обновите .env:
```bash
DATABASE_URL=postgresql://localhost:5432/telegram_bot
```

### 3. Запустите бота:
```bash
npm run dev
```

## Применение новых сценариев на старую базу:

Теперь вы можете:

1. **Получить всех пользователей**:
```typescript
const allUsers = await userService.getAllUsers();
```

2. **Получить пользователей, которые уже купили** (для допродаж):
```typescript
const completedUsers = await userService.getCompletedUsers();
```

3. **Отправить напоминания застрявшим на video1**:
```typescript
const stuckAtVideo1 = await userService.getUsersStuckAtStep('video1', 48);
for (const user of stuckAtVideo1) {
  await bot.telegram.sendMessage(
    user.userId,
    'Напоминание: у тебя остались ещё 2 видео!'
  );
}
```

## Данные НЕ ТЕРЯЮТСЯ при рестарте бота!

До: Map очищается при перезапуске ❌
Теперь: PostgreSQL сохраняет все ✅

## Готово к production!

- ✅ Persistence
- ✅ Retargeting
- ✅ Analytics
- ✅ Segmentation
- ✅ Scalable (Railway)
