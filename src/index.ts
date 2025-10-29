import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { Input } from 'telegraf/typings/core/types/typegram';
import { formatCardNumber, logWithTimestamp, delay } from './utils';
import { MESSAGES, BUTTON_LABELS, VIDEO_CAPTIONS, TIMING } from './constants';
import { validateReceiptWithGemini, validateReceiptSimple } from './receiptValidator';

dotenv.config();

// Интерфейсы
interface UserState {
  step: 'start' | 'video1' | 'video2' | 'video3' | 'payment_info' | 'waiting_receipt';
  userId: number;
  username?: string;
}

// Хранилище состояний пользователей (в продакшене использовать БД)
const userStates = new Map<number, UserState>();

// Конфигурация
const config = {
  botToken: process.env.BOT_TOKEN!,
  channelId: process.env.CHANNEL_ID!,
  channelInviteLink: process.env.CHANNEL_INVITE_LINK!,
  paymentAmount: parseInt(process.env.PAYMENT_AMOUNT || '2000'),
  cardNumber: process.env.CARD_NUMBER!,
  videos: [
    process.env.VIDEO_URL_1!,
    process.env.VIDEO_URL_2!,
    process.env.VIDEO_URL_3!
  ]
};

// Инициализация бота
const bot = new Telegraf(config.botToken);

// Команда /start
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username;

  console.log(`User ${userId} (${username}) started the bot`);

  // Инициализируем состояние пользователя
  userStates.set(userId, {
    step: 'start',
    userId,
    username
  });

  await ctx.reply(
    '👋 Добро пожаловать!\n\n' +
    'Сейчас я покажу вам несколько интересных видео о нашем продукте.\n\n' +
    '📹 Приготовьтесь к просмотру!'
  );

  // Отправляем первое видео
  await sendVideo(ctx, 0);
});

// Функция отправки видео
async function sendVideo(ctx: Context, videoIndex: number) {
  const userId = ctx.from!.id;
  const state = userStates.get(userId);

  if (!state) return;

  try {
    const videoPath = config.videos[videoIndex];
    
    logWithTimestamp(`Sending video ${videoIndex + 1}`, { userId, videoPath });
    
    // Проверяем это локальный файл или URL
    if (videoPath.startsWith('http://') || videoPath.startsWith('https://')) {
      // Отправляем по URL
      await ctx.replyWithVideo(videoPath, {
        caption: `📹 Видео ${videoIndex + 1} из 3`
      });
    } else if (videoPath.startsWith('./') || videoPath.startsWith('/')) {
      // Отправляем локальный файл
      const { createReadStream } = await import('fs');
      const { Input } = await import('telegraf');
      
      await ctx.replyWithVideo(Input.fromLocalFile(videoPath), {
        caption: `📹 Видео ${videoIndex + 1} из 3`
      });
    } else {
      // Это file_id или другой формат
      await ctx.replyWithVideo(videoPath, {
        caption: `📹 Видео ${videoIndex + 1} из 3`
      });
    }

    // Обновляем состояние
    if (videoIndex === 0) {
      state.step = 'video1';
    } else if (videoIndex === 1) {
      state.step = 'video2';
    } else if (videoIndex === 2) {
      state.step = 'video3';
    }

    userStates.set(userId, state);

    // Ждем немного перед следующим видео
    setTimeout(async () => {
      if (videoIndex < 2) {
        await sendVideo(ctx, videoIndex + 1);
      } else {
        // Все видео отправлены, показываем кнопку оплаты
        await showPaymentButton(ctx);
      }
    }, 3000); // 3 секунды между видео

  } catch (error) {
    console.error(`Error sending video ${videoIndex + 1}:`, error);
    await ctx.reply(`Извините, произошла ошибка при отправке видео. Попробуйте снова позже.`);
  }
}

// Показать кнопку оплаты
async function showPaymentButton(ctx: Context) {
  const userId = ctx.from!.id;
  const state = userStates.get(userId);

  if (!state) return;

  state.step = 'payment_info';
  userStates.set(userId, state);

  await ctx.reply(
    '✅ Вы посмотрели все видео!\n\n' +
    '💎 Чтобы получить доступ к закрытому каналу с эксклюзивным контентом, ' +
    'нажмите кнопку ниже.',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Оплатить доступ', callback_data: 'pay' }]
        ]
      }
    }
  );
}

// Обработка кнопки оплаты
bot.action('pay', async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId);

  if (!state) {
    await ctx.answerCbQuery('Пожалуйста, начните с команды /start');
    return;
  }

  await ctx.answerCbQuery();

  state.step = 'waiting_receipt';
  userStates.set(userId, state);

  // Форматируем номер карты для отображения
  const formattedCard = config.cardNumber.replace(/(\d{4})(?=\d)/g, '$1 ');

  await ctx.reply(
    '💳 **Реквизиты для оплаты:**\n\n' +
    `💰 Сумма: **${config.paymentAmount} рублей**\n` +
    `🏦 Номер карты: \`${formattedCard}\`\n\n` +
    '📋 **Инструкция:**\n' +
    '1. Переведите указанную сумму на карту\n' +
    '2. Сделайте скриншот или сохраните платежную квитанцию\n' +
    '3. Отправьте квитанцию в этот чат\n\n' +
    '⚠️ **Важно:** На квитанции должна быть видна сумма перевода и номер карты получателя!\n\n' +
    '👇 После оплаты отправьте квитанцию сюда',
    { parse_mode: 'Markdown' }
  );
});

// Обработка получения квитанции (фото)
bot.on(message('photo'), async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId);

  if (!state || state.step !== 'waiting_receipt') {
    await ctx.reply('Пожалуйста, сначала начните процесс с команды /start');
    return;
  }

  await ctx.reply('🔍 Проверяю вашу квитанцию...');

  // Здесь должна быть логика проверки квитанции через OCR или другой метод
  // Для упрощения, делаем базовую проверку
  const isValid = await validateReceipt(ctx);

  if (isValid) {
    await ctx.reply('✅ Квитанция принята! Генерирую вашу персональную ссылку...');
    
    try {
      const inviteLink = await generateInviteLink(userId);
      
      await ctx.reply(
        '🎉 **Поздравляем!**\n\n' +
        `Ваша персональная ссылка для доступа в канал:\n${inviteLink}\n\n` +
        '⏰ Ссылка действительна 24 часа\n' +
        '👤 Может быть использована только один раз\n\n' +
        'Добро пожаловать в наше сообщество! 🚀',
        { parse_mode: 'Markdown' }
      );

      // Сбрасываем состояние
      userStates.delete(userId);

    } catch (error) {
      console.error('Error generating invite link:', error);
      await ctx.reply('❌ Произошла ошибка при генерации ссылки. Пожалуйста, обратитесь в поддержку.');
    }
  } else {
    await ctx.reply(
      '❌ К сожалению, квитанция не прошла проверку.\n\n' +
      'Пожалуйста, убедитесь что:\n' +
      `✓ Сумма перевода: ${config.paymentAmount} рублей\n` +
      `✓ Номер карты получателя: ${config.cardNumber}\n` +
      '✓ На квитанции четко видны все данные\n\n' +
      'Попробуйте отправить квитанцию снова.'
    );
  }
});

// Функция проверки квитанции
async function validateReceipt(ctx: Context): Promise<boolean> {
  try {
    const photo = ctx.message && 'photo' in ctx.message ? ctx.message.photo : null;
    
    if (!photo || photo.length === 0) {
      return false;
    }

    // Получаем файл с максимальным разрешением
    const fileId = photo[photo.length - 1].file_id;
    const file = await bot.telegram.getFile(fileId);
    
    if (!file.file_path) {
      logWithTimestamp('No file path available for photo');
      return false;
    }

    // Формируем URL для скачивания фото
    const photoUrl = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;
    
    logWithTimestamp('Validating receipt with Gemini', { 
      userId: ctx.from.id, 
      fileId 
    });

    // Проверяем квитанцию через Gemini
    const validationResult = await validateReceiptWithGemini(
      photoUrl,
      config.paymentAmount,
      config.cardNumber
    );

    logWithTimestamp('Validation result', validationResult);

    // Если проверка не прошла, отправляем причину пользователю
    if (!validationResult.isValid && validationResult.reason) {
      await ctx.reply(
        `❌ ${validationResult.reason}\n\n` +
        'Пожалуйста, отправьте корректную квитанцию.',
        { parse_mode: 'Markdown' }
      );
    }

    return validationResult.isValid;
    
  } catch (error) {
    logWithTimestamp('Error in validateReceipt', error);
    
    // В случае ошибки используем упрощенную проверку
    try {
      const photo = ctx.message && 'photo' in ctx.message ? ctx.message.photo : null;
      if (!photo || photo.length === 0) return false;
      
      const fileId = photo[photo.length - 1].file_id;
      const file = await bot.telegram.getFile(fileId);
      
      if (!file.file_path) return false;
      
      const photoUrl = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;
      
      const fallbackResult = await validateReceiptSimple(
        photoUrl,
        config.paymentAmount,
        config.cardNumber
      );
      
      if (fallbackResult.reason) {
        await ctx.reply(`⚠️ ${fallbackResult.reason}`);
      }
      
      return fallbackResult.isValid;
    } catch (fallbackError) {
      logWithTimestamp('Fallback validation also failed', fallbackError);
      return false;
    }
  }
}

// Генерация invite-ссылки
async function generateInviteLink(userId: number): Promise<string> {
  try {
    // Создаем уникальную invite-ссылку
    const inviteLink = await bot.telegram.createChatInviteLink(config.channelId, {
      member_limit: 1, // Только для одного пользователя
      expire_date: Math.floor(Date.now() / 1000) + 86400 // 24 часа
    });

    console.log(`Generated invite link for user ${userId}: ${inviteLink.invite_link}`);
    
    return inviteLink.invite_link;
  } catch (error) {
    console.error('Error creating invite link:', error);
    throw error;
  }
}

// Обработка текстовых сообщений
bot.on(message('text'), async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId);

  if (!state) {
    await ctx.reply(
      'Привет! 👋\n\n' +
      'Отправьте команду /start чтобы начать.'
    );
    return;
  }

  if (state.step === 'waiting_receipt') {
    await ctx.reply(
      '📸 Пожалуйста, отправьте фото или скриншот платежной квитанции.\n\n' +
      'Текстовые сообщения не принимаются.'
    );
  }
});

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  ctx.reply('Произошла ошибка. Попробуйте снова позже или обратитесь в поддержку.');
});

// Запуск бота
const PORT = process.env.PORT || 3000;

bot.launch({
  webhook: process.env.NODE_ENV === 'production' ? {
    domain: process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost',
    port: Number(PORT)
  } : undefined
}).then(() => {
  console.log('Bot is running...');
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Port: ${PORT}`);
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export default bot;
