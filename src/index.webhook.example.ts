 // Альтернативная версия index.ts с webhook для Railway

import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import express from 'express';
import * as dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN!);
const app = express();

// Middleware для парсинга JSON
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Bot is running!');
});

// Webhook endpoint
app.use(bot.webhookCallback('/webhook'));

// Запуск сервера
const PORT = process.env.PORT || 3000;
const WEBHOOK_DOMAIN = process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost';

async function startBot() {
  if (process.env.NODE_ENV === 'production') {
    // Production: используем webhook
    await bot.telegram.setWebhook(`https://${WEBHOOK_DOMAIN}/webhook`);
    console.log(`Webhook set to: https://${WEBHOOK_DOMAIN}/webhook`);
  } else {
    // Development: используем polling
    await bot.launch();
    console.log('Bot started with polling (development mode)');
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

startBot().catch(console.error);

export default bot;
