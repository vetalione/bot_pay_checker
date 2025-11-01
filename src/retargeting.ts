import 'reflect-metadata';
import { initializeDatabase } from './database';
import { UserService } from './userService';
import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN!);

/**
 * Скрипт для запуска retargeting кампаний
 * 
 * Использование:
 *   npx ts-node src/retargeting.ts <campaign_type>
 * 
 * Типы кампаний:
 *   - stuck_video1: Напоминание тем, кто застрял на video1
 *   - stuck_video2: Напоминание тем, кто застрял на video2
 *   - abandoned_payment: Напоминание тем, кто не завершил оплату
 *   - stats: Показать статистику воронки
 */

async function main() {
  const campaignType = process.argv[2];

  if (!campaignType) {
    console.log(`
Использование: npx ts-node src/retargeting.ts <campaign_type>

Доступные кампании:
  stuck_video1         - Напоминание застрявшим на video1 (24ч+)
  stuck_video2         - Напоминание застрявшим на video2 (24ч+)
  abandoned_payment    - Напоминание тем, кто не завершил оплату (24ч+)
  stats                - Показать статистику воронки
  conversion           - Показать конверсию в оплату

Примеры:
  npm run retargeting stuck_video1
  npm run retargeting stats
    `);
    process.exit(0);
  }

  // Инициализируем БД
  await initializeDatabase();
  console.log('✅ База данных подключена');

  const userService = new UserService();

  switch (campaignType) {
    case 'stuck_video1':
      await campaignStuckVideo1(userService);
      break;

    case 'stuck_video2':
      await campaignStuckVideo2(userService);
      break;

    case 'abandoned_payment':
      await campaignAbandonedPayment(userService);
      break;

    case 'stats':
      await showStats(userService);
      break;

    case 'conversion':
      await showConversion(userService);
      break;

    default:
      console.error(`❌ Неизвестная кампания: ${campaignType}`);
      process.exit(1);
  }

  process.exit(0);
}

/**
 * Кампания: Напоминание застрявшим на video1
 */
async function campaignStuckVideo1(userService: UserService) {
  console.log('🔍 Ищем пользователей, застрявших на video1...');

  const users = await userService.getUsersStuckAtStep('video1', 24);

  console.log(`📊 Найдено пользователей: ${users.length}`);

  if (users.length === 0) {
    console.log('✅ Нет пользователей для этой кампании');
    return;
  }

  const message = `
👋 Привет!

Я заметила, что ты посмотрел первое видео, но не продолжил.

У меня есть ещё 2 крутых видео, где я показываю:
🎯 Как я получаю 9 звонков каждый день
🎯 Секретные методы для взрывного роста

Продолжишь смотреть?
  `;

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await bot.telegram.sendMessage(user.userId, message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '▶️ Смотреть дальше', callback_data: 'continue_watching' }]
          ]
        }
      });
      sent++;
      console.log(`✅ Отправлено: ${user.userId} (@${user.username})`);

      // Логируем действие
      await userService.logAction(user.userId, 'retargeting_video1', user.currentStep);

      // Delay чтобы не попасть в rate limit
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      failed++;
      console.error(`❌ Ошибка для ${user.userId}:`, error);
    }
  }

  console.log(`\n📈 Результаты:`);
  console.log(`   Отправлено: ${sent}`);
  console.log(`   Ошибок: ${failed}`);
}

/**
 * Кампания: Напоминание застрявшим на video2
 */
async function campaignStuckVideo2(userService: UserService) {
  console.log('🔍 Ищем пользователей, застрявших на video2...');

  const users = await userService.getUsersStuckAtStep('video2', 24);

  console.log(`📊 Найдено пользователей: ${users.length}`);

  if (users.length === 0) {
    console.log('✅ Нет пользователей для этой кампании');
    return;
  }

  const message = `
🎁 Ты совсем близко!

Осталось последнее видео, где я раскрываю главный секрет.

После него ты сможешь забрать своё преимущество! 🚀
  `;

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await bot.telegram.sendMessage(user.userId, message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Готов!', callback_data: 'ready_for_more' }]
          ]
        }
      });
      sent++;
      console.log(`✅ Отправлено: ${user.userId} (@${user.username})`);

      await userService.logAction(user.userId, 'retargeting_video2', user.currentStep);
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      failed++;
      console.error(`❌ Ошибка для ${user.userId}:`, error);
    }
  }

  console.log(`\n📈 Результаты:`);
  console.log(`   Отправлено: ${sent}`);
  console.log(`   Ошибок: ${failed}`);
}

/**
 * Кампания: Напоминание тем, кто не завершил оплату
 */
async function campaignAbandonedPayment(userService: UserService) {
  console.log('🔍 Ищем пользователей с незавершённой оплатой...');

  const users = await userService.getUsersAbandonedPayment(24);

  console.log(`📊 Найдено пользователей: ${users.length}`);

  if (users.length === 0) {
    console.log('✅ Нет пользователей для этой кампании');
    return;
  }

  const message = `
💰 Не упусти свой шанс!

Ты был в шаге от того, чтобы получить доступ к моему методу.

Завершишь оплату сейчас? 

P.S. Количество мест ограничено! ⏰
  `;

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await bot.telegram.sendMessage(user.userId, message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💳 Оплатить', callback_data: 'get_advantage' }]
          ]
        }
      });
      sent++;
      console.log(`✅ Отправлено: ${user.userId} (@${user.username})`);

      await userService.logAction(user.userId, 'retargeting_payment', user.currentStep);
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      failed++;
      console.error(`❌ Ошибка для ${user.userId}:`, error);
    }
  }

  console.log(`\n📈 Результаты:`);
  console.log(`   Отправлено: ${sent}`);
  console.log(`   Ошибок: ${failed}`);
}

/**
 * Показать статистику воронки
 */
async function showStats(userService: UserService) {
  console.log('📊 Статистика воронки:\n');

  const stats = await userService.getFunnelStats();

  Object.entries(stats).forEach(([step, count]) => {
    console.log(`   ${step.padEnd(20)} ${count} пользователей`);
  });

  console.log('');
}

/**
 * Показать конверсию в оплату
 */
async function showConversion(userService: UserService) {
  console.log('💰 Конверсия в оплату:\n');

  const { total, paid, rate } = await userService.getConversionRate();

  console.log(`   Всего пользователей:  ${total}`);
  console.log(`   Оплатили:             ${paid}`);
  console.log(`   Конверсия:            ${rate.toFixed(2)}%`);
  console.log('');
}

main().catch(error => {
  console.error('❌ Ошибка:', error);
  process.exit(1);
});
