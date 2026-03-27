import { Telegraf, Context, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { formatCardNumber, logWithTimestamp, delay } from './utils';
import { MESSAGES, BUTTON_LABELS, VIDEO_CAPTIONS, TIMING } from './constants';
import { statsCommand } from './commands/statsCommand';
import { broadcastCommand } from './commands/broadcastCommand';
import { validateReceiptWithGemini, ReceiptValidationResult } from './receiptValidator';
import { initializeDatabase, AppDataSource } from './database';
import { UserService } from './userService';
import { User } from './entities/User';
import { trackUserAction, updateUserStep, setUserCurrency, markUserAsPaid } from './dbHelpers';
import { StatsService } from './statsService';
import { ReminderService } from './reminderService';
import { ChannelSyncService } from './services/channelSyncService';
import { TributeWebhookService } from './tributeWebhook';
import { CourseChainService } from './services/courseChainService';

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

// Сервис цепочки курса (будет создан после инициализации бота)
let courseChainService: CourseChainService;

// Конфигурация
const config = {
  botToken: process.env.BOT_TOKEN!,
  channelId: process.env.CHANNEL_ID!,
  channelInviteLink: process.env.CHANNEL_INVITE_LINK!,
  chatId: process.env.CHAT_ID!, // ID чата для общения покупателей
  paymentAmount: parseInt(process.env.PAYMENT_AMOUNT || '4000'),
  cardNumber: process.env.CARD_NUMBER!,
  paymentAmountUAH: parseInt(process.env.PAYMENT_AMOUNT_UAH || '2100'),
  cardNumberUAH: process.env.CARD_NUMBER_UAH || '5169155124283993',
  tributeApiKey: process.env.TRIBUTE_API_KEY || '32fc5725-78c2-40aa-990d-dfebf6ec',
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

// Middleware: Игнорировать сообщения из групп и каналов
bot.use(async (ctx, next) => {
  // Проверяем тип чата
  const chatType = ctx.chat?.type;
  
  // Если это группа, супергруппа или канал - игнорируем
  if (chatType === 'group' || chatType === 'supergroup' || chatType === 'channel') {
    logWithTimestamp('🚫 Ignored message from group/channel', {
      chatType,
      chatId: ctx.chat?.id,
      messageType: ctx.message ? 'message' : ctx.callbackQuery ? 'callback' : 'unknown'
    });
    return; // Не вызываем next(), прерываем обработку
  }
  
  // Если это приватный чат (private) - продолжаем обработку
  return next();
});

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

  // File IDs изображений
  const imageFileIds = [
    'AgACAgIAAxkDAAIDJmkHFhIsqPMEsshtOCDVTIez7RyPAAKL9zEbKfU5SCLJ-k5Vz_DFAQADAgADeQADNgQ',
    'AgACAgIAAxkDAAIDJ2kHFhPEwRiHjjGpV_gYmDI_1btJAAKM9zEbKfU5SKpHP2ukwp9iAQADAgADeQADNgQ',
    'AgACAgIAAxkDAAIDKGkHFhRu1ME-YXMrlXMyydmWrGl1AAKN9zEbKfU5SJuPcNoG8Di2AQADAgADeQADNgQ',
    'AgACAgIAAxkDAAIDKWkHFhXdZL3l_d8BWa_iIqZU677FAAKO9zEbKfU5SHMDo9TvSvz4AQADAgADeQADNgQ',
    'AgACAgIAAxkDAAIDKmkHFhdMGoeiMtDKPMd_l8hh-hvTAAKP9zEbKfU5SBFloDZKfuT7AQADAgADeQADNgQ',
    'AgACAgIAAxkDAAIDK2kHFhgYD_wK9_ERk3Bo1tgLOu0uAAKQ9zEbKfU5SGBbaXWOlrnAAQADAgADeQADNgQ',
    'AgACAgIAAxkDAAIDLGkHFhpWJGLX-U5BimAQEXvzDJlWAAKR9zEbKfU5SF_EoRtiz2oCAQADAgADeQADNgQ'
  ];

  // Отправляем медиа группу (7 фото)
  await ctx.replyWithMediaGroup(
    imageFileIds.map((fileId) => ({
      type: 'photo',
      media: fileId
    }))
  );

  // Отправляем текст с кнопкой
  await ctx.reply(
    '👋 Привет!\n' +
    'Сейчас я покажу тебе, как я научилась снимать Reels, которые приводят сотни целевых подписчиков каждый день и генерируют по 9+ заявок на мои услуги. По своей системе я получаю клиентов-топов и внимание аккаунтов-миллионников.\n\n' +
    'И самое главное - ты сможешь понять, подойдёт ли мой метод именно тебе, и как адаптировать его под твою нишу и личность.\n\n' +
    'Готов(а) увидеть, за счёт чего мои Reels работают как магнит на аудиторию и клиентов - и как это повторить?',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '👇 Поехали!', callback_data: 'want_more' }]
        ]
      }
    }
  );
});

// Команда /stats для админа - новый компактный формат
bot.command('stats', statsCommand);

// Команда /broadcast для просмотра истории рассылок
bot.command('broadcast', broadcastCommand);

// Команда /warmup_broadcast для разовой рассылки догрева всем застрявшим
bot.command('warmup_broadcast', async (ctx) => {
  const userId = ctx.from.id;
  
  // Проверяем что это админ
  if (userId !== 278263484) {
    await ctx.reply('У вас нет доступа к этой команде.');
    return;
  }

  try {
    await ctx.reply('🔥 Начинаю разовую рассылку warmup для всех застрявших на start и video1...');
    
    const { WarmupService } = await import('./services/warmupService');
    const warmupService = new WarmupService(bot);
    const result = await warmupService.sendBroadcastToStuck();
    
    // Сохраняем результат в БД
    try {
      const { BroadcastHistory } = await import('./entities/BroadcastHistory');
      const broadcastRepo = AppDataSource.getRepository(BroadcastHistory);
      await broadcastRepo.save({
        broadcastType: 'warmup',
        segmentStart: 0, // TODO: вернуть детализацию из WarmupService
        segmentVideo1: 0,
        totalAttempted: result.total,
        totalSent: result.sent,
        totalFailed: result.failed,
        notes: 'Запущено через /warmup_broadcast'
      });
    } catch (dbError) {
      console.error('Ошибка сохранения рассылки в БД:', dbError);
      // Не останавливаем выполнение, просто логируем
    }
    
    const report = 
      '🔥 <b>РЕЗУЛЬТАТЫ WARMUP РАССЫЛКИ</b>\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      `👥 <b>Всего пользователей:</b> ${result.total}\n` +
      `✅ <b>Отправлено:</b> ${result.sent}\n` +
      `❌ <b>Ошибок:</b> ${result.failed}\n\n` +
      `📊 Теперь используй /stats чтобы отследить как они продвинутся по воронке!`;
    
    await ctx.reply(report, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('❌ Ошибка при warmup рассылке:', error);
    await ctx.reply('❌ Произошла ошибка при рассылке. Проверьте логи.');
  }
});

// Команда /sync_channel для синхронизации участников канала
bot.command('sync_channel', async (ctx) => {
  const userId = ctx.from.id;
  
  // Проверяем что это админ
  if (userId !== 278263484) {
    await ctx.reply('У вас нет доступа к этой команде.');
    return;
  }

  try {
    await ctx.reply('🔄 Начинаю синхронизацию участников канала...');
    
    const channelSyncService = new ChannelSyncService(bot);
    const result = await channelSyncService.syncChannelMembers(config.channelId);
    
    const report = channelSyncService.formatSyncReport(result);
    await ctx.reply(report, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('❌ Ошибка при синхронизации канала:', error);
    await ctx.reply('❌ Произошла ошибка при синхронизации канала. Проверьте логи.');
  }
});

// Команда ручной пометки пользователя как оплатившего (только для админов)
// Использование: /mark_paid @username или /mark_paid 123456789
bot.command('mark_paid', async (ctx) => {
  const userId = ctx.from.id;
  
  // Проверяем что это админ
  if (userId !== 278263484) {
    await ctx.reply('У вас нет доступа к этой команде.');
    return;
  }

  try {
    const args = ctx.message.text.split(' ').slice(1);
    
    if (args.length === 0) {
      await ctx.reply(
        '❌ Укажите username или userId пользователя.\n\n' +
        '📝 Примеры:\n' +
        '/mark_paid @Nadin_bagrova\n' +
        '/mark_paid 438820947'
      );
      return;
    }

    const identifier = args[0].replace('@', '');
    let targetUser;

    // Проверяем это userId или username
    if (/^\d+$/.test(identifier)) {
      // Это userId
      const targetUserId = parseInt(identifier);
      const userRepository = AppDataSource.getRepository(User);
      targetUser = await userRepository.findOne({ where: { userId: targetUserId } });
    } else {
      // Это username
      const userRepository = AppDataSource.getRepository(User);
      targetUser = await userRepository.findOne({ where: { username: identifier } });
    }

    if (!targetUser) {
      await ctx.reply(`❌ Пользователь "${identifier}" не найден в базе данных.`);
      return;
    }

    // Проверяем, уже оплачен или нет
    if (targetUser.hasPaid) {
      await ctx.reply(
        `ℹ️ Пользователь @${targetUser.username || targetUser.userId} уже помечен как оплативший.\n\n` +
        `📅 Дата оплаты: ${targetUser.paidAt?.toLocaleString('ru-RU') || 'не указана'}\n` +
        `📊 Статус: ${targetUser.currentStep}`
      );
      return;
    }

    // Помечаем как оплатившего
    await userService.markAsPaid(targetUser.userId);
    
    await ctx.reply(
      `✅ Пользователь @${targetUser.username || targetUser.userId} успешно помечен как оплативший!\n\n` +
      `👤 User ID: ${targetUser.userId}\n` +
      `📅 Дата: ${new Date().toLocaleString('ru-RU')}\n` +
      `📊 Новый статус: completed\n\n` +
      `💡 Теперь пользователь учитывается в статистике оплат.`
    );
    
    console.log(`✅ Admin ${userId} manually marked user ${targetUser.userId} (@${targetUser.username}) as paid`);
  } catch (error) {
    console.error('❌ Ошибка при пометке пользователя как оплатившего:', error);
    await ctx.reply('❌ Произошла ошибка при обработке команды. Проверьте логи.');
  }
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

  // Отмечаем время показа выбора оплаты
  await userService.markPaymentChoiceShown(userId);

  await ctx.reply(
    '✅ Вы посмотрели все видео!\n\n' +
    '💎 Чтобы получить доступ к закрытому каналу с эксклюзивным контентом, ' +
    'нажмите кнопку ниже.',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💵 Оплатить рублями (4000 ₽)', callback_data: 'pay_rub_tribute' }],
          [{ text: '💳 Иностранные карты (44€)', callback_data: 'pay_eur_tribute' }],
          [{ text: '💴 Оплатить гривнами (2100 ₴)', callback_data: 'pay_uah' }]
        ]
      }
    }
  );
}

/**
 * Отправка единого сообщения с отзывами и выбором способа оплаты
 * Используется во всех точках входа на этап payment_choice
 */
async function sendPaymentChoiceWithReviews(ctx: Context) {
  const userId = ctx.from!.id;
  
  // Путь к папке с изображениями отзывов
  const reviewImages = [
    'image_1_screen.jpeg',
    'Image_2_screen.jpeg',
    'image_8_screen.jpeg',
    'image_9_screen.jpeg',
    'image_4_screen.jpeg',
    'image_6_screen.jpeg',
    'image_7_screen.jpeg',
    'image_5_screen.jpeg',
    'image_10_screen.jpeg'
  ];

  try {
    // Отправляем медиагруппу с изображениями отзывов
    const mediaGroup = reviewImages.map((filename, index) => ({
      type: 'photo' as const,
      media: { source: fs.readFileSync(filename) },
      caption: index === 0 ? 'Отзывы участников:' : undefined
    }));

    await ctx.replyWithMediaGroup(mediaGroup);

    // Небольшая пауза для корректной доставки
    await delay(500);

    // Отправляем текст с кнопками выбора оплаты
    const messageText = `Отлично, давай к делу! На скринах отзывы о продукте.

💎 Вот что ты получаешь после оплаты:

🧬 Архетип + ЦА — твой уникальный стиль, продукт и люди, которым это нужно
💡 10 идей для Reels — готовые к съёмке под твою нишу
✍️ Апгрейд сценариев — механики удержания, которые любит алгоритм
🔥 30 хуков — зацепи за первые 3 секунды любого зрителя
⚡️ СТА + подписи — превращай просмотры в подписчиков и клиентов
📚 34 формата — "До/После", "Челлендж", "Разоблачение" с примерами
🚀 Воркбук 0→1000 за 30 дней — упакуешь профиль и протестируешь все промты
✅ Чек-лист — музыка, тайминг, длительность (ничего не забудешь)
💬 Закрытый чат — поддержка и опыт тех, кто уже растёт

**Результат:** ты снимаешь быстро, легко и по делу, попадаешь в свою аудиторию и получаешь заявки на свои услуги. 

⚡️ 130+ человек уже присоединились к нам, сняли свои первые ролики и рекомендуют продукт друзьям.

Выбери удобный способ оплаты и начни расти уже сегодня 👇`;

    await ctx.reply(messageText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '💵 Оплатить рублями (4000 ₽)', callback_data: 'pay_rub_tribute' }],
          [{ text: '💳 Иностранные карты (44€)', callback_data: 'pay_eur_tribute' }],
          [{ text: '💴 Оплатить гривнами (2100 ₴)', callback_data: 'pay_uah' }]
        ]
      }
    });

  } catch (error) {
    console.error('❌ Ошибка отправки сообщения с отзывами:', error);
    // Fallback: отправляем только текст с кнопками если изображения не загрузились
    await ctx.reply(
      'Отлично, давай к делу! Выбери удобный способ оплаты 👇',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💵 Оплатить рублями (4000 ₽)', callback_data: 'pay_rub_tribute' }],
            [{ text: '💳 Иностранные карты (44€)', callback_data: 'pay_eur_tribute' }],
            [{ text: '💴 Оплатить гривнами (2100 ₴)', callback_data: 'pay_uah' }]
          ]
        }
      }
    );
  }
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
  
  // Отмечаем время показа первого видео (для напоминания через 10 минут)
  await userService.markVideo1Shown(userId);

  await ctx.reply(
    'Отлично, тогда обязательно посмотри это короткое видео прямо сейчас - и если хотя бы один раз узнаешь себя, значит ты все делаешь правильно и вот-вот твой инстаграм разделится на "До" и "После"!'
  );

  // Отправляем первое видео через File ID
  const videoFileId = config.videoFileIds[0];
  
  if (videoFileId) {
    await ctx.replyWithVideo(videoFileId, {
      caption: '📹 Видео 1 из 3',
      supports_streaming: true,
      width: 1280,
      height: 720
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
  
  // Track button click
  await trackUserAction(userService, ctx, 'click_continue_watching', 'video2');
  
  state.step = 'video2';
  userStates.set(userId, state);
  
  // Сохраняем в БД
  await updateUserStep(userService, userId, 'video2');

  await ctx.reply(
    'А теперь приготовься узнать почему у меня получилось, когда другие топчутся на месте, и почему у тебя получится тоже! Посмотри это короткое видео и как будешь готов(а), нажми кнопку ниже.'
  );

  // Отправляем второе видео через File ID
  const videoFileId = config.videoFileIds[1];
  
  if (videoFileId) {
    await ctx.replyWithVideo(videoFileId, {
      caption: '📹 Видео 2 из 3',
      supports_streaming: true,
      width: 1280,
      height: 720
    });
  } else {
    await ctx.reply('⚠️ Видео временно недоступно. Пожалуйста, свяжитесь с поддержкой.');
  }

  await ctx.reply(
    'Готовы двигаться дальше?',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Готов(а)!', callback_data: 'ready_for_more' }]
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
  
  // Track button click
  await trackUserAction(userService, ctx, 'click_ready_for_more', 'video3');
  
  state.step = 'video3';
  userStates.set(userId, state);
  
  // Сохраняем в БД
  await updateUserStep(userService, userId, 'video3');

  await ctx.reply(
    'Отлично, последний рывок перед сотнями заявок с рилс! В этом видео ты узнаешь про конкретный алгоритм работы который принес мне успех, и какое нечестное преимущество я тебе дам. Смотри скорее!'
  );

  // Отправляем третье видео через File ID
  const videoFileId = config.videoFileIds[2];
  
  if (videoFileId) {
    await ctx.replyWithVideo(videoFileId, {
      caption: '📹 Видео 3 из 3',
      supports_streaming: true,
      width: 1280,
      height: 720
    });
  } else {
    await ctx.reply('⚠️ Видео временно недоступно. Пожалуйста, свяжитесь с поддержкой.');
  }

  await ctx.reply(
    'Готовы забрать свое преимущество?',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎁 Забрать преимущество!', callback_data: 'get_advantage' }],
          [{ text: '⏭️ Пропустить видео', callback_data: 'skip_video3' }]
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
  
  // Track button click
  await trackUserAction(userService, ctx, 'click_get_advantage', 'payment_choice');
  
  state.step = 'payment_choice';
  userStates.set(userId, state);

  // Отмечаем время показа выбора оплаты
  await userService.markPaymentChoiceShown(userId);

  // Отправляем единое сообщение с отзывами и кнопками оплаты
  await sendPaymentChoiceWithReviews(ctx);
});

// Кнопка "Пропустить видео"
bot.action('skip_video3', async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId);

  if (!state) {
    await ctx.answerCbQuery('Пожалуйста, начните с команды /start');
    return;
  }

  await ctx.answerCbQuery();
  
  // Track skip video3 action
  await trackUserAction(userService, ctx, 'skip_video3', 'payment_choice');
  
  // Mark user as skipped video3
  await userService.markVideo3Skipped(userId);
  
  state.step = 'payment_choice';
  userStates.set(userId, state);

  // Отмечаем время показа выбора оплаты
  await userService.markPaymentChoiceShown(userId);

  // Отправляем единое сообщение с отзывами и кнопками оплаты
  await sendPaymentChoiceWithReviews(ctx);
});

// ═══════════════════════════════════════════════════════════════
// ОПЛАТА: Обработчики выбора валюты
// ═══════════════════════════════════════════════════════════════

// Обработка кнопки "Хочу!" из напоминания video1
bot.action('video1_skip_to_payment', async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId) || { 
    step: 'video1',
    userId,
    username: ctx.from.username
  };

  await ctx.answerCbQuery();

  // Track skip to payment from video1
  await trackUserAction(userService, ctx, 'video1_skip_to_payment', 'payment_choice');
  
  state.step = 'payment_choice';
  userStates.set(userId, state);

  // Обновляем шаг и отмечаем время показа выбора оплаты
  await updateUserStep(userService, userId, 'payment_choice');
  await userService.markPaymentChoiceShown(userId);

  // Отправляем единое сообщение с отзывами и кнопками оплаты
  await sendPaymentChoiceWithReviews(ctx);
});

// Callback: video2_skip_to_payment - переход из video2 на payment_choice
bot.action('video2_skip_to_payment', async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId) || { 
    step: 'video2',
    userId,
    username: ctx.from.username
  };

  await ctx.answerCbQuery();

  // Track skip to payment from video2
  await trackUserAction(userService, ctx, 'video2_skip_to_payment', 'payment_choice');
  
  state.step = 'payment_choice';
  userStates.set(userId, state);

  // Обновляем шаг и отмечаем время показа выбора оплаты
  await updateUserStep(userService, userId, 'payment_choice');
  await userService.markPaymentChoiceShown(userId);

  // Отправляем единое сообщение с отзывами и кнопками оплаты
  await sendPaymentChoiceWithReviews(ctx);
});

// Callback: not_interested - аналитика (пользователь не заинтересован)
bot.action('not_interested', async (ctx) => {
  await ctx.answerCbQuery('Спасибо за обратную связь');
  
  // Track disinterest for analytics
  await trackUserAction(userService, ctx, 'not_interested', ctx.from.id.toString());
  
  await ctx.reply('Понял, спасибо что уделили время. Если передумаешь — я всегда на связи! 😊');
});

// Обработка кнопки Black Friday "Забрать доступ за $25"
bot.action('black_friday_payment', async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId) || { 
    step: 'start',
    userId,
    username: ctx.from.username
  };

  await ctx.answerCbQuery();

  // Track Black Friday button click
  await trackUserAction(userService, ctx, 'black_friday_click', 'payment_choice');
  
  state.step = 'payment_choice';
  userStates.set(userId, state);

  // Обновляем шаг и отмечаем время показа выбора оплаты
  await updateUserStep(userService, userId, 'payment_choice');
  await userService.markPaymentChoiceShown(userId);

  // Отправляем единое сообщение с отзывами и кнопками оплаты
  await sendPaymentChoiceWithReviews(ctx);
});

// ═══════════════════════════════════════════════════════════════
// ОПЛАТА ЧЕРЕЗ TELEGRAM TRIBUTE (с отслеживанием кликов)
// ═══════════════════════════════════════════════════════════════

// Обработка нажатия кнопки "Оплатить рублями" (Telegram Tribute)
bot.action('pay_rub_tribute', async (ctx) => {
  const userId = ctx.from.id;
  
  await ctx.answerCbQuery();
  
  // ✅ ОТСЛЕЖИВАНИЕ: Записываем клик в БД
  await trackUserAction(userService, ctx, 'choose_rub_tribute', 'payment_choice');
  
  // ✅ ОБНОВЛЯЕМ пользователя: переводим в waiting_receipt и сохраняем валюту
  await userService.updateUserStep(userId, 'waiting_receipt');
  await userService.setUserCurrency(userId, 'RUB');
  await userService.markWaitingForReceipt(userId);
  
  // Отправляем сообщение с URL-кнопкой Tribute
  await ctx.reply(
    '💵 Отлично! Нажмите на кнопку ниже и у вас откроется окно оплаты, где вы получите доступ в канал с платными материалами и наш чат автоматически.\n\n' +
    'Подойдет карта любого российского банка, даже кредитная. Если что-то не получается нажмите "Написать ассистенту" и вам ответят в течение часа.',
    Markup.inlineKeyboard([
      [Markup.button.url('💳 Оплатить 4000 ₽', 'https://t.me/tribute/app?startapp=sF8Z')],
      [Markup.button.url('📨 Написать ассистенту', 'https://t.me/vetalsmirnov')]
    ])
  );
  
  console.log(`✅ User ${userId} clicked RUB Tribute button - moved to waiting_receipt`);
});

// Обработка нажатия кнопки "Иностранные карты" (Telegram Tribute)
bot.action('pay_eur_tribute', async (ctx) => {
  const userId = ctx.from.id;
  
  await ctx.answerCbQuery();
  
  // ✅ ОТСЛЕЖИВАНИЕ: Записываем клик в БД
  await trackUserAction(userService, ctx, 'choose_eur_tribute', 'payment_choice');
  
  // ✅ ОБНОВЛЯЕМ пользователя: переводим в waiting_receipt и сохраняем валюту
  await userService.updateUserStep(userId, 'waiting_receipt');
  await userService.setUserCurrency(userId, 'EUR'); // EUR Tribute - отдельная валюта
  await userService.markWaitingForReceipt(userId);
  
  // Отправляем сообщение с URL-кнопкой Tribute
  await ctx.reply(
    '💳 Отлично! Нажмите на кнопку ниже и у вас откроется окно оплаты, где вы получите доступ в канал с платными материалами и наш чат автоматически.\n\n' +
    'Подойдет любая иностранная карта любой страны. Если что-то не получается нажмите "Написать ассистенту" и вам ответят в течение часа.',
    Markup.inlineKeyboard([
      [Markup.button.url('💳 Оплатить 44€', 'https://t.me/tribute/app?startapp=sFe6')],
      [Markup.button.url('📨 Написать ассистенту', 'https://t.me/vetalsmirnov')]
    ])
  );
  
  console.log(`✅ User ${userId} clicked EUR Tribute button - moved to waiting_receipt`);
});

// ═══════════════════════════════════════════════════════════════
// СТАРЫЙ обработчик "Оплатить рублями" - ЗАКОММЕНТИРОВАН
// Теперь используется прямая ссылка на Telegram Tribute
// ═══════════════════════════════════════════════════════════════
/*
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

  // Отмечаем время начала ожидания квитанции
  await userService.markWaitingForReceipt(userId);

  // Форматируем номер карты для отображения
  const formattedCard = config.cardNumber.replace(/(\d{4})(?=\d)/g, '$1 ');

  await ctx.reply(
    '💳 **Перевод по номеру карты:**\n\n' +
    `💰 Сумма: **${config.paymentAmount} ₽**\n` +
    `🏦 Карта: \`${formattedCard}\`\n` +
    '👤 Получатель: **Vitalii Smirnov**\n\n' +
    '─────────────────────\n\n' +
    '📱 **Как оплатить:**\n\n' +
    '**Рекомендуем Т-банк, Альфабанк или Сбербанк** — в них есть мгновенный перевод на иностранные карты. Убедитесь что у вас последняя версия приложения.\n\n' +
    '**Инструкция:**\n' +
    '1️⃣ Найдите раздел переводов (в Т-банке: "Перевод по номеру карты", в Сбербанке: "Иностранные переводы")\n' +
    '2️⃣ Введите номер карты и сумму\n' +
    '3️⃣ Укажите имя получателя\n' +
    '4️⃣ Убедитесь что "валюта зачисления" - **USD** и подтвердите перевод\n\n' +
    '💡 Другие банки: проверьте наличие функции "перевод на иностранную карту"\n\n' +
    '─────────────────────\n\n' +
    '📸 **После оплаты:**\n\n' +
    '✅ Сделайте скриншот квитанции\n' +
    '✅ Отправьте скриншот в этот чат\n\n' +
    '⚠️ **На скриншоте должно быть видно:**\n' +
    `• Сумму перевода (${config.paymentAmount} ₽)\n` +
    '• Номер карты получателя\n' +
    '• Имя получателя\n\n\n' +
    '💬 Если у вас возникли вопросы или трудности с оплатой:',
    Markup.inlineKeyboard([
      [Markup.button.url('📨 Написать ассистенту', 'https://t.me/vetalsmirnov')]
    ])
  );
});
*/

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
  
  // Отмечаем время начала ожидания квитанции (для аналитики)
  await userService.markWaitingForReceipt(userId);

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
      [Markup.button.url('📨 Связаться с ассистентом', 'https://t.me/vetalsmirnov')]
    ])
  );
});

// =====================================================================
// ОБРАБОТЧИКИ КНОПОК ЦЕПОЧКИ КУРСА "СНИМИТЕ ЭТО НЕМЕДЛЕННО!"
// =====================================================================

// Кнопка "Посмотреть программу" → переход к сообщению 2
bot.action('course_msg2_trigger', async (ctx) => {
  await ctx.answerCbQuery('Загружаю программу курса...');
  const userId = ctx.from.id;
  const firstName = ctx.from.first_name;
  logWithTimestamp('📚 Course: user clicked "Посмотреть программу"', { userId });
  
  // Отмечаем клик на сообщение 1 и отправляем сообщение 2
  if (courseChainService) {
    await courseChainService.handleButtonClick(userId, 1, firstName);
  }
});

// Кнопка "Занять место" → сообщение о брони с кнопкой оплаты
bot.action('course_reserve_spot', async (ctx) => {
  await ctx.answerCbQuery();
  
  const userId = ctx.from.id;
  logWithTimestamp('🎟 Course: user clicked "Занять место"', { userId });
  
  // Отмечаем в БД
  if (courseChainService) {
    await courseChainService.markReserved(userId);
  }
  
  await ctx.reply(
    `Отлично! Официально продажи курса стартуют 12 декабря, но твое место будет за тобой забронировано со скидкой 10%.\n\n` +
    `Для брони просто отправь по ссылке любую сумму от 10$`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Забронировать место', url: 'https://t.me/tribute/app?startapp=dzWu' }]
        ]
      }
    }
  );
});

// Кнопка "Подробнее про формат" → переход к сообщению 3
bot.action('course_msg3_trigger', async (ctx) => {
  const userId = ctx.from.id;
  const firstName = ctx.from.first_name;
  logWithTimestamp('📋 Course: user clicked "Подробнее про формат"', { userId });
  
  // Отмечаем клик на сообщение 2 и отправляем сообщение 3
  if (courseChainService) {
    const sent = await courseChainService.handleButtonClickWithResult(userId, 2, firstName);
    if (sent) {
      await ctx.answerCbQuery('Загружаю информацию...');
    } else {
      await ctx.answerCbQuery('✅ Информация уже была отправлена, проверь выше ☝️', { show_alert: true });
    }
  } else {
    await ctx.answerCbQuery('Ошибка сервиса', { show_alert: true });
  }
});

// Кнопка "Посмотреть тарифы" → переход к сообщению 4
bot.action('course_msg4_trigger', async (ctx) => {
  await ctx.answerCbQuery('Загружаю тарифы...');
  const userId = ctx.from.id;
  const firstName = ctx.from.first_name;
  logWithTimestamp('💰 Course: user clicked "Посмотреть тарифы"', { userId });
  
  // Отмечаем клик на сообщение 3 и отправляем сообщение 4
  if (courseChainService) {
    await courseChainService.handleButtonClick(userId, 3, firstName);
  }
});

// =====================================================================

// Обработка получения квитанции (фото) и админ file_id
bot.on(message('photo'), async (ctx) => {
  const userId = ctx.from.id;
  
  // Если админ отправляет фото - показываем file_id
  if (userId === 278263484) {
    const photo = ctx.message.photo;
    const fileId = photo[photo.length - 1].file_id; // Самое высокое разрешение
    console.log(`\n📸 [ADMIN PHOTO] file_id: ${fileId}\n`);
    await ctx.reply(
      `✅ Фото получено!\n\n` +
      `\`${fileId}\`\n\n` +
      `Скопируй этот file_id и используй в коде для отправки изображения.`,
      { parse_mode: 'Markdown' }
    );
    return; // Не обрабатываем как обычное фото квитанции
  }
  
  // Обычная обработка квитанций для пользователей
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

    } catch (error: any) {
      console.error('❌ Error generating invite links:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.description,
        stack: error.stack
      });
      
      await ctx.reply(
        '❌ Произошла ошибка при генерации ссылок.\n\n' +
        'Пожалуйста, обратитесь в поддержку: @vetalsmirnov\n\n' +
        `Код ошибки: ${error.message || 'Неизвестная ошибка'}`
      );
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
    
    // Tracking отказа валидации
    // Проверяем: это вообще не квитанция или квитанция не подходит?
    const isReceipt = validationResult.isReceipt !== undefined ? validationResult.isReceipt : false;
    
    if (!isReceipt) {
      // Это НЕ квитанция
      await trackUserAction(userService, ctx, 'photo_rejected', state.step, {
        reason: 'not_a_receipt',
        imageDescription: imageDesc
      });
    } else {
      // Это квитанция, но не подходит (сумма/карта/fraud)
      await trackUserAction(userService, ctx, 'receipt_validation_failed', state.step, {
        reason: reason,
        isReceipt: true,
        isFraud: validationResult.isFraud || false,
        extractedAmount: validationResult.extractedAmount,
        extractedCardNumber: validationResult.extractedCardNumber,
        confidence: validationResult.confidence
      });
    }
    
    await ctx.reply(
      `🔍 **Что я вижу на фото:**\n${imageDesc}\n\n` +
      `❌ **Почему не подошло:**\n${reason}\n\n` +
      `📋 **Как исправить:**\n` +
      `• Убедитесь что сумма ${expectedAmount} ${currencySymbol}\n` +
      `• Проверьте номер карты получателя (*${expectedCard.slice(-4)})\n` +
      `• Сделайте четкое фото квитанции\n` +
      `• Отправьте квитанцию снова`,
      Markup.inlineKeyboard([
        [Markup.button.url('📨 Написать ассистенту', 'https://t.me/vetalsmirnov')]
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
    logWithTimestamp('🔗 Creating channel invite link', { userId, channelId: config.channelId });
    
    // Проверяем, что бот является администратором канала
    try {
      const chatMember = await bot.telegram.getChatMember(config.channelId, bot.botInfo!.id);
      logWithTimestamp('✅ Bot status in channel', { status: chatMember.status });
      
      if (chatMember.status !== 'administrator' && chatMember.status !== 'creator') {
        const error = new Error(`Bot is not an administrator in the channel. Current status: ${chatMember.status}`);
        logWithTimestamp('❌ Bot lacks permissions', { status: chatMember.status, channelId: config.channelId });
        throw error;
      }
      
      // Проверяем права на создание invite ссылок
      if (chatMember.status === 'administrator') {
        const admin = chatMember as any;
        logWithTimestamp('📋 Bot permissions in channel', {
          can_invite_users: admin.can_invite_users,
          can_manage_chat: admin.can_manage_chat
        });
        
        if (admin.can_invite_users === false) {
          throw new Error('Bot does not have permission to create invite links. Enable "Invite Users via Link" in channel admin settings.');
        }
      }
      
    } catch (checkError: any) {
      logWithTimestamp('❌ Error checking bot status in channel', {
        error: checkError.message,
        channelId: config.channelId,
        response: checkError.response?.description
      });
      throw new Error(`Cannot access channel: ${checkError.message}. Please add bot as admin to channel ID: ${config.channelId}`);
    }
    
    // Создаем уникальную invite-ссылку
    logWithTimestamp('⚙️ Attempting to create invite link...', { channelId: config.channelId });
    const inviteLink = await bot.telegram.createChatInviteLink(config.channelId, {
      member_limit: 1, // Только для одного пользователя
      expire_date: Math.floor(Date.now() / 1000) + 86400 // 24 часа
    });

    logWithTimestamp('✅ Generated channel invite link', { userId, link: inviteLink.invite_link });
    
    return inviteLink.invite_link;
  } catch (error) {
    logWithTimestamp('Error generating invite link', error);
    throw error;
  }
}

// Генерация invite-ссылки для чата
async function generateChatInviteLink(userId: number): Promise<string> {
  try {
    logWithTimestamp('🔗 Creating chat invite link', { userId, chatId: config.chatId });
    
    // Проверяем, что бот является администратором чата
    try {
      const chatMember = await bot.telegram.getChatMember(config.chatId, bot.botInfo!.id);
      logWithTimestamp('✅ Bot status in chat', { status: chatMember.status });
      
      if (chatMember.status !== 'administrator' && chatMember.status !== 'creator') {
        const error = new Error(`Bot is not an administrator in the chat. Current status: ${chatMember.status}`);
        logWithTimestamp('❌ Bot lacks permissions in chat', { status: chatMember.status, chatId: config.chatId });
        throw error;
      }
      
      // Проверяем права на создание invite ссылок
      if (chatMember.status === 'administrator') {
        const admin = chatMember as any;
        logWithTimestamp('📋 Bot permissions in chat', {
          can_invite_users: admin.can_invite_users,
          can_manage_chat: admin.can_manage_chat
        });
        
        if (admin.can_invite_users === false) {
          throw new Error('Bot does not have permission to create invite links. Enable "Invite Users via Link" in chat admin settings.');
        }
      }
      
    } catch (checkError: any) {
      logWithTimestamp('❌ Error checking bot status in chat', {
        error: checkError.message,
        chatId: config.chatId,
        response: checkError.response?.description
      });
      throw new Error(`Cannot access chat: ${checkError.message}. Please add bot as admin to chat ID: ${config.chatId}`);
    }
    
    // Создаем уникальную invite-ссылку для чата
    logWithTimestamp('⚙️ Attempting to create chat invite link...', { chatId: config.chatId });
    const inviteLink = await bot.telegram.createChatInviteLink(config.chatId, {
      member_limit: 1, // Только для одного пользователя
      expire_date: Math.floor(Date.now() / 1000) + 86400 // 24 часа
    });

    logWithTimestamp('✅ Generated chat invite link', { userId, link: inviteLink.invite_link });
    
    return inviteLink.invite_link;
  } catch (error: any) {
    logWithTimestamp('❌ Error generating chat invite link', {
      error: error.message,
      chatId: config.chatId,
      response: error.response?.description
    });
    throw error;
  }
}

// Обработчик для получения Video File IDs (только для админа)
bot.on(message('video'), async (ctx) => {
  const userId = ctx.from.id;
  const ADMIN_ID = 278263484; // Ваш Telegram ID
  
  if (userId === ADMIN_ID) {
    const videoFileId = ctx.message.video.file_id;
    const fileSize = ctx.message.video.file_size || 0;
    const duration = ctx.message.video.duration;
    const width = ctx.message.video.width;
    const height = ctx.message.video.height;
    
    await ctx.reply(
      `✅ Получен Video File ID!\n\n` +
      `📹 Параметры видео:\n` +
      `• Размер: ${(fileSize / 1024 / 1024).toFixed(2)} МБ\n` +
      `• Длительность: ${duration} сек\n` +
      `• Разрешение: ${width}x${height}\n\n` +
      `🔑 File ID для .env:\n\n` +
      `\`${videoFileId}\`\n\n` +
      `Скопируйте и добавьте на Railway как:\n` +
      `VIDEO_X_FILE_ID=${videoFileId}`,
      { parse_mode: 'Markdown' }
    );
    
    console.log('✅ Video File ID:', videoFileId);
  }
});

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
let reminderService: ReminderService;
let channelSyncInterval: NodeJS.Timeout | null = null;

async function startBot() {
  try {
    // 1. Подключаемся к БД
    await initializeDatabase();
    console.log('✅ База данных инициализирована');

    // 2. Создаем UserService
    userService = new UserService();
    console.log('✅ UserService создан');

    // 2.5. Создаем CourseChainService
    courseChainService = new CourseChainService(bot);
    console.log('✅ CourseChainService создан');
    
    // 2.6. ОТКЛЮЧЕНО - автоотправка запускалась при каждом рестарте бота!
    // courseChainService.startAutoSendScheduler(10, 24);
    // console.log('✅ CourseChain AutoSend запущен (10 мин интервал, 24ч duration)');
    console.log('⚠️ CourseChain AutoSend ОТКЛЮЧЕН (был привязан к запуску бота)');

    // 3. Выводим статистику платежей и воронки
    const statsService = new StatsService();
    await statsService.logPaymentStats();
    await statsService.logFunnelStats();

    // 4. Запускаем сервис напоминаний
    reminderService = new ReminderService(bot);
    reminderService.start();
    console.log('✅ ReminderService запущен');

    // 4.5. Запускаем сервис догрева (warmup) каждые 2 минуты
    const { WarmupService } = await import('./services/warmupService');
    const warmupService = new WarmupService(bot);
    
    // Первая проверка сразу
    await warmupService.sendWarmupReminders();
    
    // Затем каждые 2 минуты
    setInterval(async () => {
      await warmupService.sendWarmupReminders();
    }, 2 * 60 * 1000); // 2 минуты
    console.log('✅ WarmupService запущен (проверка каждые 2 минуты)');

    // 5. Запускаем автоматическую синхронизацию канала каждые 6 часов
    const channelSyncService = new ChannelSyncService(bot);
    
    // Первая синхронизация сразу при запуске
    console.log('🔄 Запуск начальной синхронизации канала...');
    try {
      const initialResult = await channelSyncService.syncChannelMembers(config.channelId);
      console.log('✅ Начальная синхронизация завершена:', {
        totalMembers: initialResult.totalMembers,
        markedAsPaid: initialResult.markedAsPaid,
        newFriends: initialResult.newFriends,
      });
    } catch (error) {
      console.error('❌ Ошибка начальной синхронизации:', error);
    }

    // Затем каждые 6 часов
    const SYNC_INTERVAL_HOURS = 6;
    channelSyncInterval = setInterval(async () => {
      console.log('🔄 Автоматическая синхронизация канала...');
      try {
        const result = await channelSyncService.syncChannelMembers(config.channelId);
        console.log('✅ Синхронизация завершена:', {
          totalMembers: result.totalMembers,
          markedAsPaid: result.markedAsPaid,
          newFriends: result.newFriends,
        });
      } catch (error) {
        console.error('❌ Ошибка автоматической синхронизации:', error);
      }
    }, SYNC_INTERVAL_HOURS * 60 * 60 * 1000); // 6 часов в миллисекундах
    
    console.log(`✅ Автоматическая синхронизация канала настроена (каждые ${SYNC_INTERVAL_HOURS}ч)`);

    // 6. Запускаем Tribute Webhook сервер ПЕРВЫМ (до бота!)
    console.log('🔄 Запуск Tribute Webhook сервера...');
    const tributeWebhook = new TributeWebhookService(bot, config.tributeApiKey);
    tributeWebhook.start(Number(PORT));
    console.log(`✅ Tribute Webhook сервер запущен на порту ${PORT}`);
    
    // Даем серверу время запуститься
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 7. Запускаем бота (Long Polling, не webhook Telegram)
    console.log('🔄 Запуск Telegram бота...');
    await bot.launch();

    console.log('✅ Бот запущен успешно (Long Polling)');
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Port: ${PORT}`);
    console.log(`📡 Webhook доступен: https://web-production-cc297.up.railway.app/webhook/tribute`);
  } catch (error) {
    console.error('❌ Ошибка запуска бота:', error);
    process.exit(1);
  }
}

// Запускаем бота
startBot();

// Graceful shutdown
process.once('SIGINT', () => {
  if (reminderService) reminderService.stop();
  if (channelSyncInterval) clearInterval(channelSyncInterval);
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  if (reminderService) reminderService.stop();
  if (channelSyncInterval) clearInterval(channelSyncInterval);
  bot.stop('SIGTERM');
});

export default bot;
