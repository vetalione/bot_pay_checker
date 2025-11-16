/**
 * Рассылка Черная Пятница - День 3 (ФИНАЛ)
 * Отправляется всем неоплатившим пользователям с медиагруппой (5 изображений)
 */

import * as dotenv from 'dotenv';
// ВАЖНО: загружаем .env ДО импорта других модулей
dotenv.config();

import { Telegraf, Markup } from 'telegraf';
import { InputFile } from 'telegraf/types';
import { AppDataSource } from './src/database';
import { User } from './src/entities/User';
import { BroadcastHistory } from './src/entities/BroadcastHistory';
import * as fs from 'fs';

const bot = new Telegraf(process.env.BOT_TOKEN!);
const ADMIN_ID = 278263484; // ID админа

// Пути к изображениям
const IMAGE_PATHS = [
  './black friday 3.png',
  './image_1_screen.jpeg',
  './Image_2_screen.jpeg',
  './Image_3_screen.jpeg',
  './image_4_screen.jpeg'
];

// Генерация персонализированного сообщения
function generateMessage(firstName: string): string {
  const name = firstName || 'Привет';
  
  return `Привет, ${name}, это опять Юля! 🌟

Пришла тебе напомнить что сегодня <b>последний день Чёрной Пятницы</b> — и последний шанс забрать полный набор для продвижения в Reels за $25 с <b>пожизненным доступом в клуб</b>.

<b>Что внутри прямо сейчас:</b>

🤖 <b>7 промтов для ChatGPT</b> — генерируй идеи, хуки, СТА, подписи и готовые сценарии для рилс за минуты

📊 <b>Карта форматов</b> — 34 проверенных структуры съёмки, чтобы не думать "о чём снять"

📈 <b>Воркбук-трекер на 30 дней</b> — система от 0 до первой 1000 подписчиков

Отзывы первых участников на скринах!

<b>+ Бонус только сегодня:</b>

💎 <b>Пожизненный бесплатный доступ в клуб "Reels Мастера"</b>, когда он полноценно запустится

В ближайшие месяцы клуб откроется на полную: еженедельные разборы, обновления промтов, мастер-классы, приглашённые эксперты, комьюнити. И стоить это будет <b>$30 в месяц</b> (или $90 сразу за 3 месяца).

А ты, купив сегодня за $25, получаешь всё <b>навсегда бесплатно</b>. Один платёж — и пожизненный доступ ко всему, что будет внутри клуба.

<b>Завтра эта возможность закроется.</b>

Больше писать не буду! С теплом, Юля`;
}

async function sendToAdmin() {
  console.log('📤 Отправляю превью рассылки ЧП День 3 админу...\n');
  
  try {
    // Получаем имя админа
    const adminInfo = await bot.telegram.getChat(ADMIN_ID);
    const firstName = 'first_name' in adminInfo ? adminInfo.first_name : 'Админ';
    const message = generateMessage(firstName);
    
    // 1. Сначала медиагруппу (5 изображений)
    const mediaGroup = IMAGE_PATHS.map(path => ({
      type: 'photo' as const,
      media: { source: path }
    }));
    
    await bot.telegram.sendMediaGroup(ADMIN_ID, mediaGroup);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 2. Потом текст с персонализацией
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `<b>🧪 ПРЕВЬЮ РАССЫЛКИ ЧП ДЕНЬ 3 (ФИНАЛ)</b>\n\n${message}`,
      { parse_mode: 'HTML' }
    );
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 3. Затем кнопку
    await bot.telegram.sendMessage(
      ADMIN_ID,
      '👆 Вот так будет выглядеть рассылка\n\n' +
      'Порядок:\n' +
      '1️⃣ 5 изображений медиагруппой\n' +
      '2️⃣ Текст с персонализацией\n' +
      '3️⃣ Кнопка ниже ↓',
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '🔥 Забирай сейчас!', callback_data: 'black_friday_payment' }
          ]]
        }
      }
    );
    
    console.log('✅ Превью отправлено админу!');
    console.log('📝 Персонализация работает (подставляется имя)');
    console.log('🔘 Кнопка "🔥 Забирай сейчас!" ведет на black_friday_payment');
    console.log('🖼️  Отправлено 5 изображений медиагруппой\n');
    console.log('⏳ Жду подтверждения от админа для запуска массовой рассылки...');
    console.log('Для запуска используй: npm run broadcast-bf-day3-send\n');
    
  } catch (error) {
    console.error('❌ Ошибка отправки админу:', error);
  }
  
  process.exit(0);
}

async function sendBroadcast() {
  console.log('🚀 Начинаю рассылку Черная Пятница День 3 (ФИНАЛ)...\n');
  
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    console.log('✅ Подключено к базе данных\n');
  }
  
  // Получаем всех НЕоплативших пользователей
  const users = await AppDataSource.query(`
    SELECT "userId", "firstName", "username"
    FROM users
    WHERE "hasPaid" = false
    ORDER BY "userId"
  `);
  
  console.log(`📊 Найдено получателей: ${users.length}\n`);
  
  if (users.length === 0) {
    console.log('⚠️ Нет получателей для рассылки');
    return;
  }
  
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  
  for (const user of users) {
    try {
      const message = generateMessage(user.firstName);
      
      // 1. Сначала изображения (5 штук)
      const mediaGroup = IMAGE_PATHS.map(path => ({
        type: 'photo' as const,
        media: { source: path }
      }));
      
      await bot.telegram.sendMediaGroup(user.userId, mediaGroup);
      
      // Небольшая пауза
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 2. Потом текст
      await bot.telegram.sendMessage(user.userId, message, { parse_mode: 'HTML' });
      
      // Небольшая пауза
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 3. Затем кнопку
      await bot.telegram.sendMessage(
        user.userId,
        '👇',
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '🔥 Забирай сейчас!', callback_data: 'black_friday_payment' }
            ]]
          }
        }
      );
      
      sent++;
      
      if (sent % 10 === 0) {
        console.log(`   Отправлено: ${sent}/${users.length}...`);
      }
      
      // Пауза между отправками (чтобы не словить флуд-контроль)
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error: any) {
      failed++;
      const errorMsg = `User ${user.userId}: ${error.message}`;
      errors.push(errorMsg);
      
      if (error.code === 403) {
        // Пользователь заблокировал бота - это нормально
      } else {
        console.error(`   ❌ ${errorMsg}`);
      }
    }
  }
  
  // Сохраняем статистику в базу
  const broadcastHistory = new BroadcastHistory();
  broadcastHistory.broadcastType = 'black_friday_day3_final';
  broadcastHistory.totalSent = sent;
  broadcastHistory.totalAttempted = users.length;
  broadcastHistory.segmentStart = 0;
  broadcastHistory.segmentVideo1 = 0;
  
  await AppDataSource.manager.save(broadcastHistory);
  
  // Отчет
  console.log('\n============================================================');
  console.log('📊 РАССЫЛКА ЗАВЕРШЕНА: Черная Пятница День 3 (ФИНАЛ)');
  console.log('============================================================');
  console.log(`✅ Успешно отправлено: ${sent}`);
  console.log(`❌ Не доставлено: ${failed}`);
  console.log(`📈 Процент успеха: ${((sent / users.length) * 100).toFixed(1)}%`);
  console.log('============================================================\n');
  
  if (errors.length > 0 && errors.length <= 10) {
    console.log('Ошибки:');
    errors.forEach(err => console.log(`  - ${err}`));
  }
  
  // Уведомляем админа
  try {
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `✅ <b>Рассылка "Черная Пятница День 3 (ФИНАЛ)" завершена</b>\n\n` +
      `📤 Отправлено: ${sent}/${users.length}\n` +
      `❌ Ошибок: ${failed}\n` +
      `📈 Успех: ${((sent / users.length) * 100).toFixed(1)}%`,
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    console.error('❌ Не удалось отправить уведомление админу');
  }
  
  await AppDataSource.destroy();
  process.exit(0);
}

// Проверяем аргумент командной строки
const args = process.argv.slice(2);

if (args.includes('--send')) {
  sendBroadcast();
} else {
  sendToAdmin();
}
