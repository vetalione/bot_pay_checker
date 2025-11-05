/**
 * 🚀 РАЗОВАЯ РАССЫЛКА для застрявших на waiting_receipt
 * 
 * Отправляет сообщение пользователям которые:
 * - Выбрали способ оплаты (currency != NULL)
 * - Застряли на waiting_receipt (не отправили квитанцию)
 * - Не оплатили (hasPaid = false)
 * 
 * Предлагает попробовать другие способы оплаты (RUB Tribute, EUR Tribute, UAH)
 * 
 * ⚠️ ВАЖНО: Этот скрипт запускается ОДИН РАЗ вручную!
 */

import { Telegraf, Markup } from 'telegraf';
import { AppDataSource } from '../src/database';
import { User } from '../src/entities/User';
import * as dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не найден в .env файле!');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

async function sendWaitingReceiptMessage() {
  try {
    console.log('🚀 Запуск разовой рассылки для застрявших на waiting_receipt...\n');

    // Подключаемся к базе данных
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('✅ Подключение к базе данных установлено\n');
    }

    const userRepository = AppDataSource.getRepository(User);

    // Находим пользователей застрявших на waiting_receipt
    const stuckUsers = await userRepository
      .createQueryBuilder('user')
      .where('user.currentStep = :step', { step: 'waiting_receipt' })
      .andWhere('user.hasPaid = :paid', { paid: false })
      .andWhere('user.currency IS NOT NULL')
      .getMany();

    console.log(`📊 Найдено пользователей для рассылки: ${stuckUsers.length}`);
    console.log(`   - Выбрали RUB: ${stuckUsers.filter(u => u.currency === 'RUB').length}`);
    console.log(`   - Выбрали UAH: ${stuckUsers.filter(u => u.currency === 'UAH').length}\n`);

    if (stuckUsers.length === 0) {
      console.log('ℹ️  Нет пользователей для рассылки');
      await AppDataSource.destroy();
      return;
    }

    // Статистика отправки
    let successCount = 0;
    let errorCount = 0;
    const errors: { userId: number; error: string }[] = [];

    console.log('📤 Начинаем отправку сообщений...\n');

    for (const user of stuckUsers) {
      try {
        // Формируем имя (firstName или username или "друг")
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

        successCount++;
        console.log(`✅ [${successCount}/${stuckUsers.length}] Отправлено пользователю ${user.userId} (@${user.username || 'no_username'}) [${user.currency}] - Имя: ${name}`);

        // Задержка между сообщениями чтобы не попасть под лимиты Telegram
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms между сообщениями

      } catch (error: any) {
        errorCount++;
        const errorMessage = error.message || String(error);
        errors.push({ userId: user.userId, error: errorMessage });
        
        console.error(`❌ [${successCount + errorCount}/${stuckUsers.length}] Ошибка для пользователя ${user.userId}: ${errorMessage}`);

        // Продолжаем даже если ошибка (пользователь мог заблокировать бота)
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 ИТОГИ РАССЫЛКИ:');
    console.log('='.repeat(60));
    console.log(`✅ Успешно отправлено: ${successCount}`);
    console.log(`❌ Ошибок: ${errorCount}`);
    console.log(`📈 Процент успеха: ${((successCount / stuckUsers.length) * 100).toFixed(1)}%`);

    if (errors.length > 0) {
      console.log('\n⚠️  ОШИБКИ ПРИ ОТПРАВКЕ:');
      errors.slice(0, 10).forEach(({ userId, error }) => {
        console.log(`   - Пользователь ${userId}: ${error}`);
      });
      if (errors.length > 10) {
        console.log(`   ... и еще ${errors.length - 10} ошибок`);
      }
    }

    console.log('='.repeat(60) + '\n');

    // Закрываем соединение с БД
    await AppDataSource.destroy();
    console.log('✅ Соединение с базой данных закрыто');
    console.log('🎉 Рассылка завершена!\n');

  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(1);
  }
}

// Запускаем скрипт
sendWaitingReceiptMessage();
