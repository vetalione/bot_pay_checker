/**
 * 📢 МАССОВАЯ РАССЫЛКА: Бот снова работает
 * 
 * Отправляет сообщение всем пользователям которые когда-либо запускали бота
 * Сообщение: "Бот снова работает! Напишите /start"
 * 
 * ⚠️ ВАЖНО: Этот скрипт запускается ОДИН РАЗ вручную!
 */

import { Telegraf } from 'telegraf';
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

async function sendBotRestoredMessage() {
  try {
    console.log('📢 Запуск массовой рассылки "Бот снова работает"...\n');

    // Подключаемся к базе данных
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('✅ Подключение к базе данных установлено\n');
    }

    const userRepository = AppDataSource.getRepository(User);

    // Находим ВСЕХ пользователей которые когда-либо стартовали бота
    const allUsers = await userRepository.find({
      order: { createdAt: 'DESC' }
    });

    console.log(`📊 Найдено пользователей для рассылки: ${allUsers.length}`);
    console.log(`   - Всего уникальных пользователей: ${allUsers.length}\n`);

    if (allUsers.length === 0) {
      console.log('ℹ️  Нет пользователей для рассылки');
      await AppDataSource.destroy();
      return;
    }

    // Подтверждение перед отправкой
    console.log('⚠️  ВНИМАНИЕ! Вы собираетесь отправить сообщение ВСЕМ пользователям!');
    console.log(`   Количество: ${allUsers.length} пользователей\n`);
    console.log('   Сообщение: "Бот снова работает! Напишите /start"\n');
    
    // В продакшене можно добавить подтверждение
    // Для автоматического запуска закомментируйте следующие строки:
    
    // const readline = require('readline').createInterface({
    //   input: process.stdin,
    //   output: process.stdout
    // });
    
    // const answer = await new Promise(resolve => {
    //   readline.question('Продолжить? (yes/no): ', resolve);
    // });
    
    // readline.close();
    
    // if (answer.toLowerCase() !== 'yes') {
    //   console.log('❌ Рассылка отменена пользователем');
    //   await AppDataSource.destroy();
    //   return;
    // }

    // Статистика отправки
    let successCount = 0;
    let errorCount = 0;
    const errors: { userId: number; error: string }[] = [];

    console.log('📤 Начинаем отправку сообщений...\n');

    for (const user of allUsers) {
      try {
        await bot.telegram.sendMessage(
          user.userId,
          'Бот снова работает! Напишите /start'
        );

        successCount++;
        console.log(`✅ [${successCount + errorCount}/${allUsers.length}] Отправлено пользователю ${user.userId} (@${user.username || 'no_username'})`);

        // Задержка между сообщениями: 50ms (безопасно для Telegram)
        // Telegram лимит: ~30 сообщений/секунду
        // При 50ms: 20 сообщений/секунду
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (error: any) {
        errorCount++;
        const errorMessage = error.message || String(error);
        errors.push({ userId: user.userId, error: errorMessage });
        
        console.error(`❌ [${successCount + errorCount}/${allUsers.length}] Ошибка для пользователя ${user.userId}: ${errorMessage}`);

        // Если ошибка rate limit - увеличиваем задержку
        if (errorMessage.includes('Too Many Requests') || errorMessage.includes('429')) {
          console.log('⏸️  Rate limit достигнут, ждем 2 секунды...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 ИТОГИ РАССЫЛКИ:');
    console.log('='.repeat(60));
    console.log(`✅ Успешно отправлено: ${successCount}`);
    console.log(`❌ Ошибок: ${errorCount}`);
    console.log(`📈 Процент успеха: ${((successCount / allUsers.length) * 100).toFixed(1)}%`);

    if (errors.length > 0) {
      console.log('\n⚠️  ТИПЫ ОШИБОК:');
      
      // Группируем ошибки по типам
      const errorTypes: { [key: string]: number } = {};
      errors.forEach(({ error }) => {
        const errorType = error.includes('blocked') ? 'Заблокировали бота' :
                         error.includes('deactivated') ? 'Аккаунт деактивирован' :
                         error.includes('not found') ? 'Пользователь не найден' :
                         error.includes('Too Many Requests') ? 'Rate limit' :
                         'Другие ошибки';
        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      });

      Object.entries(errorTypes).forEach(([type, count]) => {
        console.log(`   - ${type}: ${count}`);
      });

      // Показываем первые 10 ошибок
      console.log('\n   Первые 10 ошибок:');
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
sendBotRestoredMessage();
