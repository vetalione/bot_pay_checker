# 🚀 Railway Deployment Guide

## Шаг 1: Подготовка

### ✅ Что уже готово:
- PostgreSQL entities (User, UserAction)
- Database connection (TypeORM)
- Retargeting scripts
- All bot logic

### ⚙️ Что нужно сделать:

## Шаг 2: Создание проекта на Railway

1. Зайдите на [railway.app](https://railway.app)
2. Нажмите "New Project"
3. Выберите "Deploy from GitHub repo"
4. Выберите ваш репозиторий

## Шаг 3: Добавление PostgreSQL

```bash
# В Railway Dashboard:
1. Нажмите "+ New" → "Database" → "PostgreSQL"
2. Railway автоматически создаст DATABASE_URL
```

## Шаг 4: Настройка переменных окружения

В Railway Dashboard → Settings → Variables добавьте:

```bash
BOT_TOKEN=7959869021:AAEVFt27qkzglmtyf6ZqDrUGuv4xTUpebJY
GEMINI_API_KEY=AIzaSyCPeDvradN0R__W2CAHlTVG7YsMDQLPxbM
CHANNEL_ID=-1003216850856
CHAT_ID=-1002895096401
CHANNEL_INVITE_LINK=https://t.me/+your_invite_link

# Payment RUB
PAYMENT_AMOUNT=2000
CARD_NUMBER=4640053183401949

# Payment UAH
PAYMENT_AMOUNT_UAH=1050
CARD_NUMBER_UAH=5169155124283993

# Video File IDs
VIDEO_1_FILE_ID=BQACAgIAAxkBAAIBymkGVKEWzZGwAAHLBTgHYqO8uX76qgACG4sAAin1MUj9943gKCRThjYE
VIDEO_2_FILE_ID=BQACAgIAAxkBAAIBzGkGVtiHXNq6qEyn6o1YqzrzbB4mAAI8iwACKfUxSLTrSro8LHPCNgQ
VIDEO_3_FILE_ID=BQACAgIAAxkBAAIBzmkGWYGBb3f8H7858NSvWl1kfbphAAJgiwACKfUxSAABjup_IMbi3TYE

# Environment
NODE_ENV=production

# DATABASE_URL - автоматически создаётся Railway!
```

## Шаг 5: Настройка Build & Start

Railway автоматически использует `npm start`, но убедитесь:

```json
// package.json - уже настроено!
"scripts": {
  "start": "node dist/index.js",  // ← Это запустится на Railway
  "build": "tsc"                   // ← Это выполнится при деплое
}
```

## Шаг 6: Deploy!

```bash
git add .
git commit -m "feat: Add PostgreSQL and retargeting"
git push origin main
```

Railway автоматически:
1. Обнаружит новый push
2. Установит зависимости (npm install)
3. Соберёт проект (npm run build)
4. Запустит бота (npm start)
5. Подключится к PostgreSQL

## Шаг 7: Проверка

В Railway Dashboard → Deployments → Logs:

```
✅ База данных инициализирована
✅ UserService создан
✅ Бот запущен успешно
Environment: production
Port: 3000
```

## Шаг 8: Настройка Retargeting (опционально)

### Вариант A: Ручной запуск

SSH в Railway container:
```bash
railway run npm run retargeting stuck_video1
```

### Вариант B: Cron Job (рекомендуется)

1. Создайте новый сервис в Railway: "Cron Jobs"
2. Установите расписание:

```bash
# Каждый день в 10:00 - напоминание video1
0 10 * * * npm run retargeting stuck_video1

# Каждый день в 14:00 - напоминание video2
0 14 * * * npm run retargeting stuck_video2

# Каждый день в 18:00 - незавершённая оплата
0 18 * * * npm run retargeting abandoned_payment
```

### Вариант C: Внешний cron (easycron.com)

1. Зайдите на [easycron.com](https://www.easycron.com)
2. Создайте webhook endpoint в боте
3. Настройте расписание

## Troubleshooting

### Ошибка: Cannot connect to database

**Решение:**
```bash
# В Railway Dashboard проверьте:
1. PostgreSQL service запущен
2. DATABASE_URL автоматически добавлен в переменные
3. Bot service связан с PostgreSQL (Connect)
```

### Ошибка: Module not found

**Решение:**
```bash
# Убедитесь что package.json содержит все зависимости:
npm install
git add package.json package-lock.json
git commit -m "fix: Update dependencies"
git push
```

### Бот не отвечает

**Решение:**
```bash
# Railway Logs покажут:
1. Проверьте BOT_TOKEN правильный
2. Проверьте что бот запущен (Deployments → Active)
3. Перезапустите: Settings → Restart
```

## Monitoring

### Проверка статистики:

```bash
# Локально (с доступом к Railway DB):
DATABASE_URL="postgresql://railway_url" npm run retargeting stats

# Результат:
start                 1000 пользователей
video1                800 пользователей
payment_choice        400 пользователей
completed             150 пользователей
```

## Готово! 🎉

Ваш бот теперь:
- ✅ Работает на Railway 24/7
- ✅ Хранит данные в PostgreSQL
- ✅ Готов к retargeting
- ✅ Scalable и надёжный

## Полезные команды

```bash
# Посмотреть логи
railway logs

# Подключиться к БД
railway connect postgres

# Запустить команду в контейнере
railway run npm run retargeting stats

# Перезапустить
railway restart
```

## Следующие шаги

1. Настройте webhook для telegram (для production)
2. Добавьте monitoring (Sentry, LogRocket)
3. Настройте auto-scaling
4. Добавьте backup БД

---

**Документация:**
- [DATABASE_INFO.md](./DATABASE_INFO.md) - Структура БД
- [RETARGETING_GUIDE.md](./RETARGETING_GUIDE.md) - Retargeting кампании
- [TRACKING_GUIDE.ts](./TRACKING_GUIDE.ts) - Tracking действий

**Support:**
- Railway Docs: https://docs.railway.app
- TypeORM Docs: https://typeorm.io
- Telegraf Docs: https://telegraf.js.org
