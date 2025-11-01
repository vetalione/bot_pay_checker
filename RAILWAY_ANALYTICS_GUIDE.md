# 🚀 Инструкция: Работа с Analytics на Railway

## 📊 Как получать отчеты с production базы данных

После деплоя на Railway у вас будет production PostgreSQL база данных. Вот 3 способа работы с аналитикой:

---

## 🎯 **Способ 1: Railway CLI (Рекомендуется)**

### Установка Railway CLI

```bash
# macOS/Linux
brew install railway

# Альтернатива (npm)
npm install -g @railway/cli
```

### Авторизация
```bash
railway login
```

### Подключение к проекту
```bash
cd "/Users/legend/Desktop/PRODIGY/apps venture/бот приема платежей"
railway link
# Выберите свой проект из списка
```

### Получение аналитики

**Полный отчет:**
```bash
railway run npm run analytics
```

**Только воронка:**
```bash
railway run npm run analytics funnel
```

**Только пользователи:**
```bash
railway run npm run analytics users
```

**Только валидации:**
```bash
railway run npm run analytics validation
```

**Детали отказов:**
```bash
railway run npm run analytics failures
```

**Топ действий:**
```bash
railway run npm run analytics actions
```

---

## 💻 **Способ 2: Прямое подключение через DATABASE_URL**

### 1. Получите DATABASE_URL из Railway

Зайдите на [railway.app](https://railway.app) → Ваш проект → PostgreSQL → Variables → скопируйте `DATABASE_URL`

Пример:
```
postgresql://postgres:password@containers-us-west-123.railway.app:5432/railway
```

### 2. Создайте файл `.env.production`

```bash
# В корне проекта
echo "DATABASE_URL=ваш_database_url_сюда" > .env.production
```

### 3. Запустите аналитику

```bash
# Загрузите переменные из .env.production
source .env.production

# Запустите аналитику
npm run analytics
```

**⚠️ ВАЖНО:** Добавьте `.env.production` в `.gitignore`, чтобы не закоммитить пароли!

```bash
echo ".env.production" >> .gitignore
```

---

## 🌐 **Способ 3: Railway Dashboard (SQL в браузере)**

### Откройте Railway Dashboard
1. Зайдите на [railway.app](https://railway.app)
2. Откройте ваш проект
3. Нажмите на PostgreSQL сервис
4. Откройте вкладку **"Query"**

### Примеры SQL запросов

**Статистика пользователей:**
```sql
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN "hasPaid" = true THEN 1 END) as paid,
  COUNT(CASE WHEN currency = 'RUB' THEN 1 END) as chose_rub,
  COUNT(CASE WHEN currency = 'UAH' THEN 1 END) as chose_uah
FROM users;
```

**Воронка конверсии:**
```sql
SELECT 
  (SELECT COUNT(DISTINCT "userId") FROM user_actions WHERE action = 'start') as started,
  (SELECT COUNT(DISTINCT "userId") FROM user_actions WHERE action = 'click_want_more') as clicked_want_more,
  (SELECT COUNT(DISTINCT "userId") FROM user_actions WHERE action = 'click_continue_watching') as watched_video2,
  (SELECT COUNT(DISTINCT "userId") FROM user_actions WHERE action = 'click_ready_for_more') as watched_video3,
  (SELECT COUNT(DISTINCT "userId") FROM user_actions WHERE action = 'click_get_advantage') as clicked_advantage,
  (SELECT COUNT(DISTINCT "userId") FROM user_actions WHERE action IN ('choose_rub', 'choose_uah')) as chose_currency,
  (SELECT COUNT(DISTINCT "userId") FROM user_actions WHERE action = 'payment_success') as paid;
```

**Последние 10 пользователей:**
```sql
SELECT "userId", username, "firstName", "currentStep", currency, "hasPaid", "createdAt"
FROM users 
ORDER BY "createdAt" DESC 
LIMIT 10;
```

**Статистика валидаций:**
```sql
SELECT 
  (SELECT COUNT(*) FROM user_actions WHERE action = 'photo_rejected') as photos_rejected,
  (SELECT COUNT(*) FROM user_actions WHERE action = 'receipt_validation_failed') as validations_failed,
  (SELECT COUNT(*) FROM user_actions WHERE action = 'payment_success') as validations_passed;
```

**Топ действий:**
```sql
SELECT action, COUNT(*) as count 
FROM user_actions 
GROUP BY action 
ORDER BY count DESC;
```

**Детали отказов:**
```sql
-- НЕ-квитанции
SELECT "userId", metadata, timestamp 
FROM user_actions 
WHERE action = 'photo_rejected' 
ORDER BY timestamp DESC 
LIMIT 10;

-- Неверные квитанции
SELECT "userId", metadata, timestamp 
FROM user_actions 
WHERE action = 'receipt_validation_failed' 
ORDER BY timestamp DESC 
LIMIT 10;
```

---

## 📊 **Бизнес-вопросы и SQL запросы**

### 1. Сколько людей запустило бота?
```sql
SELECT COUNT(DISTINCT "userId") FROM user_actions WHERE action = 'start';
```

### 2. Сколько людей оплатило в рублях?
```sql
SELECT COUNT(*) FROM users WHERE currency = 'RUB' AND "hasPaid" = true;
```

### 3. Сколько людей оплатило в гривнах?
```sql
SELECT COUNT(*) FROM users WHERE currency = 'UAH' AND "hasPaid" = true;
```

### 4. Сколько людей отправило НЕ-квитанцию?
```sql
SELECT COUNT(DISTINCT "userId") FROM user_actions WHERE action = 'photo_rejected';
```

### 5. Сколько квитанций провалили валидацию?
```sql
SELECT COUNT(*) FROM user_actions WHERE action = 'receipt_validation_failed';
```

### 6. Конверсия каждого шага воронки?
```bash
railway run npm run analytics funnel
```

### 7. Где самый большой drop-off?
```bash
railway run npm run analytics funnel
# Смотрите на "Отвалилось" в каждом шаге
```

### 8. Сколько запросили помощь ассистента?
```
⚠️ Кнопка помощи - это URL-кнопка (открывает чат в Telegram).
Telegram не отправляет события при клике на URL-кнопки, 
поэтому отследить это технически невозможно.

Альтернатива: Попросить ассистента @ADA_gii вести учет обращений.
```

---

## ⏰ **Автоматические отчеты**

### Настройка ежедневной отправки отчетов в Telegram

Вы можете настроить cron job на Railway, который будет каждый день отправлять вам отчет в Telegram.

**Создайте файл `src/daily-report.ts`:**
```typescript
import { Telegraf } from 'telegraf';
import { AppDataSource } from './database';

const ADMIN_CHAT_ID = '278263484'; // Ваш Telegram ID
const bot = new Telegraf(process.env.BOT_TOKEN!);

async function sendDailyReport() {
  await AppDataSource.initialize();
  
  // Получить статистику за сегодня
  const stats = await AppDataSource.query(`
    SELECT 
      COUNT(DISTINCT "userId") as new_users,
      COUNT(CASE WHEN action = 'payment_success' THEN 1 END) as payments
    FROM user_actions 
    WHERE timestamp >= CURRENT_DATE
  `);
  
  const message = `
📊 Отчет за ${new Date().toLocaleDateString('ru-RU')}

👥 Новых пользователей: ${stats[0].new_users}
💰 Оплат: ${stats[0].payments}
  `;
  
  await bot.telegram.sendMessage(ADMIN_CHAT_ID, message);
  await AppDataSource.destroy();
}

sendDailyReport();
```

**Добавьте в Railway:**
1. Settings → Cron Jobs → Add Cron Job
2. Command: `npm run daily-report`
3. Schedule: `0 20 * * *` (каждый день в 20:00)

---

## 🔐 **Безопасность**

### ⚠️ НИКОГДА НЕ КОММИТЬТЕ:
- `.env`
- `.env.production`
- `DATABASE_URL`
- Пароли от БД

### ✅ Добавьте в `.gitignore`:
```
.env
.env.production
.env.local
*.log
```

---

## 💡 **Полезные команды**

```bash
# Локальная аналитика (ваш компьютер)
npm run analytics

# Production аналитика (Railway)
railway run npm run analytics

# Проверка подключения к Railway
railway status

# Логи production бота
railway logs

# Открыть Railway dashboard
railway open

# Список всех переменных окружения
railway variables

# SSH в Railway контейнер
railway shell
```

---

## 🎓 **Примеры использования**

### Утром проверяете статистику:
```bash
railway run npm run analytics
```

### Хотите узнать сколько людей отвалилось на выборе валюты:
```bash
railway run npm run analytics funnel
```

### Нужно посмотреть почему квитанции отклоняются:
```bash
railway run npm run analytics failures
```

### Проверить последних зарегистрированных:
```bash
railway run npm run analytics users
```

---

## ❓ FAQ

**Q: Нужно ли каждый раз вводить пароль?**  
A: Нет, `railway login` сохраняет токен. Авторизация нужна только один раз.

**Q: Можно ли запускать analytics с телефона?**  
A: Да, через Railway Dashboard → Query (способ 3). Или установите Termius app + Railway CLI.

**Q: Как часто можно запускать analytics?**  
A: Без ограничений. Это обычный SELECT запрос, не нагружает БД.

**Q: Можно ли дать доступ к аналитике другому человеку?**  
A: Да, пригласите его в Railway проект (Settings → Members) с ролью Viewer.

**Q: Данные реально в реальном времени?**  
A: Да, каждый раз когда вы запускаете `railway run npm run analytics`, он подключается к живой БД и показывает актуальные данные.

---

## 🚀 **Быстрый старт после деплоя**

```bash
# 1. Установите Railway CLI
brew install railway

# 2. Авторизуйтесь
railway login

# 3. Подключите проект
cd "/Users/legend/Desktop/PRODIGY/apps venture/бот приема платежей"
railway link

# 4. Получите отчет
railway run npm run analytics

# Готово! 🎉
```

---

**Теперь вы можете получать полную аналитику бота в любое время с любого компьютера!** 📊✨
