import { Telegraf, Context, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { formatCardNumber, logWithTimestamp, delay } from './utils';
import { MESSAGES, BUTTON_LABELS, VIDEO_CAPTIONS, TIMING } from './constants';
import { validateReceiptWithGemini, ReceiptValidationResult } from './receiptValidator';
import { initializeDatabase } from './database';
import { UserService } from './userService';
import { trackUserAction, updateUserStep, setUserCurrency, markUserAsPaid } from './dbHelpers';

dotenv.config();

// Интерфейсы
interface UserState {
  step: 'start' | 'want_button' | 'video1' | 'continue_button' | 'video2' | 'ready_button' | 'video3' | 'advantage_button' | 'payment_choice' | 'waiting_receipt';
  userId: number;
  username?: string;
  currency?: 'RUB' | 'UAH';
}

// Хранилище состояний пользователей (Map для быстрого доступа + БД для persistence)
const userStates = new Map<number, UserState>();

// Инициализация UserService (будет создан после подключения БД)
let userService: UserService;

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
  ],
  videoFileIds: [
    process.env.VIDEO_1_FILE_ID,
    process.env.VIDEO_2_FILE_ID,
    process.env.VIDEO_3_FILE_ID
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

  // Сохраняем в БД
  await trackUserAction(userService, ctx, 'start', 'start');
  await updateUserStep(userService, userId, 'start');

  await ctx.reply(
    'Привет! Сейчас я расскажу тебе как я научилась снимать рилс которые приводят мне по 100 новых подписчиков и по 9 звонков с запросом на мои услуги каждый день. Ко мне обращаются топы и комментируют миллионники. Хочешь узнать подойдет ли мой метод тебе тоже?',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '� Хочу!', callback_data: 'want_more' }]
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

  state.step = 'payment_choice';
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

// ═══════════════════════════════════════════════════════════════
// ВОРОНКА: Обработчики кнопок
// ═══════════════════════════════════════════════════════════════

// Кнопка "Хочу!"
bot.action('want_more', async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId);

  if (!state) {
    await ctx.answerCbQuery('Пожалуйста, начните с команды /start');
    return;
  }

  await ctx.answerCbQuery();
  
  state.step = 'video1';
  userStates.set(userId, state);

  // Сохраняем в БД
  await trackUserAction(userService, ctx, 'click_want_more', 'video1');
  await updateUserStep(userService, userId, 'video1');

  await ctx.reply(
    'Отлично, тогда обязательно посмотри это короткое видео прямо сейчас - и если хотя бы один раз узнаешь себя, значит ты все делаешь правильно и вот-вот твоя жизнь поделится на "До" и "После"!'
  );

  // Отправляем первое видео через File ID
  const videoFileId = config.videoFileIds[0];
  
  if (videoFileId) {
    await ctx.replyWithDocument(videoFileId, {
      caption: '📹 Видео 1 из 3'
    });
  } else {
    await ctx.reply('⚠️ Видео временно недоступно. Пожалуйста, свяжитесь с поддержкой.');
  }

  await ctx.reply(
    'Посмотрели видео?',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '▶️ Смотреть дальше', callback_data: 'continue_watching' }]
        ]
      }
    }
  );
});

// Кнопка "Смотреть дальше"
bot.action('continue_watching', async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId);

  if (!state) {
    await ctx.answerCbQuery('Пожалуйста, начните с команды /start');
    return;
  }

  await ctx.answerCbQuery();
  
  state.step = 'video2';
  userStates.set(userId, state);

  await ctx.reply(
    'А теперь приготовься узнать почему у меня получилось, когда у других - нет, и почему у тебя получится тоже! Посмотри это короткое видео и как будешь готов, нажми кнопку ниже.'
  );

  // Отправляем второе видео через File ID
  const videoFileId = config.videoFileIds[1];
  
  if (videoFileId) {
    await ctx.replyWithDocument(videoFileId, {
      caption: '📹 Видео 2 из 3'
    });
  } else {
    await ctx.reply('⚠️ Видео временно недоступно. Пожалуйста, свяжитесь с поддержкой.');
  }

  await ctx.reply(
    'Готовы двигаться дальше?',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Готов!', callback_data: 'ready_for_more' }]
        ]
      }
    }
  );
});

// Кнопка "Готов!"
bot.action('ready_for_more', async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId);

  if (!state) {
    await ctx.answerCbQuery('Пожалуйста, начните с команды /start');
    return;
  }

  await ctx.answerCbQuery();
  
  state.step = 'video3';
  userStates.set(userId, state);

  await ctx.reply(
    'Отлично, последний рывок перед сотнями заявок с рилс! В этом видео ты узнаешь про конкретный алгоритм работы который принес мне успех, и какое нечестное преимущество я тебе дам. Смотри скорее!'
  );

  // Отправляем третье видео через File ID
  const videoFileId = config.videoFileIds[2];
  
  if (videoFileId) {
    await ctx.replyWithDocument(videoFileId, {
      caption: '📹 Видео 3 из 3'
    });
  } else {
    await ctx.reply('⚠️ Видео временно недоступно. Пожалуйста, свяжитесь с поддержкой.');
  }

  await ctx.reply(
    'Готовы забрать свое преимущество?',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎁 Забрать преимущество!', callback_data: 'get_advantage' }]
        ]
      }
    }
  );
});

// Кнопка "Забрать преимущество!"
bot.action('get_advantage', async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId);

  if (!state) {
    await ctx.answerCbQuery('Пожалуйста, начните с команды /start');
    return;
  }

  await ctx.answerCbQuery();
  
  state.step = 'payment_choice';
  userStates.set(userId, state);

  await ctx.reply(
    '💎 Для получения доступа к закрытому каналу с эксклюзивным контентом, нажмите кнопку ниже.',
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

// ═══════════════════════════════════════════════════════════════
// ОПЛАТА: Обработчики выбора валюты
// ═══════════════════════════════════════════════════════════════

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

  // Сохраняем в БД
  await trackUserAction(userService, ctx, 'choose_rub', 'waiting_receipt');
  await updateUserStep(userService, userId, 'waiting_receipt');
  await setUserCurrency(userService, userId, 'RUB');

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

  // Сохраняем в БД
  await trackUserAction(userService, ctx, 'choose_uah', 'waiting_receipt');
  await updateUserStep(userService, userId, 'waiting_receipt');
  await setUserCurrency(userService, userId, 'UAH');

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

  // Проверяем квитанцию через Gemini AI
  const validationResult = await validateReceipt(ctx);

  if (!validationResult) {
    await ctx.reply('❌ Произошла ошибка при проверке квитанции. Попробуйте еще раз.');
    return;
  }

  if (validationResult.isValid) {
    await ctx.reply('✅ Квитанция принята! Генерирую ваши персональные ссылки...');
    
    try {
      const channelInviteLink = await generateInviteLink(userId);
      const chatInviteLink = await generateChatInviteLink(userId);
      
      // Отмечаем как оплатившего в БД
      await markUserAsPaid(userService, userId);
      await trackUserAction(userService, ctx, 'payment_success', 'completed');
      
      await ctx.reply(
        '🎉 Поздравляем!\n\n' +
        `📺 Доступ к каналу с материалами:\n${channelInviteLink}\n\n` +
        `💬 Доступ к чату с сообществом:\n${chatInviteLink}\n\n` +
        '⏰ Ссылки действительны 24 часа\n' +
        '👤 Каждая ссылка может быть использована только один раз\n\n' +
        'Добро пожаловать в наше сообщество! 🚀'
      );

      // Сбрасываем состояние
      userStates.delete(userId);

    } catch (error) {
      console.error('Error generating invite links:', error);
      await ctx.reply('❌ Произошла ошибка при генерации ссылок. Пожалуйста, обратитесь в поддержку.');
    }
  } else {
    // ЕДИНСТВЕННОЕ консолидированное сообщение при отказе
    const imageDesc = validationResult.imageDescription || 'Изображение квитанции';
    const reason = validationResult.reason || 'Квитанция не прошла проверку';
    
    // Определяем валюту и сумму для инструкций
    const userState = userStates.get(userId);
    const currency = userState?.currency || 'RUB';
    const expectedAmount = currency === 'UAH' ? config.paymentAmountUAH : config.paymentAmount;
    const expectedCard = currency === 'UAH' ? config.cardNumberUAH : config.cardNumber;
    const currencySymbol = currency === 'UAH' ? '₴' : '₽';
    
    await ctx.reply(
      `🔍 **Что я вижу на фото:**\n${imageDesc}\n\n` +
      `❌ **Почему не подошло:**\n${reason}\n\n` +
      `📋 **Как исправить:**\n` +
      `• Убедитесь что сумма ${expectedAmount} ${currencySymbol}\n` +
      `• Проверьте номер карты получателя (*${expectedCard.slice(-4)})\n` +
      `• Сделайте четкое фото квитанции\n` +
      `• Отправьте квитанцию снова`,
      Markup.inlineKeyboard([
        [Markup.button.url('📨 Написать ассистенту', 'https://t.me/ADA_gii')]
      ])
    );
  }
});

// Функция проверки квитанции
async function validateReceipt(ctx: Context): Promise<ReceiptValidationResult | null> {
  try {
    const photo = ctx.message && 'photo' in ctx.message ? ctx.message.photo : null;
    
    if (!photo || photo.length === 0) {
      return null;
    }

    // Получаем файл с максимальным разрешением
    const fileId = photo[photo.length - 1].file_id;
    const file = await bot.telegram.getFile(fileId);
    
    if (!file.file_path) {
      logWithTimestamp('No file path available for photo');
      return null;
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

    // Возвращаем полный результат валидации (сообщение отправим снаружи)
    return validationResult;
    
  } catch (error) {
    logWithTimestamp('Error in validateReceipt', error);
    
    // Возвращаем null при ошибке
    return null;
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

// Запуск бота с инициализацией БД
const PORT = process.env.PORT || 3000;

async function startBot() {
  try {
    // 1. Подключаемся к БД
    await initializeDatabase();
    console.log('✅ База данных инициализирована');

    // 2. Создаем UserService
    userService = new UserService();
    console.log('✅ UserService создан');

    // 3. Запускаем бота
    await bot.launch({
      webhook: process.env.NODE_ENV === 'production' ? {
        domain: process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost',
        port: Number(PORT)
      } : undefined
    });

    console.log('✅ Бот запущен успешно');
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Port: ${PORT}`);
  } catch (error) {
    console.error('❌ Ошибка запуска бота:', error);
    process.exit(1);
  }
}

// Запускаем бота
startBot();

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export default bot;
