/**
 * Отправка тестового сообщения админу для проверки
 */

import { Telegraf, Markup } from 'telegraf';
import * as dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN!;
const bot = new Telegraf(BOT_TOKEN);

async function testToAdmin() {
  const adminId = 278263484; // Ваш ID

  try {
    console.log('📤 Отправка ТЕСТА рассылки админу...\n');
    
    // Сообщение для waiting_receipt
    await bot.telegram.sendMessage(
      adminId,
      '🧪 ТЕСТ #1: Сообщение для waiting_receipt\n\n' +
      'Vitaliy, у тебя не получилось оплатить? Теперь подойдет карта любого банка, любой страны - даже кредитная. Проверь еще раз!',
      Markup.inlineKeyboard([
        [Markup.button.callback('💵 Оплатить рублями (2000 ₽)', 'pay_rub_tribute')],
        [Markup.button.callback('💳 Иностранные карты (22€)', 'pay_eur_tribute')],
        [Markup.button.callback('💴 Оплатить гривнами (1050 ₴)', 'pay_uah')]
      ])
    );

    console.log('✅ Сообщение #1 (waiting_receipt) отправлено\n');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Сообщение для payment_choice
    await bot.telegram.sendMessage(
      adminId,
      '🧪 ТЕСТ #2: Сообщение для payment_choice\n\n' +
      'Vitaliy, ты уже совсем близко! 🎯\n\n' +
      'Осталось только выбрать удобный способ оплаты. Подойдет карта любого банка, любой страны - даже кредитная!',
      Markup.inlineKeyboard([
        [Markup.button.callback('💵 Оплатить рублями (2000 ₽)', 'pay_rub_tribute')],
        [Markup.button.callback('💳 Иностранные карты (22€)', 'pay_eur_tribute')],
        [Markup.button.callback('💴 Оплатить гривнами (1050 ₴)', 'pay_uah')]
      ])
    );

    console.log('✅ Сообщение #2 (payment_choice) отправлено\n');
    console.log('📱 Проверьте бот - вы должны получить 2 тестовых сообщения!\n');

  } catch (error: any) {
    console.error('❌ Ошибка:', error.message);
  }
}

testToAdmin();
