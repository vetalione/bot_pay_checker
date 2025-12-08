/**
 * Продолжение рассылки: Прямой эфир про Reels (осталось 30 минут)
 * Отправляется тем, кто НЕ получил первую рассылку
 * Оптимизирована для быстрой отправки
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { Telegraf } from 'telegraf';
import { AppDataSource } from './src/database';
import { BroadcastHistory } from './src/entities/BroadcastHistory';
import * as fs from 'fs';

const bot = new Telegraf(process.env.BOT_TOKEN!);
const ADMIN_ID = 278263484;

const IMAGE_PATH = './Image_1_broadcast.jpeg';

// Обновленный текст с 30 минутами
const MESSAGE = `Привет 👋

Сегодня в <b>14:00 по СНГ</b> у меня прямой эфир в Telegram-канале - и он действительно важный.

Если ты эксперт, который хочет получать клиентов и продажи через контент, но чувствуешь, что что-то сломалось - этот эфир для тебя.

<b>Что случилось с Reels:</b>

Алгоритмы изменились. То, что работало полгода назад - больше не даёт результатов. Охваты падают, подписчиков нет, продаж - тоже.

<i>(Если пропустил сторис - зайди в хайлайт "ЧТО С РИЛС" в моей инсте или прочитай пост выше в тг канале)</i>

<b>Хорошая новость:</b>

Проблема не в тебе. И решение - не "постить больше" и не "снимать дорого".

Секрет в <b>точности попадания в цель 🎯</b> - и это работает даже на маленьких охватах.

<b>На эфире разберём:</b>

✔ Как сегментировать свою аудиторию, чтобы контент цеплял

✔ Какие форматы выбирать (и почему это важнее количества)

✔ Как создать свой узнаваемый образ

Это не про "лайфхаки" и "тренды". Это про систему, которая работала, работает сейчас и будет работать дальше - независимо от обновлений Meta.

<b>Тебе точно стоит прийти, если:</b>

- Не понимаешь, <i>что вообще снимать</i>
- Хочешь набирать подписчиков и охваты
- Хочешь получать продажи через контент (а не просто "делать контент")

🕒 <b>Осталось всего 30 минут!</b>

📍 <b>В моём Telegram-канале</b>

Увидимся на эфире ❤️

Юля`;

// ID пользователей, которые УЖЕ получили рассылку
// Замени этот массив на реальные ID из первой рассылки
const ALREADY_RECEIVED: number[] = [];

async function loadAlreadyReceived(): Promise<number[]> {
  const filePath = './broadcast_live_received.txt';
  
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ids = content.split('\n')
      .filter(line => line.trim())
      .map(id => parseInt(id.trim()));
    console.log(`📂 Загружено ${ids.length} ID уже получивших рассылку\n`);
    return ids;
  }
  
  console.log('📂 Файл с ID не найден, отправим всем\n');
  return [];
}

function saveReceivedId(userId: number) {
  const filePath = './broadcast_live_received.txt';
  fs.appendFileSync(filePath, `${userId}\n`);
}

async function sendToAdmin() {
  console.log('📤 Отправляю превью продолжения рассылки админу...\n');
  
  try {
    await bot.telegram.sendPhoto(ADMIN_ID, { source: IMAGE_PATH });
    await new Promise(resolve => setTimeout(resolve, 300));
    
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `<b>🧪 ПРЕВЬЮ ПРОДОЛЖЕНИЯ РАССЫЛКИ</b>\n\n${MESSAGE}`,
      { parse_mode: 'HTML' }
    );
    await new Promise(resolve => setTimeout(resolve, 300));
    
    await bot.telegram.sendMessage(
      ADMIN_ID,
      '👆 Продолжение рассылки (осталось 30 минут)\n\n' +
      '⚡ ОПТИМИЗАЦИЯ СКОРОСТИ:\n' +
      '- Паузы сокращены до 100-150мс\n' +
      '- Изображение и текст в одном сообщении\n' +
      '- Кнопка отдельно для скорости\n\n' +
      'Для запуска: npm run broadcast-live-30min',
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '📺 Посмотреть эфир', url: 'https://t.me/mozgi_yuli' }
          ]]
        }
      }
    );
    
    console.log('✅ Превью отправлено!\n');
    
  } catch (error) {
    console.error('❌ Ошибка отправки админу:', error);
  }
  
  process.exit(0);
}

async function sendBroadcast() {
  console.log('🚀 Продолжение рассылки "Прямой эфир" (осталось 30 минут)...\n');
  
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    console.log('✅ Подключено к базе данных\n');
  }
  
  // Загружаем ID тех, кто уже получил
  const alreadyReceived = await loadAlreadyReceived();
  
  // Получаем ВСЕХ пользователей
  const allUsers = await AppDataSource.query(`
    SELECT "userId", "firstName", "username"
    FROM users
    ORDER BY "userId"
  `);
  
  console.log(`📊 Всего пользователей в БД: ${allUsers.length}`);
  console.log(`✅ Уже получили рассылку: ${alreadyReceived.length}`);
  
  // Фильтруем - оставляем только тех, кто НЕ получил
  const users = allUsers.filter((user: any) => 
    !alreadyReceived.includes(user.userId)
  );
  
  console.log(`🎯 Нужно отправить: ${users.length}\n`);
  
  if (users.length === 0) {
    console.log('⚠️ Все уже получили рассылку!');
    await AppDataSource.destroy();
    return;
  }
  
  // Проверка БД
  if (allUsers.length < 100) {
    console.error('⚠️⚠️⚠️ ВНИМАНИЕ! ⚠️⚠️⚠️');
    console.error(`В базе только ${allUsers.length} пользователей!`);
    console.error('Рассылка НЕ будет запущена!');
    await AppDataSource.destroy();
    process.exit(1);
  }
  
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  const startTime = Date.now();
  
  console.log('⚡ ОПТИМИЗИРОВАННАЯ ОТПРАВКА:');
  console.log('- Изображение + текст в одном сообщении (caption)');
  console.log('- Паузы 100-150мс вместо 300мс');
  console.log('- Прогресс каждые 50 сообщений\n');
  
  for (const user of users) {
    try {
      // ОПТИМИЗАЦИЯ: отправляем фото с caption (текст) в одном сообщении
      await bot.telegram.sendPhoto(
        user.userId,
        { source: IMAGE_PATH },
        { 
          caption: MESSAGE,
          parse_mode: 'HTML'
        }
      );
      
      // Минимальная пауза
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Кнопку отдельно
      await bot.telegram.sendMessage(
        user.userId,
        '👇',
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '📺 Посмотреть эфир', url: 'https://t.me/mozgi_yuli' }
            ]]
          }
        }
      );
      
      sent++;
      saveReceivedId(user.userId);
      
      // Прогресс каждые 50 сообщений
      if (sent % 50 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        const speed = (sent / (Date.now() - startTime) * 1000 * 60).toFixed(0);
        console.log(`   📤 ${sent}/${users.length} | ${speed} сообщ/мин | ${elapsed} мин`);
      }
      
      // Пауза между пользователями (безопасность от флуд-контроля)
      await new Promise(resolve => setTimeout(resolve, 150));
      
    } catch (error: any) {
      failed++;
      const errorMsg = `User ${user.userId}: ${error.message}`;
      errors.push(errorMsg);
      
      if (error.code !== 403) {
        console.error(`   ❌ ${errorMsg}`);
      }
    }
  }
  
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  const avgSpeed = (sent / (Date.now() - startTime) * 1000 * 60).toFixed(0);
  
  // Сохраняем статистику
  const broadcastHistory = new BroadcastHistory();
  broadcastHistory.broadcastType = 'live_stream_reels_30min';
  broadcastHistory.totalSent = sent;
  broadcastHistory.totalAttempted = users.length;
  broadcastHistory.segmentStart = 0;
  broadcastHistory.segmentVideo1 = 0;
  broadcastHistory.notes = `Продолжение рассылки (30 мин). Уже получили: ${alreadyReceived.length}. Скорость: ${avgSpeed} сообщ/мин`;
  
  await AppDataSource.manager.save(broadcastHistory);
  
  // Отчет
  console.log('\n============================================================');
  console.log('📊 РАССЫЛКА ЗАВЕРШЕНА');
  console.log('============================================================');
  console.log(`✅ Отправлено: ${sent}/${users.length}`);
  console.log(`❌ Ошибок: ${failed}`);
  console.log(`⚡ Средняя скорость: ${avgSpeed} сообщений/минуту`);
  console.log(`⏱️  Общее время: ${totalTime} минут`);
  console.log(`📈 Успех: ${((sent / users.length) * 100).toFixed(1)}%`);
  console.log('============================================================\n');
  
  if (errors.length > 0 && errors.length <= 10) {
    console.log('Ошибки:');
    errors.forEach(err => console.log(`  - ${err}`));
  }
  
  // Уведомляем админа
  try {
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `✅ <b>Продолжение рассылки завершено</b>\n\n` +
      `📤 Отправлено: ${sent}/${users.length}\n` +
      `❌ Ошибок: ${failed}\n` +
      `⚡ Скорость: ${avgSpeed} сообщ/мин\n` +
      `⏱️ Время: ${totalTime} мин\n` +
      `📈 Успех: ${((sent / users.length) * 100).toFixed(1)}%\n\n` +
      `Уже получили в первой рассылке: ${alreadyReceived.length}`,
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    console.error('❌ Не удалось отправить уведомление админу');
  }
  
  await AppDataSource.destroy();
  process.exit(0);
}

const args = process.argv.slice(2);

if (args.includes('--send')) {
  sendBroadcast();
} else {
  sendToAdmin();
}
