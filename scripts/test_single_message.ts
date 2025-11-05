/**
 * Тестовая отправка сообщения одному пользователю для проверки
 */

import { Telegraf, Markup } from 'telegraf';
import * as dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN!;
const bot = new Telegraf(BOT_TOKEN);

async function testMessage() {
  const testUserId = 209384876; // ekaterina_feell
  const name = 'Екатерина';

  try {
    console.log(`📤 Отправка ТЕСТОВОГО сообщения пользователю ${testUserId} (@ekaterina_feell)\n`);
    
    await bot.telegram.sendMessage(
      testUserId,
      `${name}, у тебя не получилось оплатить? Теперь подойдет карта любого банка, любой страны - даже кредитная. Проверь еще раз!`,
      Markup.inlineKeyboard([
        [Markup.button.callback('💵 Оплатить рублями (2000 ₽)', 'pay_rub_tribute')],
        [Markup.button.callback('💳 Иностранные карты (22€)', 'pay_eur_tribute')],
        [Markup.button.callback('💴 Оплатить гривнами (1050 ₴)', 'pay_uah')]
      ])
    );

    console.log('✅ Сообщение успешно отправлено!');
    console.log('\n📋 Проверьте в боте:');
    console.log('   - Текст сообщения правильный?');
    console.log('   - 3 кнопки отображаются?');
    console.log('   - Кнопки кликабельные?\n');

  } catch (error: any) {
    console.error('❌ Ошибка:', error.message);
  }
}

testMessage();
