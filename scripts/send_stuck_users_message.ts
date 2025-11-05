/**
 * 🚀 РАЗОВАЯ РАССЫЛКА для застрявших пользователей
 * 
 * Отправляет сообщение пользователям которые застряли на start или video1
 * и предлагает им сразу перейти к оплате.
 * 
 * ⚠️ ВАЖНО: Этот скрипт запускается ОДИН РАЗ вручную!
 * Не добавляйте его в автоматические процессы!
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

async function sendStuckUsersMessage() {
  try {
    console.log('🚀 Запуск разовой рассылки для застрявших пользователей...\n');

    // Подключаемся к базе данных
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('✅ Подключение к базе данных установлено\n');
    }

    const userRepository = AppDataSource.getRepository(User);

    // Находим пользователей застрявших на start или video1
    const stuckUsers = await userRepository.find({
      where: [
        { currentStep: 'start', hasPaid: false },
        { currentStep: 'video1', hasPaid: false }
      ]
    });

    console.log(`📊 Найдено пользователей для рассылки: ${stuckUsers.length}`);
    console.log(`   - Застряли на start: ${stuckUsers.filter(u => u.currentStep === 'start').length}`);
    console.log(`   - Застряли на video1: ${stuckUsers.filter(u => u.currentStep === 'video1').length}\n`);

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
        await bot.telegram.sendMessage(
          user.userId,
          'Ладно, ладно, я поняла! 😁 Для самых нетерпеливых вот ссылка сразу на оплату продукта без прелюдий:',
          Markup.inlineKeyboard([
            [Markup.button.callback('💵 Оплатить рублями (2000 ₽)', 'pay_rub_tribute')],
            [Markup.button.callback('� Иностранные карты (22€)', 'pay_eur_tribute')],
            [Markup.button.callback('💴 Оплатить гривнами (1050 ₴)', 'pay_uah')]
          ])
        );

        successCount++;
        console.log(`✅ [${successCount}/${stuckUsers.length}] Отправлено пользователю ${user.userId} (@${user.username || 'no_username'}) [${user.currentStep}]`);

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
      errors.forEach(({ userId, error }) => {
        console.log(`   - Пользователь ${userId}: ${error}`);
      });
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
sendStuckUsersMessage();
