import * as dotenv from 'dotenv';
// ВАЖНО: загружаем .env ДО импорта других модулей
dotenv.config();

import { Telegraf, Markup } from 'telegraf';
import { AppDataSource } from './src/database';
import { User } from './src/entities/User';
import { BroadcastHistory } from './src/entities/BroadcastHistory';

const bot = new Telegraf(process.env.BOT_TOKEN!);

// Сообщение для рассылки
const BROADCAST_MESSAGE = `Привет 👋

Помнишь промты для Reels? Сейчас у меня для тебя кое-что посерьезнее.

Reels Camp - последний живой поток. Старт в среду.

Это 30 дней, где я веду тебя за руку: ты снимаешь → я разбираю каждое видео → правлю хуки и сценарии → ты получаешь систему контента, которая работает 24/7.

Что внутри:

- 8 практических уроков
- Личные разборы твоих роликов
- Упаковка архетипа + сегментация аудитории
- Стратегия: из Reels → в заявки и продажи

Девочки с прошлого потока снимали первый раз - сейчас их ролики собирают тысячи просмотров.

Цена: $450 → $380 для участников бота

Осталось: 3 места

Дальше я больше не веду кэмпы вживую - записываю курс. Если интересно - пиши мне сейчас чтобы забрать место.`;

const BUTTON = Markup.inlineKeyboard([
  Markup.button.url('💬 Написать Юле', 'https://t.me/JFilipenko')
]);

const IMAGE_PATH = './camp_case.jpeg';

async function sendBroadcast() {
  console.log('🔄 Начинаю рассылку Reels Camp...\n');

  try {
    // Подключаемся к БД
    console.log('🔌 DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');
    await AppDataSource.initialize();
    console.log('✅ База данных подключена\n');

    // Получаем ВСЕХ пользователей
    const userRepository = AppDataSource.getRepository(User);
    
    // Сначала проверяем общее количество
    const totalCount = await userRepository.count();
    console.log(`📊 Всего пользователей в БД: ${totalCount}\n`);
    
    const allUsers = await userRepository.find({
      select: ['userId', 'username', 'firstName']
    });
    
    console.log(`📥 Получено пользователей из запроса: ${allUsers.length}\n`);

    console.log(`👥 Найдено пользователей: ${allUsers.length}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let sent = 0;
    let failed = 0;
    const errors: { [key: string]: number } = {};

    // Отправляем каждому пользователю
    for (let i = 0; i < allUsers.length; i++) {
      const user = allUsers[i];
      const progress = `[${i + 1}/${allUsers.length}]`;

      try {
        await bot.telegram.sendPhoto(
          user.userId,
          { source: IMAGE_PATH },
          {
            caption: BROADCAST_MESSAGE,
            reply_markup: BUTTON.reply_markup,
            parse_mode: undefined
          }
        );
        
        sent++;
        console.log(`✅ ${progress} Отправлено: @${user.username || user.userId}`);
        
        // Задержка 50ms между сообщениями (20 msg/sec - безопасно для Telegram)
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (error: any) {
        failed++;
        const errorType = error.response?.description || error.message || 'Unknown error';
        errors[errorType] = (errors[errorType] || 0) + 1;
        
        console.log(`❌ ${progress} Ошибка: @${user.username || user.userId} - ${errorType}`);

        // Если rate limit (429) - ждем 1 секунду
        if (error.response?.error_code === 429) {
          const retryAfter = error.response.parameters?.retry_after || 1;
          console.log(`⏸️  Rate limit! Жду ${retryAfter} секунд...\n`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        }
      }

      // Каждые 50 сообщений - показываем прогресс
      if ((i + 1) % 50 === 0) {
        console.log(`\n📊 Прогресс: ${i + 1}/${allUsers.length} (${sent} успешно, ${failed} ошибок)\n`);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🎉 Рассылка завершена!\n');
    console.log('📊 РЕЗУЛЬТАТЫ:');
    console.log(`   Всего пользователей: ${allUsers.length}`);
    console.log(`   ✅ Отправлено: ${sent}`);
    console.log(`   ❌ Ошибок: ${failed}`);
    console.log(`   📈 Success rate: ${((sent / allUsers.length) * 100).toFixed(1)}%`);

    if (Object.keys(errors).length > 0) {
      console.log('\n❌ Типы ошибок:');
      Object.entries(errors)
        .sort((a, b) => b[1] - a[1])
        .forEach(([error, count]) => {
          console.log(`   • ${error}: ${count}`);
        });
    }

    // Сохраняем результат в БД
    try {
      const broadcastRepo = AppDataSource.getRepository(BroadcastHistory);
      await broadcastRepo.save({
        broadcastType: 'reels_camp',
        segmentStart: 0,
        segmentVideo1: 0,
        segmentVideo2: 0,
        segmentVideo3: 0,
        segmentPaymentChoice: 0,
        segmentWaitingReceipt: 0,
        totalAttempted: allUsers.length,
        totalSent: sent,
        totalFailed: failed,
        notes: 'Reels Camp announcement - разовая рассылка всем пользователям. Фото camp_case.jpeg + кнопка @JFilipenko'
      });
      console.log('\n✅ Результат сохранен в базу данных');
    } catch (dbError) {
      console.error('\n⚠️  Ошибка сохранения в БД:', dbError);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
    process.exit(0);
  }
}

// Запускаем
sendBroadcast();
