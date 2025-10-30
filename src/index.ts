import { Telegraf, Context, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { formatCardNumber, logWithTimestamp, delay } from './utils';
import { MESSAGES, BUTTON_LABELS, VIDEO_CAPTIONS, TIMING } from './constants';
import { validateReceiptWithGemini } from './receiptValidator';

dotenv.config();

// Интерфейсы
interface UserState {
  step: 'start' | 'video1' | 'video2' | 'video3' | 'payment_info' | 'waiting_receipt';
  userId: number;
  username?: string;
  currency?: 'RUB' | 'UAH';
}

// Хранилище состояний пользователей (в продакшене использовать БД)
const userStates = new Map<number, UserState>();

// Конфигурация
const config = {
  botToken: process.env.BOT_TOKEN!,
  channelId: process.env.CHANNEL_ID!,
  channelInviteLink: process.env.CHANNEL_INVITE_LINK!,
  chatId: process.env.CHAT_ID!, // ID чата для общения покупателей
  paymentAmount: parseInt(process.env.PAYMENT_AMOUNT || '2000'),
  cardNumber: process.env.CARD_NUMBER!,
  paymentAmountUAH: parseInt(process.env.PAYMENT_AMOUNT_UAH || '1050'),
  cardNumberUAH: process.env.CARD_NUMBER_UAH || '5169155124283993',
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
    step: 'payment_info',
    userId,
    username
  });

  await ctx.reply(
    '👋 Добро пожаловать!\n\n' +
    '💎 Для получения доступа к закрытому каналу с эксклюзивным контентом, ' +
    'нажмите кнопку ниже.',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💵 Оплатить рублями (2000 ₽)', callback_data: 'pay_rub' }],
          [{ text: '💴 Оплатить гривнами (1050 ₴)', callback_data: 'pay_uah' }]
        ]
      }
    }
  );
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
          [{ text: '💵 Оплатить рублями (2000 ₽)', callback_data: 'pay_rub' }],
          [{ text: '💴 Оплатить гривнами (1050 ₴)', callback_data: 'pay_uah' }]
        ]
      }
    }
  );
}

// Обработка нажатия кнопки "Оплатить рублями"
bot.action('pay_rub', async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId);

  if (!state) {
    await ctx.answerCbQuery('Пожалуйста, начните с команды /start');
    return;
  }

  await ctx.answerCbQuery();

  state.step = 'waiting_receipt';
  state.currency = 'RUB';
  userStates.set(userId, state);

  // Форматируем номер карты для отображения
  const formattedCard = config.cardNumber.replace(/(\d{4})(?=\d)/g, '$1 ');

          await ctx.reply(
    '💳 **Реквизиты для оплаты:**\n\n' +
    `💰 Сумма: **${config.paymentAmount} ₽**\n` +
    `🏦 Карта: \`${formattedCard}\`\n` +
    '👤 Получатель: **Vitalii Smirnov**\n\n' +
    '─────────────────────\n\n' +
    '📱 **Как оплатить:**\n\n' +
    '**Рекомендуем Т-банк или Сбербанк** — в них есть мгновенный перевод на иностранные карты.\n\n' +
    '**Инструкция:**\n' +
    '1️⃣ Найдите раздел переводов (в Т-банке: "Перевод по номеру карты", в Сбербанке: "Иностранные переводы")\n' +
    '2️⃣ Введите номер карты и сумму\n' +
    '3️⃣ Укажите имя получателя\n' +
    '4️⃣ Подтвердите перевод\n\n' +
    '💡 Другие банки: проверьте наличие функции "перевод на иностранную карту"\n\n' +
    '─────────────────────\n\n' +
    '📸 **После оплаты:**\n\n' +
    '✅ Сделайте скриншот квитанции\n' +
    '✅ Отправьте скриншот в этот чат\n\n' +
    '⚠️ **На скриншоте должно быть видно:**\n' +
    `• Сумму перевода (${config.paymentAmount} ₽)\n` +
    '• Номер карты получателя\n' +
    '• Имя получателя',
    { parse_mode: 'Markdown' }
  );

  // Добавляем кнопку для связи с ассистентом
  await ctx.reply(
    '💬 Если у вас возникли вопросы или трудности с оплатой:',
    Markup.inlineKeyboard([
      [Markup.button.url('📨 Связаться с ассистентом', 'https://t.me/ADA_gii')]
    ])
  );
});

// Обработка нажатия кнопки "Оплатить гривнами"
bot.action('pay_uah', async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username;
  const state: UserState = userStates.get(userId) || { 
    step: 'start',
    userId,
    username
  };

  await ctx.answerCbQuery();

  state.step = 'waiting_receipt';
  state.currency = 'UAH';
  userStates.set(userId, state);

  // Форматируем номер карты для отображения
  const formattedCard = config.cardNumberUAH.replace(/(\d{4})(?=\d)/g, '$1 ');

  await ctx.reply(
    '💳 **Реквизиты для оплаты:**\n\n' +
    `💰 Сумма: **${config.paymentAmountUAH} ₴**\n` +
    `🏦 Карта: \`${formattedCard}\`\n` +
    '👤 Получатель: **Микитась Юлія Олександрівна**\n\n' +
    '📋 **Инструкция:**\n' +
    '1. Переведите указанную сумму на карту\n' +
    '2. Сделайте скриншот или сохраните платежную квитанцию\n' +
    '3. Отправьте квитанцию в этот чат\n\n' +
    '⚠️ **Важно:** На квитанции должна быть видна сумма перевода и номер карты получателя!\n\n' +
    '👇 После оплаты отправьте квитанцию сюда',
    { parse_mode: 'Markdown' }
  );

  // Добавляем кнопку для связи с ассистентом
  await ctx.reply(
    '💬 Если у вас возникли вопросы или трудности с оплатой:',
    Markup.inlineKeyboard([
      [Markup.button.url('📨 Связаться с ассистентом', 'https://t.me/ADA_gii')]
    ])
  );
});

// Обработка получения квитанции (фото)
bot.on(message('photo'), async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId);

  console.log(`Photo received from user ${userId}, current state:`, state);

  if (!state || state.step !== 'waiting_receipt') {
    await ctx.reply('Пожалуйста, сначала нажмите кнопку "Оплатить доступ" и получите реквизиты.');
    return;
  }

  await ctx.reply('🔍 Проверяю вашу квитанцию...');

  // Здесь должна быть логика проверки квитанции через OCR или другой метод
  // Для упрощения, делаем базовую проверку
  const isValid = await validateReceipt(ctx);

  if (isValid) {
    await ctx.reply('✅ Квитанция принята! Генерирую ваши персональные ссылки...');
    
    try {
      const channelInviteLink = await generateInviteLink(userId);
      const chatInviteLink = await generateChatInviteLink(userId);
      
      await ctx.reply(
        '🎉 **Поздравляем!**\n\n' +
        `📺 **Доступ к каналу с материалами:**\n${channelInviteLink}\n\n` +
        `💬 **Доступ к чату с сообществом:**\n${chatInviteLink}\n\n` +
        '⏰ Ссылки действительны 24 часа\n' +
        '👤 Каждая ссылка может быть использована только один раз\n\n' +
        'Добро пожаловать в наше сообщество! 🚀',
        { parse_mode: 'Markdown' }
      );

      // Сбрасываем состояние
      userStates.delete(userId);

    } catch (error) {
      console.error('Error generating invite links:', error);
      await ctx.reply('❌ Произошла ошибка при генерации ссылок. Пожалуйста, обратитесь в поддержку.');
    }
  } else {
    await ctx.reply(
      '❌ К сожалению, квитанция не прошла автоматическую проверку.\n\n' +
      'Пожалуйста, убедитесь что:\n' +
      `✓ Сумма перевода: ${config.paymentAmount} рублей\n` +
      `✓ Номер карты получателя: ${config.cardNumber}\n` +
      '✓ На квитанции четко видны все данные\n\n' +
      'Вы можете:\n' +
      '• Попробовать отправить квитанцию снова\n' +
      '• Или отправить квитанцию ассистенту для ручной проверки',
      Markup.inlineKeyboard([
        [Markup.button.url('📨 Написать ассистенту', 'https://t.me/ADA_gii')]
      ])
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
      userId: ctx.from?.id, 
      fileId 
    });

    // Получаем данные пользователя для проверки валюты
    const userId = ctx.from?.id;
    const userState = userId ? userStates.get(userId) : undefined;
    const currency = userState?.currency || 'RUB';
    
    // Выбираем параметры в зависимости от валюты
    const paymentAmount = currency === 'UAH' ? config.paymentAmountUAH : config.paymentAmount;
    const cardNumber = currency === 'UAH' ? config.cardNumberUAH : config.cardNumber;
    
    logWithTimestamp('Validating receipt', { currency, paymentAmount, cardNumber });
    
    // Проверяем квитанцию через Gemini
    const validationResult = await validateReceiptWithGemini(
      photoUrl,
      paymentAmount,
      cardNumber,
      currency
    );

    logWithTimestamp('Validation result', validationResult);

    // Если проверка не прошла, отправляем причину пользователю
    if (!validationResult.isValid && validationResult.reason) {
      // Экранируем специальные символы Markdown
      const escapedReason = validationResult.reason
        .replace(/[_*\[\]()~`>#+=|{}.!-]/g, '\\$&');
      
      await ctx.reply(
        `${escapedReason}\n\n` +
        'Вы можете:\n' +
        '• Попробовать отправить другую квитанцию\n' +
        '• Или отправить квитанцию ассистенту для ручной проверки',
        Markup.inlineKeyboard([
          [Markup.button.url('📨 Написать ассистенту', 'https://t.me/ADA_gii')]
        ])
      );
    }

    return validationResult.isValid;
    
  } catch (error) {
    logWithTimestamp('Error in validateReceipt', error);
    
    // Возвращаем false при ошибке - не используем fallback
    await ctx.reply(
      '❌ Произошла ошибка при проверке квитанции.\n\n' +
      'Пожалуйста, попробуйте отправить фото еще раз или обратитесь в поддержку.'
    );
    
    return false;
  }
}

// Генерация invite-ссылки для канала
async function generateInviteLink(userId: number): Promise<string> {
  try {
    logWithTimestamp('Creating invite link', { userId, channelId: config.channelId });
    
    // Проверяем, что бот является администратором канала
    try {
      const chatMember = await bot.telegram.getChatMember(config.channelId, bot.botInfo!.id);
      logWithTimestamp('Bot status in channel', { status: chatMember.status });
      
      if (chatMember.status !== 'administrator' && chatMember.status !== 'creator') {
        throw new Error('Bot is not an administrator in the channel');
      }
    } catch (checkError) {
      logWithTimestamp('Error checking bot status', checkError);
      throw new Error('Bot is not added to the channel or lacks permissions. Please add bot as admin to the channel.');
    }
    
    // Создаем уникальную invite-ссылку
    const inviteLink = await bot.telegram.createChatInviteLink(config.channelId, {
      member_limit: 1, // Только для одного пользователя
      expire_date: Math.floor(Date.now() / 1000) + 86400 // 24 часа
    });

    logWithTimestamp('Generated invite link', { userId, link: inviteLink.invite_link });
    
    return inviteLink.invite_link;
  } catch (error) {
    logWithTimestamp('Error generating invite link', error);
    throw error;
  }
}

// Генерация invite-ссылки для чата
async function generateChatInviteLink(userId: number): Promise<string> {
  try {
    logWithTimestamp('Creating chat invite link', { userId, chatId: config.chatId });
    
    // Проверяем, что бот является администратором чата
    try {
      const chatMember = await bot.telegram.getChatMember(config.chatId, bot.botInfo!.id);
      logWithTimestamp('Bot status in chat', { status: chatMember.status });
      
      if (chatMember.status !== 'administrator' && chatMember.status !== 'creator') {
        throw new Error('Bot is not an administrator in the chat');
      }
    } catch (checkError) {
      logWithTimestamp('Error checking bot status in chat', checkError);
      throw new Error('Bot is not added to the chat or lacks permissions. Please add bot as admin to the chat.');
    }
    
    // Создаем уникальную invite-ссылку для чата
    const inviteLink = await bot.telegram.createChatInviteLink(config.chatId, {
      member_limit: 1, // Только для одного пользователя
      expire_date: Math.floor(Date.now() / 1000) + 86400 // 24 часа
    });

    logWithTimestamp('Generated chat invite link', { userId, link: inviteLink.invite_link });
    
    return inviteLink.invite_link;
  } catch (error) {
    logWithTimestamp('Error generating chat invite link', error);
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
