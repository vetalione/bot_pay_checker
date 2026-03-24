import 'reflect-metadata';
import { Telegraf, Input } from 'telegraf';
import { DataSource } from 'typeorm';
import { User } from './src/entities/User';
import { UserAction } from './src/entities/UserAction';
import { PaymentStats } from './src/entities/PaymentStats';
import { CurrentSteps } from './src/entities/CurrentSteps';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

// Прямое подключение к Railway БД
const RailwayDataSource = new DataSource({
  type: 'postgres',
  host: 'nozomi.proxy.rlwy.net',
  port: 35365,
  username: 'postgres',
  password: 'tbswlvQbgFmiOdcJPKyAckRuSmvrYxxw',
  database: 'railway',
  synchronize: false,
  logging: false,
  entities: [User, UserAction, PaymentStats, CurrentSteps],
});

async function runWarmupBroadcast() {
  try {
    console.log('🔥 Инициализация warmup рассылки...\n');

    // Подключаемся к Railway БД
    await RailwayDataSource.initialize();
    console.log('✅ База данных подключена: railway\n');

    // Создаём бота
    const bot = new Telegraf(process.env.BOT_TOKEN!);
    
    console.log('📨 Начинаю разовую рассылку warmup для всех застрявших на start и video1...\n');
    
    // Находим всех застрявших
    const stuckUsers = await RailwayDataSource.query(`
      SELECT * FROM users 
      WHERE "currentStep" IN ('start', 'video1') 
      AND "hasPaid" = false
    `);

    console.log(`👥 Найдено пользователей: ${stuckUsers.length}\n`);

    let sent = 0;
    let failed = 0;

    for (const user of stuckUsers) {
      try {
        // Отправляем warmup сообщение
        const firstName = user.firstName || 'Друг';
        
        const message = 
          `${firstName}, 90% застревают именно на этом шаге. А те кто прошел дальше уже вчера попали в наш чат и уже сняли свои первые 10 рилс в тот же день и пишут вот такие отзывы в восторге. ` +
          `Ты тоже в шаге от того чтобы получить мои инструменты которые принесли мне 15 000$ через рилс. ` +
          `\n\nЕсли не хочешь смотреть видео о продукте, можешь просто пропустить этот шаг и перейти к оплате.`;

        // Пути к скриншотам
        const image1Path = path.join(__dirname, 'image_1_screen.jpeg');
        const image2Path = path.join(__dirname, 'Image_2_screen.jpeg');

        // Создаём медиагруппу из 2 фото
        const media = [
          {
            type: 'photo' as const,
            media: Input.fromLocalFile(image1Path),
          },
          {
            type: 'photo' as const,
            media: Input.fromLocalFile(image2Path),
            caption: message,
          },
        ];

        // Отправляем медиагруппу
        await bot.telegram.sendMediaGroup(user.userId, media);

        // Отправляем кнопки оплаты отдельным сообщением
        await bot.telegram.sendMessage(
          user.userId,
          '💳 Выбери способ оплаты:',
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '💵 Оплатить в рублях (RUB) - Tribute',
                    url: 'https://t.me/tribute/app?startapp=sF8Z',
                  },
                ],
                [
                  {
                    text: '💳 Оплатить в евро (EUR) - Tribute',
                    url: 'https://t.me/tribute/app?startapp=sFe6',
                  },
                ],
                [
                  {
                    text: '💴 Оплатить в гривнах (UAH)',
                    callback_data: 'pay_uah',
                  },
                ],
              ],
            },
          }
        );

        // Помечаем флаг
        await RailwayDataSource.query(`
          UPDATE users 
          SET "${user.currentStep === 'start' ? 'warmupStartSent' : 'warmupVideo1Sent'}" = true
          WHERE "userId" = $1
        `, [user.userId]);

        sent++;
        console.log(`✅ [${sent}/${stuckUsers.length}] Warmup отправлен ${user.userId} (${user.currentStep})`);
        
        // Задержка 50ms между сообщениями
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error: any) {
        failed++;
        console.error(`❌ Ошибка отправки warmup пользователю ${user.userId}:`, error.message);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔥 РЕЗУЛЬТАТЫ WARMUP РАССЫЛКИ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`👥 Всего пользователей: ${stuckUsers.length}`);
    console.log(`✅ Отправлено: ${sent}`);
    console.log(`❌ Ошибок: ${failed}\n`);
    
    const successRate = stuckUsers.length > 0 ? ((sent / stuckUsers.length) * 100).toFixed(1) : '0';
    console.log(`📊 Успешность: ${successRate}%\n`);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Рассылка завершена!');
    console.log('\n💡 Теперь используй /stats в боте чтобы увидеть результаты!\n');

    await RailwayDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка при warmup рассылке:', error);
    await RailwayDataSource.destroy();
    process.exit(1);
  }
}

runWarmupBroadcast();
