/**
 * Цепочка рассылки: Курс "Снимите это немедленно!"
 * 
 * ЛОГИКА:
 * - Сообщение 1: всей базе
 * - Сообщение 2: по клику ИЛИ через 6 часов после msg1
 * - Сообщение 3: по клику ИЛИ через 1 час после msg2  
 * - Сообщение 4: по клику ИЛИ через 30 минут после msg3
 * 
 * КОМАНДЫ:
 * npm run course:start     - запустить рассылку сообщения 1 всей базе
 * npm run course:auto      - отправить по времени (запускать по cron каждые 10 мин)
 * npm run course:stats     - показать статистику
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { Telegraf } from 'telegraf';
import { AppDataSource } from './src/database';
import { CourseChainProgress } from './src/entities/CourseChainProgress';
import { User } from './src/entities/User';
import { BroadcastHistory } from './src/entities/BroadcastHistory';

const bot = new Telegraf(process.env.BOT_TOKEN!);
const ADMIN_ID = 278263484;

// Задержки между сообщениями
const DELAYS = {
  msg2: 6 * 60 * 60 * 1000,   // 6 часов
  msg3: 1 * 60 * 60 * 1000,   // 1 час
  msg4: 30 * 60 * 1000        // 30 минут
};

// =====================================================================
// КОНТЕНТ СООБЩЕНИЙ
// =====================================================================

const MESSAGES = {
  msg1: {
    image: './снимите это немедленно/banner_1.png',
    text: `Привет, {firstName}! ✨ Это Юля.

Ты интересовался(ась) промтами для рилс - и я хочу рассказать тебе кое-что раньше других.

<b>12 декабря открываю продажи на курс «Снимите это немедленно!»</b> - система рилс, которые приводят клиентов. Не охваты, а деньги.

Для тебя ранний доступ уже открыт + скидка 10%.

<b>Что внутри:</b>

- 9 уроков: от ЦА до автоворонки
- 34 формата рилс под любую нишу
- Все промты + система использования
- Клуб + звонки со мной
- Опционально: 7 уроков по монтажу

Хочешь подробнее? 👇`,
    buttons: [
      [{ text: '🔥 Посмотреть программу', callback_data: 'course_msg2_trigger' }],
      [{ text: '✍️ Написать Юле', url: 'https://t.me/JFilipenko' }],
      [{ text: '🎟 Занять место', callback_data: 'course_reserve_spot' }]
    ]
  },
  msg2: {
    image: './снимите это немедленно/banner_2.png',
    text: `Расскажу подробнее 🙌

<b>«Снимите это немедленно!»</b> - система, которую я собирала 3 года.

<b>Для кого:</b>

→ Охваты не конвертируются в деньги
→ Снимаешь, но результат - лотерея
→ Не знаешь с чего начать / боишься камеры
→ Хочешь систему без выгорания

<b>Что внутри:</b>

🎯 Уроки 1-2: Архетип + глубокий анализ ЦА
📈 Урок 3: Алгоритмы и прогрев аккаунта
🤖 Урок 4: Все промты - идеи, хуки, CTA
🎬 Уроки 5-6: 34 формата + сторителлинг
💰 Урок 7: Автоворонки и сбор лидов
🚀 Урок 8: Продвижение после публикации
💪 Урок 9: Страхи и выгорание

<b>+ Опционально:</b> 7 уроков по монтажу от эксперта

<b>Бонусы:</b> клуб на месяц, звонки со мной, чат, челлендж «30 рилс»

Как проходит курс? 👇`,
    buttons: [
      [{ text: '📋 Подробнее про формат', callback_data: 'course_msg3_trigger' }],
      [{ text: '✍️ Написать Юле', url: 'https://t.me/JFilipenko' }],
      [{ text: '🎟 Занять место', callback_data: 'course_reserve_spot' }]
    ]
  },
  msg3: {
    image: './снимите это немедленно/banner_3.jpg',
    text: `Отвечу на частые вопросы:

<b>«Нет времени»</b> - Уроки в записи, 15-20 мин каждый. Смотри когда удобно.

<b>«Не умею монтаж»</b> - Курс про смыслы, не монтаж. Но есть отдельный модуль, если захочешь.

<b>«Боюсь камеры»</b> - Есть урок про это + форматы без лица + поддержка в чате.

<b>«Рилс - лотерея»</b> - Нет. Это система. Я научу тебя управлять алгоритмами.

<b>«А если не получится?»</b> - Задания + обратная связь + 4 звонка со мной.

<b>Что входит:</b>

✅ 9 уроков (доступ навсегда)
✅ Задания к каждому уроку
✅ Чат для поддержки
✅ 4 групповых звонка
✅ Клуб на месяц
✅ Промты, карта форматов, чек-листы

<b>Опционально:</b> +7 уроков монтажа с LUT, шрифтами, шаблонами

Показать тебе тарифы? 👇`,
    buttons: [
      [{ text: '💰 Посмотреть тарифы', callback_data: 'course_msg4_trigger' }],
      [{ text: '✍️ Написать Юле', url: 'https://t.me/JFilipenko' }],
      [{ text: '🎟 Занять место', callback_data: 'course_reserve_spot' }]
    ]
  },
  msg4: {
    image: './снимите это немедленно/banner_4.png',
    text: `Вот конкретика 👇

<b>Твой результат после курса:</b>

→ Понимание ЦА: что болит, за сколько заплатят
→ Система рилс без хаоса
→ 34 формата + адаптация трендов
→ Воронка: рилс → лид → клиент
→ Уверенность и план на месяцы

<b>Тарифы (скидка 10% для тебя):</b>

🎯 <b>Базовый:</b> <s>$550</s> → <b>$495</b>
9 уроков + материалы + клуб + звонки

💎 <b>Курс + Монтаж:</b> <s>$750</s> → <b>$675</b>
Всё из базового + 7 уроков монтажа

🎬 <b>Только монтаж:</b> <s>$300</s> → <b>$270</b>

<b>Почему сейчас:</b>

⏰ Скидка 10% только до 12 декабря
⏰ Мест всего 20

<b>Бронь:</b> переведи любую сумму от 10$ чтобы забронировать своё место сейчас.`,
    buttons: [
      [{ text: '🔥 Забронировать место', url: 'https://t.me/tribute/app?startapp=dzWu' }],
      [{ text: '✍️ Написать Юле', url: 'https://t.me/JFilipenko' }]
    ]
  }
};

// =====================================================================
// ФУНКЦИИ ОТПРАВКИ
// =====================================================================

async function sendMessage(userId: number, msgNum: 1 | 2 | 3 | 4, firstName?: string): Promise<boolean> {
  const msgKey = `msg${msgNum}` as keyof typeof MESSAGES;
  const msgData = MESSAGES[msgKey];
  
  try {
    const name = firstName || 'друг';
    const personalizedText = msgData.text.replace('{firstName}', name);
    
    await bot.telegram.sendPhoto(
      userId,
      { source: msgData.image },
      {
        caption: personalizedText,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: msgData.buttons as any
        }
      }
    );
    
    return true;
  } catch (error: any) {
    if (error.code === 403) {
      // Пользователь заблокировал бота
      const repo = AppDataSource.getRepository(CourseChainProgress);
      await repo.update({ userId }, { blocked: true });
    }
    return false;
  }
}

// =====================================================================
// ЗАПУСК РАССЫЛКИ СООБЩЕНИЯ 1
// =====================================================================

async function startBroadcast() {
  console.log('\n🚀 ЗАПУСК РАССЫЛКИ СООБЩЕНИЯ 1\n');
  
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  
  const userRepo = AppDataSource.getRepository(User);
  const progressRepo = AppDataSource.getRepository(CourseChainProgress);
  
  // Получаем всех пользователей из БД
  const allUsers = await userRepo.find();
  console.log(`📊 Всего пользователей в БД: ${allUsers.length}`);
  
  // Проверка
  if (allUsers.length < 100) {
    console.error('⚠️ В базе менее 100 пользователей! Проверьте подключение.');
    await AppDataSource.destroy();
    process.exit(1);
  }
  
  // Фильтруем тех, кто ещё не получил сообщение 1
  const existingProgress = await progressRepo.find();
  const alreadySent = new Set(existingProgress.filter(p => p.msg1Status !== 'pending').map(p => Number(p.userId)));
  
  const usersToSend = allUsers.filter(u => !alreadySent.has(u.userId));
  console.log(`📤 К отправке: ${usersToSend.length}`);
  console.log(`✅ Уже получили: ${alreadySent.size}\n`);
  
  if (usersToSend.length === 0) {
    console.log('Все уже получили сообщение 1!');
    await AppDataSource.destroy();
    return;
  }
  
  let sent = 0;
  let failed = 0;
  const startTime = Date.now();
  
  for (const user of usersToSend) {
    // Создаём или обновляем запись прогресса
    let progress = await progressRepo.findOne({ where: { userId: user.userId } });
    if (!progress) {
      progress = new CourseChainProgress();
      progress.userId = user.userId;
      progress.username = user.username;
      progress.firstName = user.firstName;
    }
    
    const success = await sendMessage(user.userId, 1, user.firstName);
    
    if (success) {
      sent++;
      progress.msg1Status = 'sent';
      progress.msg1SentAt = new Date();
    } else {
      failed++;
      progress.blocked = true;
    }
    
    await progressRepo.save(progress);
    
    // Прогресс каждые 50
    if ((sent + failed) % 50 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const speed = ((sent + failed) / (Date.now() - startTime) * 1000 * 60).toFixed(0);
      console.log(`   📤 ${sent + failed}/${usersToSend.length} | ✅ ${sent} | ❌ ${failed} | ${speed}/мин | ${elapsed} мин`);
    }
    
    // Пауза 100-150мс (безопасно для Telegram)
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 50));
  }
  
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  // Сохраняем в историю
  const history = new BroadcastHistory();
  history.broadcastType = 'course_chain_msg1';
  history.totalSent = sent;
  history.totalAttempted = usersToSend.length;
  history.notes = `Цепочка курса - сообщение 1. Время: ${totalTime} мин`;
  await AppDataSource.manager.save(history);
  
  console.log('\n============================================================');
  console.log('📊 СООБЩЕНИЕ 1 ОТПРАВЛЕНО');
  console.log('============================================================');
  console.log(`✅ Успешно: ${sent}`);
  console.log(`❌ Ошибок: ${failed}`);
  console.log(`⏱️ Время: ${totalTime} минут`);
  console.log('============================================================\n');
  
  // Уведомляем админа
  await bot.telegram.sendMessage(
    ADMIN_ID,
    `✅ <b>Сообщение 1 отправлено!</b>\n\n` +
    `📤 Успешно: ${sent}\n` +
    `❌ Ошибок: ${failed}\n` +
    `⏱️ Время: ${totalTime} мин\n\n` +
    `Следующие сообщения будут отправляться автоматически по таймерам или по кликам.`,
    { parse_mode: 'HTML' }
  );
  
  await AppDataSource.destroy();
}

// =====================================================================
// АВТООТПРАВКА ПО ВРЕМЕНИ
// =====================================================================

async function autoSend() {
  console.log('\n⏰ АВТООТПРАВКА ПО ВРЕМЕНИ\n');
  
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  
  const repo = AppDataSource.getRepository(CourseChainProgress);
  const now = new Date();
  
  let totalSent = 0;
  
  // Проверяем каждое сообщение (2, 3, 4)
  for (const msgNum of [2, 3, 4] as const) {
    const prevMsgNum = msgNum - 1;
    const delayMs = DELAYS[`msg${msgNum}` as keyof typeof DELAYS];
    const cutoffTime = new Date(now.getTime() - delayMs);
    
    // Находим пользователей для автоотправки
    const users = await repo.createQueryBuilder('p')
      .where(`p.msg${prevMsgNum}Status IN ('sent', 'clicked')`)
      .andWhere(`p.msg${prevMsgNum}ClickedAt IS NULL`) // НЕ кликнули
      .andWhere(`p.msg${msgNum}Status = 'pending'`)     // Ещё не получили
      .andWhere(`p.msg${prevMsgNum}SentAt < :cutoffTime`, { cutoffTime })
      .andWhere('p.blocked = false')
      .getMany();
    
    if (users.length > 0) {
      console.log(`📤 Сообщение ${msgNum}: ${users.length} пользователей ждут`);
      
      for (const user of users) {
        const success = await sendMessage(Number(user.userId), msgNum, user.firstName);
        
        if (success) {
          (user as any)[`msg${msgNum}Status`] = 'sent';
          (user as any)[`msg${msgNum}SentAt`] = new Date();
          totalSent++;
        } else {
          user.blocked = true;
        }
        
        await repo.save(user);
        
        // Пауза
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }
  
  if (totalSent > 0) {
    console.log(`\n✅ Автоотправка завершена: ${totalSent} сообщений\n`);
    
    // Уведомляем админа
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `⏰ <b>Автоотправка по таймерам</b>\n\n` +
      `📤 Отправлено: ${totalSent} сообщений`,
      { parse_mode: 'HTML' }
    );
  } else {
    console.log('Нет пользователей для автоотправки\n');
  }
  
  await AppDataSource.destroy();
}

// =====================================================================
// СТАТИСТИКА
// =====================================================================

async function showStats() {
  console.log('\n📊 СТАТИСТИКА ЦЕПОЧКИ КУРСА\n');
  
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  
  const repo = AppDataSource.getRepository(CourseChainProgress);
  
  const total = await repo.count();
  const blocked = await repo.count({ where: { blocked: true } });
  const reserved = await repo.count({ where: { reservedSpot: true } });
  
  const stats: any = {};
  for (const msgNum of [1, 2, 3, 4]) {
    stats[`msg${msgNum}`] = {
      sent: await repo.createQueryBuilder('p')
        .where(`p.msg${msgNum}Status = 'sent'`)
        .getCount(),
      clicked: await repo.createQueryBuilder('p')
        .where(`p.msg${msgNum}Status = 'clicked'`)
        .getCount(),
      pending: await repo.createQueryBuilder('p')
        .where(`p.msg${msgNum}Status = 'pending'`)
        .getCount()
    };
  }
  
  console.log('============================================================');
  console.log(`👥 Всего в цепочке: ${total}`);
  console.log(`🚫 Заблокировали: ${blocked}`);
  console.log(`🎟 Забронировали: ${reserved}`);
  console.log('============================================================');
  console.log(`\n📨 Сообщение 1 (мягкий вход):`);
  console.log(`   📤 Отправлено: ${stats.msg1.sent + stats.msg1.clicked}`);
  console.log(`   👆 Кликнули: ${stats.msg1.clicked}`);
  console.log(`   ⏳ Ожидают: ${stats.msg1.pending}`);
  
  console.log(`\n📨 Сообщение 2 (программа):`);
  console.log(`   📤 Отправлено: ${stats.msg2.sent + stats.msg2.clicked}`);
  console.log(`   👆 Кликнули: ${stats.msg2.clicked}`);
  console.log(`   ⏳ Ожидают: ${stats.msg2.pending}`);
  
  console.log(`\n📨 Сообщение 3 (возражения):`);
  console.log(`   📤 Отправлено: ${stats.msg3.sent + stats.msg3.clicked}`);
  console.log(`   👆 Кликнули: ${stats.msg3.clicked}`);
  console.log(`   ⏳ Ожидают: ${stats.msg3.pending}`);
  
  console.log(`\n📨 Сообщение 4 (тарифы):`);
  console.log(`   📤 Отправлено: ${stats.msg4.sent + stats.msg4.clicked}`);
  console.log(`   👆 Кликнули: ${stats.msg4.clicked}`);
  console.log(`   ⏳ Ожидают: ${stats.msg4.pending}`);
  console.log('============================================================\n');
  
  // Отправляем админу
  const msg = `📊 <b>Статистика цепочки курса</b>\n\n` +
    `👥 Всего: ${total} | 🚫 Блок: ${blocked} | 🎟 Бронь: ${reserved}\n\n` +
    `<b>Сообщение 1:</b> 📤 ${stats.msg1.sent + stats.msg1.clicked} | 👆 ${stats.msg1.clicked}\n` +
    `<b>Сообщение 2:</b> 📤 ${stats.msg2.sent + stats.msg2.clicked} | 👆 ${stats.msg2.clicked}\n` +
    `<b>Сообщение 3:</b> 📤 ${stats.msg3.sent + stats.msg3.clicked} | 👆 ${stats.msg3.clicked}\n` +
    `<b>Сообщение 4:</b> 📤 ${stats.msg4.sent + stats.msg4.clicked} | 👆 ${stats.msg4.clicked}`;
  
  await bot.telegram.sendMessage(ADMIN_ID, msg, { parse_mode: 'HTML' });
  
  await AppDataSource.destroy();
}

// =====================================================================
// ПРЕВЬЮ
// =====================================================================

async function sendPreview() {
  console.log('📤 Отправляю превью...\n');
  
  for (const [key, data] of Object.entries(MESSAGES)) {
    const msgNum = key.replace('msg', '');
    const text = data.text.replace('{firstName}', 'Юля');
    
    await bot.telegram.sendPhoto(
      ADMIN_ID,
      { source: data.image },
      {
        caption: `📍 <b>СООБЩЕНИЕ ${msgNum}</b>\n\n${text}`,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: data.buttons as any }
      }
    );
    
    console.log(`✅ Сообщение ${msgNum} отправлено`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✅ Все превью отправлены!\n');
}

// =====================================================================
// MAIN
// =====================================================================

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'start':
    startBroadcast();
    break;
  case 'auto':
    autoSend();
    break;
  case 'stats':
    showStats();
    break;
  case 'preview':
    sendPreview();
    break;
  default:
    console.log(`
📚 ЦЕПОЧКА РАССЫЛКИ КУРСА

Использование:
  npx ts-node broadcast_course_chain.ts start    - отправить сообщение 1 всей базе
  npx ts-node broadcast_course_chain.ts auto     - автоотправка по таймерам
  npx ts-node broadcast_course_chain.ts stats    - статистика цепочки
  npx ts-node broadcast_course_chain.ts preview  - превью сообщений админу

npm scripts:
  npm run course:start
  npm run course:auto
  npm run course:stats
  npm run course:preview
    `);
}
