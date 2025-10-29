# Рекомендации по улучшению бота

## 1. Проверка платежных квитанций (OCR)

Текущая версия использует упрощенную проверку. Для продакшена рекомендуется:

### Вариант A: Google Vision API
```typescript
import vision from '@google-cloud/vision';

async function validateReceiptWithOCR(imageUrl: string): Promise<boolean> {
  const client = new vision.ImageAnnotatorClient();
  const [result] = await client.textDetection(imageUrl);
  const text = result.fullTextAnnotation?.text || '';
  
  // Проверяем сумму и номер карты
  const hasAmount = text.includes('2000');
  const hasCardNumber = text.includes('4640') && text.includes('1949');
  
  return hasAmount && hasCardNumber;
}
```

### Вариант B: Tesseract.js (бесплатный)
```bash
npm install tesseract.js
```

```typescript
import Tesseract from 'tesseract.js';

async function validateReceiptWithTesseract(imagePath: string): Promise<boolean> {
  const { data: { text } } = await Tesseract.recognize(imagePath, 'rus');
  
  return checkAmountInText(text, 2000) && checkCardNumberInText(text, '4640053183401949');
}
```

## 2. База данных для хранения состояний

Используйте PostgreSQL, MongoDB или Redis вместо `Map`:

### PostgreSQL (рекомендуется для Railway)
```bash
npm install pg typeorm
```

```typescript
import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryColumn()
  userId: number;

  @Column()
  step: string;

  @Column({ nullable: true })
  username: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
```

### Redis (для быстрого хранилища)
```bash
npm install ioredis
```

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function saveUserState(userId: number, state: UserState) {
  await redis.set(`user:${userId}`, JSON.stringify(state));
}

async function getUserState(userId: number): Promise<UserState | null> {
  const data = await redis.get(`user:${userId}`);
  return data ? JSON.parse(data) : null;
}
```

## 3. Логирование и мониторинг

### Sentry для отслеживания ошибок
```bash
npm install @sentry/node
```

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

bot.catch((err, ctx) => {
  Sentry.captureException(err);
  console.error('Error:', err);
});
```

### Winston для структурированных логов
```bash
npm install winston
```

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

## 4. Webhook вместо polling

Для продакшена используйте webhook:

```typescript
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Webhook endpoint
app.use(bot.webhookCallback('/webhook'));

bot.telegram.setWebhook(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}/webhook`);

app.listen(PORT, () => {
  console.log(`Bot running on port ${PORT}`);
});
```

## 5. Антиспам и лимиты

```typescript
import rateLimit from 'telegraf-ratelimit';

const limitConfig = {
  window: 3000, // 3 секунды
  limit: 1, // 1 сообщение
  onLimitExceeded: (ctx: Context) => {
    ctx.reply('Пожалуйста, не спамьте. Подождите немного.');
  }
};

bot.use(rateLimit(limitConfig));
```

## 6. Админ-панель

Создайте простую админку для управления:

```typescript
// Список админов
const ADMIN_IDS = [123456789]; // Ваш Telegram ID

bot.command('stats', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) {
    return ctx.reply('Нет доступа');
  }
  
  const totalUsers = userStates.size;
  const paidUsers = Array.from(userStates.values())
    .filter(u => u.step === 'completed').length;
  
  await ctx.reply(
    `📊 Статистика:\n` +
    `👥 Всего пользователей: ${totalUsers}\n` +
    `💰 Оплативших: ${paidUsers}`
  );
});
```

## 7. Обработка файлов квитанций

```typescript
import axios from 'axios';
import fs from 'fs';

async function downloadReceipt(fileId: string): Promise<string> {
  const fileLink = await bot.telegram.getFileLink(fileId);
  const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
  
  const fileName = `receipts/${Date.now()}_${fileId}.jpg`;
  fs.writeFileSync(fileName, response.data);
  
  return fileName;
}

bot.on(message('photo'), async (ctx) => {
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  const filePath = await downloadReceipt(photo.file_id);
  
  // Теперь можно проверить файл через OCR
  const isValid = await validateReceiptWithOCR(filePath);
});
```

## 8. Резервное копирование данных

```typescript
import cron from 'node-cron';

// Бэкап каждый день в 3:00
cron.schedule('0 3 * * *', async () => {
  const backup = {
    timestamp: new Date().toISOString(),
    users: Array.from(userStates.entries()),
  };
  
  fs.writeFileSync(
    `backups/backup_${Date.now()}.json`,
    JSON.stringify(backup, null, 2)
  );
});
```

## 9. Тестирование

```bash
npm install --save-dev jest @types/jest ts-jest
```

```typescript
// __tests__/utils.test.ts
import { formatCardNumber, checkAmountInText } from '../src/utils';

describe('Utils', () => {
  test('formatCardNumber should format correctly', () => {
    expect(formatCardNumber('4640053183401949')).toBe('4640 0531 8340 1949');
  });
  
  test('checkAmountInText should find amount', () => {
    expect(checkAmountInText('Сумма: 2000 руб', 2000)).toBe(true);
    expect(checkAmountInText('Сумма: 1000 руб', 2000)).toBe(false);
  });
});
```

## 10. Переменные окружения (дополнительные)

```env
# Дополнительные настройки
SUPPORT_USERNAME=@your_support_bot
MAX_VIDEO_SIZE_MB=50
RECEIPT_CHECK_TIMEOUT_MS=30000
MAX_RETRY_ATTEMPTS=3

# База данных
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Redis
REDIS_URL=redis://localhost:6379

# Sentry
SENTRY_DSN=https://your-sentry-dsn

# Admin
ADMIN_IDS=123456789,987654321
```

## Приоритет внедрения

1. **Критически важно:**
   - База данных (PostgreSQL/MongoDB)
   - OCR для проверки квитанций
   - Webhook вместо polling

2. **Важно:**
   - Логирование (Winston/Sentry)
   - Антиспам
   - Админ-панель

3. **Желательно:**
   - Тестирование
   - Резервное копирование
   - Расширенная обработка ошибок

4. **Опционально:**
   - Аналитика
   - A/B тестирование
   - Многоязычность
