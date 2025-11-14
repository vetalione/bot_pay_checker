import * as dotenv from 'dotenv';
// ВАЖНО: загружаем .env ДО импорта других модулей
dotenv.config();

import { Telegraf, Markup } from 'telegraf';
import { AppDataSource } from './src/database';
import { User } from './src/entities/User';
import { BroadcastHistory } from './src/entities/BroadcastHistory';

const bot = new Telegraf(process.env.BOT_TOKEN!);
const IMAGE_PATH = './black friday.jpg';

// Функция определения пола по имени (простая эвристика)
function detectGender(firstName: string | undefined): 'male' | 'female' | 'unknown' {
  if (!firstName) return 'unknown';
  
  const name = firstName.toLowerCase().trim();
  
  // Женские окончания (русские/украинские имена)
  const femaleEndings = ['а', 'я', 'на', 'ла', 'ка', 'ша', 'ся'];
  // Исключения - мужские имена на 'а'
  const maleExceptions = ['никита', 'илья', 'савва', 'данила', 'данiла', 'миша', 'саша', 'женя'];
  
  // Проверяем исключения
  if (maleExceptions.includes(name)) {
    return 'male';
  }
  
  // Проверяем окончания
  for (const ending of femaleEndings) {
    if (name.endsWith(ending)) {
      return 'female';
    }
  }
  
  // Если не попали в женские - скорее всего мужское
  return 'male';
}

// Функция генерации сообщения с учётом пола
function generateMessage(firstName: string | undefined, gender: 'male' | 'female' | 'unknown'): string {
  const name = firstName || 'друг';
  
  // Версия для женщин (по умолчанию)
  const femaleVersion = `${name}, Привет! 👋 У меня для тебя две новости ❤️

Сегодня <b>Чёрная Пятница</b>, и я кое-что для тебя приготовила…

🔥 <b>Пожизненный доступ за $25</b> — только 72 часа
Потом промты, карта форматов, воркбук и чат станут частью клуба по подписке $30/мес.

Мы расширяем материалы и чат до клуба "<b>Reels Мастера</b>": разборы, обновления каждую неделю, комьюнити, мастер-классы — контента становится больше, и цена растёт.

Но в честь Чёрной Пятницы и потому что ты уже интересовалась продуктом, <b>за тобой остаётся старая цена ещё 72 часа.</b>

💎 <b>$25 один раз</b> → и пожизненно внутри:

📊 Интерактивная карта форматов съёмки рилс (34 шт)
🤖 7 промтов для съёмки рилс: Расшифровка Архетипа, Определение ЦА, Генерация 10 идей, Апгрейд сценария, Генератор СТА, Генератор хуков, Генератор подписей
📈 Воркбук-трекер на 30 дней: от 0 до 1000 подписчиков
💬 Доступ в закрытое коммьюнити где будут эфиры и разборы от меня, новые промты, новости алгоритмов, приглашенные эксперты и многое другое

✅ <b>Один платёж. Никаких подписок. Навсегда.</b>

⏰ Через 72 часа — только подписка от $90.
<b>Сейчас — лучший момент забрать себе пожизненный доступ.</b>`;

  // Версия для мужчин
  const maleVersion = `${name}, Привет! 👋 У меня для тебя две новости ❤️

Сегодня <b>Чёрная Пятница</b>, и я кое-что для тебя приготовила…

🔥 <b>Пожизненный доступ за $25</b> — только 72 часа
Потом промты, карта форматов, воркбук и чат станут частью клуба по подписке $30/мес.

Мы расширяем материалы и чат до клуба "<b>Reels Мастера</b>": разборы, обновления каждую неделю, комьюнити, мастер-классы — контента становится больше, и цена растёт.

Но в честь Чёрной Пятницы и потому что ты уже интересовался продуктом, <b>за тобой остаётся старая цена ещё 72 часа.</b>

💎 <b>$25 один раз</b> → и пожизненно внутри:

📊 Интерактивная карта форматов съёмки рилс (34 шт)
🤖 7 промтов для съёмки рилс: Расшифровка Архетипа, Определение ЦА, Генерация 10 идей, Апгрейд сценария, Генератор СТА, Генератор хуков, Генератор подписей
📈 Воркбук-трекер на 30 дней: от 0 до 1000 подписчиков
💬 Доступ в закрытое коммьюнити где будут эфиры и разборы от меня, новые промты, новости алгоритмов, приглашенные эксперты и многое другое

✅ <b>Один платёж. Никаких подписок. Навсегда.</b>

⏰ Через 72 часа — только подписка от $90.
<b>Сейчас — лучший момент забрать себе пожизненный доступ.</b>`;

  return gender === 'male' ? maleVersion : femaleVersion;
}

async function sendBroadcast() {
  console.log('🔥 Начинаю Black Friday рассылку...\n');

  try {
    // Подключаемся к БД
    console.log('🔌 DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');
    await AppDataSource.initialize();
    console.log('✅ База данных подключена\n');

    // Получаем пользователей которые НЕ оплатили И НЕ в friends
    const userRepository = AppDataSource.getRepository(User);
    
    // Сначала проверяем общее количество
    const totalCount = await userRepository.count();
    console.log(`📊 Всего пользователей в БД: ${totalCount}`);
    
    const paidCount = await userRepository.count({ where: { hasPaid: true } });
    console.log(`💰 Оплативших: ${paidCount}`);
    
    // Считаем friends (они в отдельной таблице, но мы их отфильтруем по userId)
    const friendsCount = await AppDataSource.query(`SELECT COUNT(*) as count FROM friends`);
    console.log(`👥 Friends: ${friendsCount[0].count}`);
    
    // Получаем всех userId из friends
    const friendsData = await AppDataSource.query(`SELECT "userId" FROM friends`);
    const friendsIds = friendsData.map((f: any) => f.userId);
    
    console.log(`\n🎯 Целевая аудитория: все кто НЕ оплатил и НЕ friend\n`);
    
    // Получаем целевых пользователей
    const targetUsers = await userRepository
      .createQueryBuilder('user')
      .where('user.hasPaid = :hasPaid', { hasPaid: false })
      .andWhere(friendsIds.length > 0 ? 'user.userId NOT IN (:...friendsIds)' : '1=1', { friendsIds })
      .select(['user.userId', 'user.username', 'user.firstName', 'user.currentStep'])
      .getMany();
    
    // Добавляем админа в список получателей
    const ADMIN_ID = 278263484;
    const adminUser = await userRepository.findOne({ 
      where: { userId: ADMIN_ID },
      select: ['userId', 'username', 'firstName', 'currentStep']
    });
    
    if (adminUser) {
      // Проверяем что админ ещё не в списке
      const adminExists = targetUsers.some(u => u.userId === ADMIN_ID);
      if (!adminExists) {
        targetUsers.push(adminUser);
        console.log(`✅ Админ @${adminUser.username} добавлен в список получателей\n`);
      }
    }

    console.log(`📥 Найдено целевых пользователей: ${targetUsers.length}\n`);
    
    // Статистика по currentStep
    const stepStats: { [key: string]: number } = {};
    targetUsers.forEach(u => {
      stepStats[u.currentStep] = (stepStats[u.currentStep] || 0) + 1;
    });
    
    console.log('📍 Распределение по этапам:');
    Object.entries(stepStats).forEach(([step, count]) => {
      console.log(`   ${step}: ${count} чел`);
    });
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let sent = 0;
    let failed = 0;
    let maleCount = 0;
    let femaleCount = 0;
    const errors: { [key: string]: number } = {};

    // Отправляем каждому пользователю
    for (let i = 0; i < targetUsers.length; i++) {
      const user = targetUsers[i];
      const progress = `[${i + 1}/${targetUsers.length}]`;

      try {
        // Определяем пол
        const gender = detectGender(user.firstName);
        if (gender === 'male') maleCount++;
        if (gender === 'female') femaleCount++;
        
        // Генерируем сообщение
        const message = generateMessage(user.firstName, gender);
        
        // Создаём inline кнопку которая триггерит action 'choose_payment_method'
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('💎 Забрать доступ за $25', 'black_friday_payment')]
        ]);
        
        // Отправляем фото БЕЗ caption
        await bot.telegram.sendPhoto(
          user.userId,
          { source: IMAGE_PATH }
        );
        
        // Задержка 100ms между фото и текстом
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Отправляем текст с кнопкой (нет лимита на длину!)
        await bot.telegram.sendMessage(
          user.userId,
          message,
          { 
            reply_markup: keyboard.reply_markup,
            parse_mode: 'HTML'
          }
        );
        
        sent++;
        const genderEmoji = gender === 'male' ? '♂️' : gender === 'female' ? '♀️' : '⚧️';
        console.log(`✅ ${progress} ${genderEmoji} Отправлено: @${user.username || user.userId} (${user.currentStep})`);
        
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
        console.log(`\n📊 Прогресс: ${i + 1}/${targetUsers.length} (${sent} успешно, ${failed} ошибок)\n`);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🎉 Рассылка завершена!\n');
    console.log('📊 РЕЗУЛЬТАТЫ:');
    console.log(`   Всего целевых пользователей: ${targetUsers.length}`);
    console.log(`   ✅ Отправлено: ${sent}`);
    console.log(`   ❌ Ошибок: ${failed}`);
    console.log(`   📈 Success rate: ${((sent / targetUsers.length) * 100).toFixed(1)}%`);
    console.log(`\n👥 Распределение по полу:`);
    console.log(`   ♂️  Мужчин: ${maleCount}`);
    console.log(`   ♀️  Женщин: ${femaleCount}`);

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
      
      // Подсчитываем сегменты
      const segmentCounts = {
        start: stepStats['start'] || 0,
        video1: stepStats['video1'] || 0,
        video2: stepStats['video2'] || 0,
        video3: stepStats['video3'] || 0,
        payment_choice: stepStats['payment_choice'] || 0,
        waiting_receipt: stepStats['waiting_receipt'] || 0,
      };
      
      await broadcastRepo.save({
        broadcastType: 'black_friday',
        segmentStart: segmentCounts.start,
        segmentVideo1: segmentCounts.video1,
        segmentVideo2: segmentCounts.video2,
        segmentVideo3: segmentCounts.video3,
        segmentPaymentChoice: segmentCounts.payment_choice,
        segmentWaitingReceipt: segmentCounts.waiting_receipt,
        totalAttempted: targetUsers.length,
        totalSent: sent,
        totalFailed: failed,
        notes: `Black Friday: $25 lifetime access. Персонализация по имени и полу. Мужчин: ${maleCount}, Женщин: ${femaleCount}`
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
