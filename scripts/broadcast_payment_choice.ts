/**
 * 🚀 РАССЫЛКА для payment_choice (горячие!)
 * 
 * 19 пользователей посмотрели все видео но не выбрали способ оплаты
 */

import { Telegraf, Markup } from 'telegraf';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN!;
const bot = new Telegraf(BOT_TOKEN);

async function broadcast() {
  const client = new Client({
    connectionString: 'postgresql://postgres:tbswlvQbgFmiOdcJPKyAckRuSmvrYxxw@nozomi.proxy.rlwy.net:35365/railway',
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🚀 Рассылка для payment_choice\n');

    await client.connect();
    console.log('✅ Подключено к БД:', (await client.query('SELECT current_database()')).rows[0].current_database);

    const result = await client.query(`
      SELECT "userId", username, "firstName"
      FROM users 
      WHERE "currentStep" = 'payment_choice'
        AND "hasPaid" = false
      ORDER BY "createdAt" DESC
    `);

    const users = result.rows;
    console.log(`\n📊 Найдено пользователей: ${users.length}\n`);

    if (users.length === 0) {
      console.log('ℹ️  Нет пользователей для рассылки');
      await client.end();
      return;
    }

    let success = 0;
    let errors = 0;

    console.log('📤 Отправка сообщений...\n');

    for (const user of users) {
      try {
        const name = user.firstName || user.username || 'друг';
        
        await bot.telegram.sendMessage(
          user.userId,
          `${name}, ты уже совсем близко! 🎯

Осталось только выбрать удобный способ оплаты. Подойдет карта любого банка, любой страны - даже кредитная!`,
          Markup.inlineKeyboard([
            [Markup.button.callback('💵 Оплатить рублями (4000 ₽)', 'pay_rub_tribute')],
            [Markup.button.callback('💳 Иностранные карты (44€)', 'pay_eur_tribute')],
            [Markup.button.callback('💴 Оплатить гривнами (2100 ₴)', 'pay_uah')]
          ])
        );

        success++;
        console.log(`✅ [${success}/${users.length}] @${user.username || user.userId}`);

        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        errors++;
        console.error(`❌ [${success + errors}/${users.length}] @${user.username || user.userId}: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Успешно: ${success}`);
    console.log(`❌ Ошибок: ${errors}`);
    console.log(`📈 Успех: ${((success / users.length) * 100).toFixed(1)}%`);
    console.log('='.repeat(50) + '\n');

    await client.end();
    console.log('✅ Рассылка завершена!\n');

  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    if (client) {
      await client.end();
    }
    process.exit(1);
  }
}

broadcast();
