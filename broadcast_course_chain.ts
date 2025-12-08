/**
 * Цепочка рассылки: Курс "Снимите это немедленно!"
 * 
 * СТРУКТУРА ЦЕПОЧКИ:
 * 1. Сообщение 1 (мягкий вход) → клик ИЛИ 6 часов → Сообщение 2
 * 2. Сообщение 2 (подробности) → клик ИЛИ 1 час → Сообщение 3
 * 3. Сообщение 3 (отработка возражений) → клик → Сообщение 4
 * 4. Сообщение 4 (финальное продающее)
 * 
 * ВСЕ сообщения: изображение + текст (caption) + кнопка в одном sendPhoto
 * 
 * КОМАНДЫ:
 * npm run course:preview      - превью всех 4 сообщений админу
 * npm run course:msg1         - отправить сообщение 1 всей базе
 * npm run course:msg2         - отправить сообщение 2 (тем кто получил 1)
 * npm run course:msg3         - отправить сообщение 3 (тем кто получил 2)
 * npm run course:msg4         - отправить сообщение 4 (тем кто получил 3)
 * npm run course:stats        - статистика по цепочке
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { Telegraf } from 'telegraf';
import { AppDataSource } from './src/database';
import { BroadcastHistory } from './src/entities/BroadcastHistory';
import * as fs from 'fs';

const bot = new Telegraf(process.env.BOT_TOKEN!);
const ADMIN_ID = 278263484;

// =====================================================================
// КОНТЕНТ СООБЩЕНИЙ
// =====================================================================

// Сообщение 1: Мягкий вход
const MESSAGE_1 = {
  image: './снимите это немедленно/banner_1.png',
  // {firstName} будет заменен на имя пользователя
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
};

// Сообщение для брони места
const RESERVE_SPOT_MESSAGE = {
  text: `Отлично! Официально продажи курса стартуют 12 декабря, но твое место будет за тобой забронировано со скидкой 10%.

Для брони просто отправь по ссылке любую сумму от 10$`,
  button: '💳 Забронировать место',
  buttonUrl: 'https://t.me/tribute/app?startapp=dzWu'
};

// Сообщение 2: Подробности курса
const MESSAGE_2 = {
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
    [{ text: '� Подробнее про формат', callback_data: 'course_msg3_trigger' }],
    [{ text: '✍️ Написать Юле', url: 'https://t.me/JFilipenko' }],
    [{ text: '🎟 Занять место', callback_data: 'course_reserve_spot' }]
  ]
};

// Сообщение 3: Отработка возражений
const MESSAGE_3 = {
  image: './снимите это немедленно/banner_3.jpg', // JPEG версия (1.5 МБ вместо 13 МБ)
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
};

// Сообщение 4: Финальное продающее с тарифами
const MESSAGE_4 = {
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

� <b>Курс + Монтаж:</b> <s>$750</s> → <b>$675</b>
Всё из базового + 7 уроков монтажа

🎬 <b>Только монтаж:</b> <s>$300</s> → <b>$270</b>

<b>Почему сейчас:</b>

⏰ Скидка 10% только до 12 декабря
⏰ Мест всего 20

<b>Бронь:</b> переведи любую сумму от 10$ чтобы забронировать своё место сейчас.`,
  buttons: [
    [{ text: '� Забронировать место', url: 'https://t.me/tribute/app?startapp=dzWu' }],
    [{ text: '✍️ Написать Юле', url: 'https://t.me/JFilipenko' }]
  ]
};

// =====================================================================
// ФАЙЛЫ ДЛЯ ОТСЛЕЖИВАНИЯ
// =====================================================================

const CHAIN_FILES = {
  msg1: './course_chain_msg1_received.txt',
  msg2: './course_chain_msg2_received.txt',
  msg3: './course_chain_msg3_received.txt',
  msg4: './course_chain_msg4_received.txt'
};

// Загрузка ID пользователей, получивших сообщение
function loadReceivedIds(messageNum: number): number[] {
  const filePath = CHAIN_FILES[`msg${messageNum}` as keyof typeof CHAIN_FILES];
  
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n')
      .filter(line => line.trim())
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id));
  }
  return [];
}

// Сохранение ID пользователя
function saveReceivedId(messageNum: number, userId: number) {
  const filePath = CHAIN_FILES[`msg${messageNum}` as keyof typeof CHAIN_FILES];
  fs.appendFileSync(filePath, `${userId}\n`);
}

// =====================================================================
// ОТПРАВКА ПРЕВЬЮ АДМИНУ
// =====================================================================

async function sendPreviewToAdmin() {
  console.log('📤 Отправляю превью всех 4 сообщений админу...\n');
  
  const messages = [
    { num: 1, data: MESSAGE_1, delay: '→ клик ИЛИ 6ч' },
    { num: 2, data: MESSAGE_2, delay: '→ клик ИЛИ 1ч' },
    { num: 3, data: MESSAGE_3, delay: '→ клик' },
    { num: 4, data: MESSAGE_4, delay: '(финал)' }
  ];
  
  try {
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `🎬 <b>ПРЕВЬЮ ЦЕПОЧКИ: "Снимите это немедленно!"</b>\n\n` +
      `Всего 4 сообщения:\n` +
      `1️⃣ Мягкий вход ${messages[0].delay}\n` +
      `2️⃣ Подробности ${messages[1].delay}\n` +
      `3️⃣ Возражения ${messages[2].delay}\n` +
      `4️⃣ Финальное ${messages[3].delay}`,
      { parse_mode: 'HTML' }
    );
    
    for (const msg of messages) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const personalizedText = msg.data.text.replace('{firstName}', 'Юля');
      
      // Все MESSAGE используют формат buttons
      const keyboard = msg.data.buttons;
      
      await bot.telegram.sendPhoto(
        ADMIN_ID,
        { source: msg.data.image },
        {
          caption: `📍 <b>СООБЩЕНИЕ ${msg.num}</b> ${msg.delay}\n\n${personalizedText}`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );
      
      console.log(`✅ Сообщение ${msg.num} отправлено`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `✅ <b>Все превью отправлены!</b>\n\n` +
      `📋 <b>Команды запуска:</b>\n` +
      `<code>npm run course:msg1</code> - сообщение 1 всей базе\n` +
      `<code>npm run course:msg2</code> - сообщение 2\n` +
      `<code>npm run course:msg3</code> - сообщение 3\n` +
      `<code>npm run course:msg4</code> - сообщение 4\n\n` +
      `<code>npm run course:stats</code> - статистика`,
      { parse_mode: 'HTML' }
    );
    
    console.log('\n✅ Превью успешно отправлены админу!');
    
  } catch (error) {
    console.error('❌ Ошибка отправки:', error);
  }
  
  process.exit(0);
}

// =====================================================================
// ОТПРАВКА СООБЩЕНИЯ
// =====================================================================

async function sendMessage(messageNum: number, sendAll: boolean = false) {
  const messageData = [MESSAGE_1, MESSAGE_2, MESSAGE_3, MESSAGE_4][messageNum - 1];
  
  console.log(`\n🚀 Отправка сообщения ${messageNum} цепочки курса...\n`);
  
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    console.log('✅ Подключено к базе данных\n');
  }
  
  // Получаем всех пользователей
  const allUsers = await AppDataSource.query(`
    SELECT "userId", "firstName", "username"
    FROM users
    ORDER BY "userId"
  `);
  
  console.log(`📊 Всего пользователей в БД: ${allUsers.length}`);
  
  // Проверка на правильную БД
  if (allUsers.length < 100) {
    console.error('⚠️ ВНИМАНИЕ! В базе менее 100 пользователей!');
    console.error('Возможно, подключение к неправильной БД.');
    console.error('Рассылка НЕ будет запущена!');
    await AppDataSource.destroy();
    process.exit(1);
  }
  
  let targetUsers: any[];
  
  if (messageNum === 1 || sendAll) {
    // Сообщение 1 идёт всем, кто его ещё не получил
    const alreadyReceived = loadReceivedIds(1);
    targetUsers = allUsers.filter((u: any) => !alreadyReceived.includes(u.userId));
    console.log(`📤 Сообщение 1: отправляем всем, кто не получил`);
    console.log(`   Уже получили: ${alreadyReceived.length}`);
  } else {
    // Сообщения 2-4 идут только тем, кто получил предыдущее
    const prevReceived = loadReceivedIds(messageNum - 1);
    const currentReceived = loadReceivedIds(messageNum);
    
    targetUsers = allUsers.filter((u: any) => 
      prevReceived.includes(u.userId) && !currentReceived.includes(u.userId)
    );
    
    console.log(`📤 Сообщение ${messageNum}: отправляем тем, кто получил ${messageNum - 1}`);
    console.log(`   Получили сообщение ${messageNum - 1}: ${prevReceived.length}`);
    console.log(`   Уже получили ${messageNum}: ${currentReceived.length}`);
  }
  
  console.log(`🎯 К отправке: ${targetUsers.length}\n`);
  
  if (targetUsers.length === 0) {
    console.log('⚠️ Нет пользователей для отправки!');
    await AppDataSource.destroy();
    return;
  }
  
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  const startTime = Date.now();
  
  for (const user of targetUsers) {
    try {
      const firstName = user.firstName || 'друг';
      const personalizedText = messageData.text.replace('{firstName}', firstName);
      
      // Все MESSAGE используют формат buttons
      const keyboard = messageData.buttons;
      
      // Отправляем фото + текст + кнопка в одном сообщении
      await bot.telegram.sendPhoto(
        user.userId,
        { source: messageData.image },
        {
          caption: personalizedText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );
      
      sent++;
      saveReceivedId(messageNum, user.userId);
      
      // Прогресс каждые 50
      if (sent % 50 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        const speed = (sent / (Date.now() - startTime) * 1000 * 60).toFixed(0);
        console.log(`   📤 ${sent}/${targetUsers.length} | ${speed} сообщ/мин | ${elapsed} мин`);
      }
      
      // Пауза между отправками (защита от флуд-контроля)
      await new Promise(resolve => setTimeout(resolve, 150));
      
    } catch (error: any) {
      failed++;
      const errorMsg = `User ${user.userId}: ${error.message}`;
      errors.push(errorMsg);
      
      // Логируем только не-403 ошибки (403 = бот заблокирован)
      if (error.code !== 403) {
        console.error(`   ❌ ${errorMsg}`);
      }
    }
  }
  
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  const avgSpeed = sent > 0 
    ? (sent / (Date.now() - startTime) * 1000 * 60).toFixed(0) 
    : '0';
  
  // Сохраняем в историю рассылок
  const broadcastHistory = new BroadcastHistory();
  broadcastHistory.broadcastType = `course_chain_msg${messageNum}`;
  broadcastHistory.totalSent = sent;
  broadcastHistory.totalAttempted = targetUsers.length;
  broadcastHistory.segmentStart = 0;
  broadcastHistory.segmentVideo1 = 0;
  broadcastHistory.notes = `Цепочка курса "Снимите это немедленно!" - сообщение ${messageNum}. Скорость: ${avgSpeed} сообщ/мин`;
  
  await AppDataSource.manager.save(broadcastHistory);
  
  // Итоговый отчет
  console.log('\n============================================================');
  console.log(`📊 СООБЩЕНИЕ ${messageNum} ОТПРАВЛЕНО`);
  console.log('============================================================');
  console.log(`✅ Отправлено: ${sent}/${targetUsers.length}`);
  console.log(`❌ Ошибок: ${failed}`);
  console.log(`⚡ Скорость: ${avgSpeed} сообщений/минуту`);
  console.log(`⏱️  Время: ${totalTime} минут`);
  console.log(`📈 Успех: ${((sent / targetUsers.length) * 100).toFixed(1)}%`);
  console.log('============================================================\n');
  
  // Уведомление админу
  try {
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `✅ <b>Сообщение ${messageNum} отправлено!</b>\n\n` +
      `📤 Отправлено: ${sent}/${targetUsers.length}\n` +
      `❌ Ошибок: ${failed}\n` +
      `⚡ Скорость: ${avgSpeed} сообщ/мин\n` +
      `⏱️ Время: ${totalTime} мин\n\n` +
      `Следующее: npm run course:msg${messageNum + 1}`,
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    console.error('Не удалось отправить уведомление админу');
  }
  
  await AppDataSource.destroy();
  process.exit(0);
}

// =====================================================================
// СТАТИСТИКА ЦЕПОЧКИ
// =====================================================================

async function showStats() {
  console.log('\n📊 СТАТИСТИКА ЦЕПОЧКИ "Снимите это немедленно!"\n');
  
  const stats = {
    msg1: loadReceivedIds(1).length,
    msg2: loadReceivedIds(2).length,
    msg3: loadReceivedIds(3).length,
    msg4: loadReceivedIds(4).length
  };
  
  console.log('============================================================');
  console.log(`📨 Сообщение 1 (мягкий вход):     ${stats.msg1} получателей`);
  console.log(`📨 Сообщение 2 (подробности):     ${stats.msg2} получателей`);
  console.log(`📨 Сообщение 3 (возражения):      ${stats.msg3} получателей`);
  console.log(`📨 Сообщение 4 (финальное):       ${stats.msg4} получателей`);
  console.log('============================================================');
  
  if (stats.msg1 > 0) {
    console.log(`\n📈 КОНВЕРСИЯ:`);
    console.log(`   1→2: ${((stats.msg2 / stats.msg1) * 100).toFixed(1)}%`);
    if (stats.msg2 > 0) {
      console.log(`   2→3: ${((stats.msg3 / stats.msg2) * 100).toFixed(1)}%`);
    }
    if (stats.msg3 > 0) {
      console.log(`   3→4: ${((stats.msg4 / stats.msg3) * 100).toFixed(1)}%`);
    }
    console.log(`   1→4 (общая): ${((stats.msg4 / stats.msg1) * 100).toFixed(1)}%`);
  }
  
  console.log('\n');
  
  // Отправляем статистику админу
  try {
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `📊 <b>Статистика цепочки курса</b>\n\n` +
      `1️⃣ Мягкий вход: ${stats.msg1}\n` +
      `2️⃣ Подробности: ${stats.msg2}\n` +
      `3️⃣ Возражения: ${stats.msg3}\n` +
      `4️⃣ Финальное: ${stats.msg4}\n\n` +
      `📈 <b>Конверсия:</b>\n` +
      (stats.msg1 > 0 
        ? `1→2: ${((stats.msg2 / stats.msg1) * 100).toFixed(1)}%\n` +
          `1→4: ${((stats.msg4 / stats.msg1) * 100).toFixed(1)}%`
        : 'Нет данных'),
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    // ignore
  }
  
  process.exit(0);
}

// =====================================================================
// MAIN
// =====================================================================

const args = process.argv.slice(2);

if (args.includes('--preview') || args.includes('preview')) {
  sendPreviewToAdmin();
} else if (args.includes('--msg1') || args.includes('msg1')) {
  sendMessage(1);
} else if (args.includes('--msg2') || args.includes('msg2')) {
  sendMessage(2);
} else if (args.includes('--msg3') || args.includes('msg3')) {
  sendMessage(3);
} else if (args.includes('--msg4') || args.includes('msg4')) {
  sendMessage(4);
} else if (args.includes('--stats') || args.includes('stats')) {
  showStats();
} else {
  console.log(`
📚 ЦЕПОЧКА РАССЫЛКИ: "Снимите это немедленно!"

Использование:
  npx ts-node broadcast_course_chain.ts preview   - превью всех сообщений админу
  npx ts-node broadcast_course_chain.ts msg1      - отправить сообщение 1
  npx ts-node broadcast_course_chain.ts msg2      - отправить сообщение 2
  npx ts-node broadcast_course_chain.ts msg3      - отправить сообщение 3
  npx ts-node broadcast_course_chain.ts msg4      - отправить сообщение 4
  npx ts-node broadcast_course_chain.ts stats     - показать статистику

Или через npm scripts:
  npm run course:preview
  npm run course:msg1
  npm run course:msg2
  npm run course:msg3
  npm run course:msg4
  npm run course:stats
  `);
  process.exit(0);
}
