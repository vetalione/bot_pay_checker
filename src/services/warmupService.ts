import { Telegraf, Context } from 'telegraf';
import { AppDataSource } from '../database';
import { User } from '../entities/User';
import { Input } from 'telegraf';
import * as path from 'path';

export class WarmupService {
  private bot: Telegraf<Context>;

  constructor(bot: Telegraf<Context>) {
    this.bot = bot;
  }

  /**
   * Автоматический догрев для застрявших на start и video1
   * Запускается каждые 2 минуты вместе с reminderService
   */
  async sendWarmupReminders(): Promise<void> {
    try {
      const userRepo = AppDataSource.getRepository(User);

      // ОТКЛЮЧЕНО: Находим пользователей застрявших на start (5 минут)
      // Теперь используется новая 3-уровневая система в ReminderService
      // const startUsers = await userRepo
      //   .createQueryBuilder('user')
      //   .where('user.currentStep = :step', { step: 'start' })
      //   .andWhere('user.hasPaid = false')
      //   .andWhere('user.warmupStartSent = false')
      //   .andWhere('user.lastActivityAt < NOW() - INTERVAL \'5 minutes\'')
      //   .getMany();

      // ОТКЛЮЧЕНО: Находим пользователей застрявших на video1 (10 минут)
      // Теперь используется новая 3-уровневая система в ReminderService
      // const video1Users = await userRepo
      //   .createQueryBuilder('user')
      //   .where('user.currentStep = :step', { step: 'video1' })
      //   .andWhere('user.hasPaid = false')
      //   .andWhere('user.warmupVideo1Sent = false')
      //   .andWhere('user.lastActivityAt < NOW() - INTERVAL \'10 minutes\'')
      //   .getMany();

      console.log(`🔥 Warmup: 0 на start (отключено), 0 на video1 (отключено) - используется новая 3-уровневая система`);

      // ОТКЛЮЧЕНО: Отправляем догрев для start
      // for (const user of startUsers) {
      //   try {
      //     await this.sendWarmupMessage(user);
      //     user.warmupStartSent = true;
      //     await userRepo.save(user);
      //     console.log(`✅ Warmup отправлен пользователю ${user.userId} (start)`);
      //   } catch (error: any) {
      //     console.error(`❌ Ошибка отправки warmup пользователю ${user.userId}:`, error.message);
      //   }
      // }

      // ОТКЛЮЧЕНО: Отправляем догрев для video1
      // for (const user of video1Users) {
      //   try {
      //     await this.sendWarmupMessage(user);
      //     user.warmupVideo1Sent = true;
      //     await userRepo.save(user);
      //     console.log(`✅ Warmup отправлен пользователю ${user.userId} (video1)`);
      //   } catch (error: any) {
      //     console.error(`❌ Ошибка отправки warmup пользователю ${user.userId}:`, error.message);
      //   }
      // }
    } catch (error) {
      console.error('❌ Ошибка в sendWarmupReminders:', error);
    }
  }

  /**
   * Разовая массовая рассылка для ВСЕХ текущих застрявших на start и video1
   * Используется для первого запуска, потом работает автодогрев
   */
  async sendBroadcastToStuck(): Promise<{ total: number; sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    // Используем прямой SQL запрос для надёжности
    const stuckUsers = await AppDataSource.query(`
      SELECT * FROM users 
      WHERE "currentStep" IN ('start', 'video1') 
      AND "hasPaid" = false
    `);

    console.log(`📨 Начинаем разовую рассылку warmup для ${stuckUsers.length} пользователей...`);

    const userRepo = AppDataSource.getRepository(User);

    for (const user of stuckUsers) {
      try {
        await this.sendWarmupMessage(user);
        
        // Помечаем соответствующий флаг
        if (user.currentStep === 'start') {
          user.warmupStartSent = true;
        } else if (user.currentStep === 'video1') {
          user.warmupVideo1Sent = true;
        }
        
        await userRepo.save(user);
        sent++;
        console.log(`✅ [${sent}/${stuckUsers.length}] Warmup отправлен ${user.userId} (${user.currentStep})`);
        
        // Задержка 50ms между сообщениями
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error: any) {
        failed++;
        console.error(`❌ Ошибка отправки warmup пользователю ${user.userId}:`, error.message);
      }
    }

    return { total: stuckUsers.length, sent, failed };
  }

  /**
   * Отправка warmup сообщения с фото и кнопками оплаты
   */
  private async sendWarmupMessage(user: User): Promise<void> {
    const firstName = user.firstName || 'Друг';
    
    const message = 
      `${firstName}, 90% застревают именно на этом шаге. А те кто прошел дальше уже вчера попали в наш чат и уже сняли свои первые 10 рилс в тот же день и пишут вот такие отзывы в восторге. ` +
      `Ты тоже в шаге от того чтобы получить мои инструменты которые принесли мне 15 000$ через рилс. ` +
      `\n\nЕсли не хочешь смотреть видео о продукте, можешь просто пропустить этот шаг и перейти к оплате.`;

    // Пути к скриншотам
    const image1Path = path.join(__dirname, '../../image_1_screen.jpeg');
    const image2Path = path.join(__dirname, '../../Image_2_screen.jpeg');

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
    await this.bot.telegram.sendMediaGroup(user.userId, media);

    // Отправляем кнопки оплаты отдельным сообщением
    await this.bot.telegram.sendMessage(
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
  }
}
