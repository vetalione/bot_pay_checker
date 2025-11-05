/**
 * 🚀 РАССЫЛКА для waiting_receipt (горячие клиенты!)
 * 
 * 72 пользователя выбрали оплату но не прислали квитанцию
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
    console.log('🚀 Рассылка для waiting_receipt\n');

    await client.connect();
    console.log('✅ Подключено к БД:', (await client.query('SELECT current_database()')).rows[0].current_database);

    // Находим пользователей waiting_receipt
    const result = await client.query(`
      SELECT "userId", username, "firstName", currency
      FROM users 
      WHERE "currentStep" = 'waiting_receipt' 
        AND "hasPaid" = false
      ORDER BY "createdAt" DESC
    `);

    const users = result.rows;

    console.log(`\n📊 Найдено пользователей: ${users.length}`);
    console.log(`   - RUB: ${users.filter((u: any) => u.currency === 'RUB').length}`);
    console.log(`   - UAH: ${users.filter((u: any) => u.currency === 'UAH').length}\n`);

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
          `${name}, у тебя не получилось оплатить? Теперь подойдет карта любого банка, любой страны - даже кредитная. Проверь еще раз!`,
          Markup.inlineKeyboard([
            [Markup.button.callback('💵 Оплатить рублями (2000 ₽)', 'pay_rub_tribute')],
            [Markup.button.callback('💳 Иностранные карты (22€)', 'pay_eur_tribute')],
            [Markup.button.callback('💴 Оплатить гривнами (1050 ₴)', 'pay_uah')]
          ])
        );

        success++;
        console.log(`✅ [${success}/${users.length}] @${user.username || user.userId} [${user.currency}]`);

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
