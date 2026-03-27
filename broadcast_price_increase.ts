import 'reflect-metadata';
import { Telegraf, Input } from 'telegraf';
import { DataSource } from 'typeorm';
import { User } from './src/entities/User';
import { UserAction } from './src/entities/UserAction';
import { PaymentStats } from './src/entities/PaymentStats';
import { CurrentSteps } from './src/entities/CurrentSteps';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config();

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

async function runBroadcast() {
  try {
    console.log('📨 Инициализация рассылки "Повышение цены"...\n');

    await RailwayDataSource.initialize();
    console.log('✅ База данных подключена\n');

    const bot = new Telegraf(process.env.BOT_TOKEN!);

    // Загружаем изображения из папки "новые отзывы"
    const reviewsDir = path.join(__dirname, 'новые отзывы');
    const imageFiles = fs.readdirSync(reviewsDir)
      .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .sort();

    console.log(`🖼️ Найдено изображений: ${imageFiles.length}`);
    imageFiles.forEach((f, i) => console.log(`   ${i + 1}. ${f}`));
    console.log('');

    if (imageFiles.length === 0) {
      console.error('❌ Изображения не найдены в папке "новые отзывы"!');
      process.exit(1);
    }

    // Находим всех кто НЕ оплатил и НЕ заблокировал бота
    const users = await RailwayDataSource.query(`
      SELECT * FROM users 
      WHERE "hasPaid" = false
      AND ("blockedBot" = false OR "blockedBot" IS NULL)
    `);

    console.log(`👥 Найдено пользователей для рассылки: ${users.length}\n`);

    if (users.length === 0) {
      console.log('✅ Нет пользователей для рассылки');
      process.exit(0);
    }

    let sent = 0;
    let failed = 0;
    let blocked = 0;

    for (const user of users) {
      try {
        const firstName = user.firstName || 'Друг';

        const messageText =
          `Привет, ${firstName}! С тех пор как я запустила промты Настя заработала на них 10.000$, ` +
          `Никита набрал по 40-50к просмотров в тик токе, инстаграм и ютубе (x10 от обычного), ` +
          `ну а я сняла рилс на 5 миллионов и выросла до 46.000 подписчиков. ` +
          `У нас добавилось восторженных отзывов и стало понятно - пора двигаться дальше. ` +
          `Решила последний раз тебе напомнить, так как ты у нас здесь давно. ` +
          `Сегодня последний день когда доступ ко всем материалам - 25$. ` +
          `С завтрашнего дня цену ставим 50$. ` +
          `Кстати, будут добавлены и новые промты: переделать чужой рилс под себя, добавить перчинки, ` +
          `добавить свою экспертность в охватную тему, разбить на сериал, снять в духе "у меня бомбит". ` +
          `Успевай получить пожизненный доступ сегодня. Оплата любой валютой. Все кнопки починили :)`;

        // Создаём медиагруппу из всех изображений (без текста)
        const media = imageFiles.map((file) => ({
          type: 'photo' as const,
          media: Input.fromLocalFile(path.join(reviewsDir, file)),
        }));

        // 1. Отправляем медиагруппу (только фото)
        await bot.telegram.sendMediaGroup(user.userId, media);

        // 2. Отправляем текст + кнопки одним сообщением
        await bot.telegram.sendMessage(
          user.userId,
          messageText,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '💳 Иностранные карты (44€)', url: 'https://t.me/tribute/app?startapp=sFe6' }],
                [{ text: '💴 Оплатить гривнами (2100 ₴)', callback_data: 'pay_uah' }],
                [{ text: '💵 Оплатить рублями (4000 ₽)', url: 'https://t.me/tribute/app?startapp=sF8Z' }],
                [{ text: '📨 Написать помощнику', url: 'https://t.me/vetalsmirnov' }],
              ],
            },
          }
        );

        sent++;
        if (sent % 10 === 0) {
          console.log(`📤 Отправлено: ${sent}/${users.length}...`);
        }

        // Задержка 50ms чтобы не попасть в rate limit
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (error: any) {
        if (error?.response?.error_code === 403) {
          blocked++;
          // Помечаем как заблокировавших
          await RailwayDataSource.query(
            `UPDATE users SET "blockedBot" = true, "blockedAt" = NOW() WHERE "userId" = $1`,
            [user.userId]
          );
        } else {
          failed++;
          console.error(`❌ Ошибка для ${user.userId} (@${user.username}):`, error?.message || error);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 РЕЗУЛЬТАТЫ РАССЫЛКИ "ПОВЫШЕНИЕ ЦЕНЫ"');
    console.log('='.repeat(60));
    console.log(`👥 Всего пользователей: ${users.length}`);
    console.log(`✅ Успешно отправлено: ${sent}`);
    console.log(`🚫 Заблокировали бота: ${blocked}`);
    console.log(`❌ Ошибок: ${failed}`);
    console.log('='.repeat(60));

    await RailwayDataSource.destroy();
    process.exit(0);

  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  }
}

runBroadcast();
