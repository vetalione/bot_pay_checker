/**
 * Рассылка Черная Пятница - День 2
 * Отправляется всем неоплатившим пользователям на 2-й день акции
 */

import * as dotenv from 'dotenv';
// ВАЖНО: загружаем .env ДО импорта других модулей
dotenv.config();

import { Telegraf, Markup } from 'telegraf';
import { Input } from 'telegraf';
import { AppDataSource } from './src/database';
import { User } from './src/entities/User';
import { BroadcastHistory } from './src/entities/BroadcastHistory';

const bot = new Telegraf(process.env.BOT_TOKEN!);
const ADMIN_ID = 278263484; // ID админа
const IMAGE_PATH = './Image_3_screen.jpeg';

// Определение пола по имени
function detectGender(firstName: string): 'female' | 'male' {
  if (!firstName) return 'male';
  
  const name = firstName.toLowerCase().trim();
  
  // Исключения для мужских имен на -а/-я
  const maleExceptions = ['никита', 'илья', 'савва', 'лёва', 'лева', 'коля', 'вася', 'петя', 'саша', 'женя', 'валя', 'миша'];
  if (maleExceptions.includes(name)) return 'male';
  
  // Женские окончания
  const femaleEndings = ['а', 'я', 'на', 'ла', 'ка', 'ша', 'ся'];
  for (const ending of femaleEndings) {
    if (name.endsWith(ending)) return 'female';
  }
  
  return 'male';
}

// Генерация персонализированного сообщения
function generateMessage(firstName: string, gender: 'female' | 'male'): string {
  const name = firstName || 'Привет';
  
  if (gender === 'female') {
    return `${name}, уже 100+ девушек внутри 🔥

Вчера запустила <b>Чёрную Пятницу</b> — пожизненный доступ за $25.

Многие уже забрали. Но ты ещё можешь успеть — <b>осталось ровно 48 часов.</b>

Почему это важно?
Через 2 дня всё перейдёт на подписку $30/мес. Сейчас — последний шанс взять <b>один раз и навсегда.</b>

<b>Что внутри за $25:</b>

📊 Карта форматов рилс (34 варианта)
🤖 7 промтов для создания контента
📈 Воркбук-трекер на 30 дней
💬 Закрытый чат + разборы + обновления

Никаких ежемесячных списаний. Никаких подписок.
<b>$25 сейчас = доступ навсегда.</b>

⏰ Через 48 часов цена меняется.
Не упусти момент ❤️`;
  } else {
    return `${name}, уже 100+ человек внутри 🔥

Вчера запустил <b>Чёрную Пятницу</b> — пожизненный доступ за $25.

Многие уже забрали. Но ты ещё можешь успеть — <b>осталось ровно 48 часов.</b>

Почему это важно?
Через 2 дня всё перейдёт на подписку $30/мес. Сейчас — последний шанс взять <b>один раз и навсегда.</b>

<b>Что внутри за $25:</b>

📊 Карта форматов рилс (34 варианта)
🤖 7 промтов для создания контента
📈 Воркбук-трекер на 30 дней
💬 Закрытый чат + разборы + обновления

Никаких ежемесячных списаний. Никаких подписок.
<b>$25 сейчас = доступ навсегда.</b>

⏰ Через 48 часов цена меняется.
Не упусти момент 🔥`;
  }
}

async function sendToAdmin() {
  console.log('📤 Отправляю превью админу...');
  
  try {
    // Отправляем женскую версию
    const femaleMessage = generateMessage('Анна', 'female');
    await bot.telegram.sendPhoto(
      ADMIN_ID,
      Input.fromLocalFile(IMAGE_PATH),
      {
        caption: `<b>ПРЕВЬЮ: Женская версия</b>\n\n${femaleMessage}`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '💎 Забрать доступ за $25', callback_data: 'payment_choice' }
          ]]
        }
      }
    );
    
    console.log('✅ Женская версия отправлена');
    
    // Небольшая пауза
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Отправляем мужскую версию
    const maleMessage = generateMessage('Александр', 'male');
    await bot.telegram.sendPhoto(
      ADMIN_ID,
      Input.fromLocalFile(IMAGE_PATH),
      {
        caption: `<b>ПРЕВЬЮ: Мужская версия</b>\n\n${maleMessage}`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '💎 Забрать доступ за $25', callback_data: 'payment_choice' }
          ]]
        }
      }
    );
    
    console.log('✅ Мужская версия отправлена');
    console.log('\n⏳ Жду подтверждения от админа для запуска массовой рассылки...');
    console.log('Для запуска используй: npm run broadcast:bf-day2:send\n');
    
  } catch (error) {
    console.error('❌ Ошибка отправки админу:', error);
  }
}

async function sendBroadcast() {
  console.log('🚀 Начинаю рассылку Черная Пятница День 2...\n');
  
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
      const gender = detectGender(user.firstName);
      const message = generateMessage(user.firstName, gender);
      
      await bot.telegram.sendPhoto(
        user.userId,
        Input.fromLocalFile(IMAGE_PATH),
        {
          caption: message,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '💎 Забрать доступ за $25', callback_data: 'payment_choice' }
            ]]
          }
        }
      );
      
      sent++;
      
      if (sent % 10 === 0) {
        console.log(`   Отправлено: ${sent}/${users.length}...`);
      }
      
      // Пауза между отправками (чтобы не словить флуд-контроль)
      await new Promise(resolve => setTimeout(resolve, 100));
      
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
  broadcastHistory.broadcastType = 'black_friday_day2';
  broadcastHistory.totalSent = sent;
  broadcastHistory.totalAttempted = users.length;
  broadcastHistory.segmentStart = 0;
  broadcastHistory.segmentVideo1 = 0;
  
  await AppDataSource.manager.save(broadcastHistory);
  
  // Отчет
  console.log('\n============================================================');
  console.log('📊 РАССЫЛКА ЗАВЕРШЕНА: Черная Пятница День 2');
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
      `✅ <b>Рассылка "Черная Пятница День 2" завершена</b>\n\n` +
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
