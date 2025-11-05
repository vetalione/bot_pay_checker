import { Telegraf, Markup } from 'telegraf';
import { AppDataSource } from './database';
import { User } from './entities/User';
import { MoreThan } from 'typeorm';

export class ReminderService {
  private bot: Telegraf;
  private intervalId?: NodeJS.Timeout;
  private readonly REMINDER_DELAY_MS = 5 * 60 * 1000; // 5 минут
  private readonly VIDEO1_REMINDER_DELAY_MS = 10 * 60 * 1000; // 10 минут

  constructor(bot: Telegraf) {
    this.bot = bot;
  }

  /**
   * Запуск фонового процесса проверки напоминаний
   */
  start() {
    console.log('🔔 Запуск сервиса напоминаний...');
    
    // Проверяем каждую минуту
    this.intervalId = setInterval(() => {
      this.checkAndSendReminders();
    }, 60 * 1000); // Каждую минуту

    // Первая проверка сразу при запуске
    this.checkAndSendReminders();
  }

  /**
   * Остановка сервиса напоминаний
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      console.log('🔕 Сервис напоминаний остановлен');
    }
  }

  /**
   * Проверка и отправка напоминаний
   */
  private async checkAndSendReminders() {
    try {
      await this.checkPaymentChoiceReminders();
      // await this.checkReceiptReminders(); // УБРАНО: RUB теперь только через Tribute (автоматически)
      await this.checkVideo1Reminders();
    } catch (error) {
      console.error('❌ Ошибка в checkAndSendReminders:', error);
    }
  }

  /**
   * Проверка напоминаний о выборе способа оплаты
   */
  private async checkPaymentChoiceReminders() {
    const userRepository = AppDataSource.getRepository(User);
    
    // Вычисляем время 5 минут назад
    const fiveMinutesAgo = new Date(Date.now() - this.REMINDER_DELAY_MS);

    // Находим пользователей, которым показали выбор оплаты больше 5 минут назад
    // но они еще не выбрали валюту и им еще не отправляли напоминание
    const usersToRemind = await userRepository.find({
      where: {
        currentStep: 'payment_choice',
        currency: null as any, // Еще не выбрали валюту
        paymentReminderSent: false,
        paymentChoiceShownAt: MoreThan(new Date(0)) // Проверяем что поле установлено
      }
    });

    console.log(`📊 Найдено пользователей для напоминания (выбор оплаты): ${usersToRemind.length}`);

    for (const user of usersToRemind) {
      // Проверяем что прошло ровно 5 минут или больше
      if (user.paymentChoiceShownAt && user.paymentChoiceShownAt <= fiveMinutesAgo) {
        await this.sendPaymentChoiceReminder(user);
      }
    }
  }

  /**
   * Проверка напоминаний об отправке квитанции (для RUB)
   */
  private async checkReceiptReminders() {
    const userRepository = AppDataSource.getRepository(User);
    
    // Вычисляем время 5 минут назад
    const fiveMinutesAgo = new Date(Date.now() - this.REMINDER_DELAY_MS);

    // Находим пользователей, которые выбрали RUB и ждут больше 5 минут
    const usersToRemind = await userRepository.find({
      where: {
        currentStep: 'waiting_receipt',
        currency: 'RUB',
        receiptReminderSent: false,
        waitingReceiptSince: MoreThan(new Date(0))
      }
    });

    console.log(`📊 Найдено пользователей для напоминания (квитанция RUB): ${usersToRemind.length}`);

    for (const user of usersToRemind) {
      // Проверяем что прошло ровно 5 минут или больше
      if (user.waitingReceiptSince && user.waitingReceiptSince <= fiveMinutesAgo) {
        await this.sendReceiptReminder(user);
      }
    }
  }

  /**
   * Отправка напоминания о выборе способа оплаты
   */
  private async sendPaymentChoiceReminder(user: User) {
    try {
      console.log(`🔔 Отправка напоминания о выборе оплаты пользователю ${user.userId}`);

      await this.bot.telegram.sendMessage(
        user.userId,
        'Хочешь выбрать другой способ оплаты?',
        Markup.inlineKeyboard([
          [Markup.button.url('📨 Написать ассистенту', 'https://t.me/vetalsmirnov')]
        ])
      );

      // Отмечаем что напоминание отправлено
      const userRepository = AppDataSource.getRepository(User);
      user.paymentReminderSent = true;
      await userRepository.save(user);

      console.log(`✅ Напоминание о выборе оплаты отправлено пользователю ${user.userId}`);
    } catch (error) {
      console.error(`❌ Ошибка отправки напоминания пользователю ${user.userId}:`, error);
    }
  }

  /**
   * Отправка напоминания об отправке квитанции (RUB)
   */
  private async sendReceiptReminder(user: User) {
    try {
      console.log(`🔔 Отправка напоминания о квитанции пользователю ${user.userId}`);

      await this.bot.telegram.sendMessage(
        user.userId,
        'Что-то не работает с оплатой рублями? Проверьте, что при переводе "валюта зачисления" указана USD и у вас самая последняя версия банковского приложения (функцию добавили недавно). Также вы можете попробовать сделать перевод через веб-версию своего банка, рекомендуем: Т-банк, Альфа Банк, Сбербанк. Либо напишите ассистенту!',
        Markup.inlineKeyboard([
          [Markup.button.url('📨 Написать ассистенту', 'https://t.me/vetalsmirnov')]
        ])
      );

      // Отмечаем что напоминание отправлено
      const userRepository = AppDataSource.getRepository(User);
      user.receiptReminderSent = true;
      await userRepository.save(user);

      console.log(`✅ Напоминание о квитанции отправлено пользователю ${user.userId}`);
    } catch (error) {
      console.error(`❌ Ошибка отправки напоминания о квитанции пользователю ${user.userId}:`, error);
    }
  }

  /**
   * Сброс флага напоминания (когда пользователь выбрал валюту)
   */
  async resetReminder(userId: number) {
    try {
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { userId } });
      
      if (user) {
        user.paymentReminderSent = false;
        user.paymentChoiceShownAt = null as any;
        await userRepository.save(user);
      }
    } catch (error) {
      console.error(`❌ Ошибка сброса напоминания для пользователя ${userId}:`, error);
    }
  }

  /**
   * Проверка напоминаний для застрявших на video1
   */
  private async checkVideo1Reminders() {
    const userRepository = AppDataSource.getRepository(User);
    
    // Вычисляем время 10 минут назад
    const tenMinutesAgo = new Date(Date.now() - this.VIDEO1_REMINDER_DELAY_MS);

    // Находим пользователей застрявших на video1 больше 10 минут
    const usersToRemind = await userRepository.find({
      where: {
        currentStep: 'video1',
        hasPaid: false,
        video1ReminderSent: false,
        video1ShownAt: MoreThan(new Date(0))
      }
    });

    console.log(`📊 Найдено пользователей для напоминания (video1): ${usersToRemind.length}`);

    for (const user of usersToRemind) {
      // Проверяем что прошло ровно 10 минут или больше
      if (user.video1ShownAt && user.video1ShownAt <= tenMinutesAgo) {
        await this.sendVideo1Reminder(user);
      }
    }
  }

  /**
   * Отправка напоминания для застрявших на video1
   */
  private async sendVideo1Reminder(user: User) {
    try {
      console.log(`🔔 Отправка напоминания video1 пользователю ${user.userId}`);

      await this.bot.telegram.sendMessage(
        user.userId,
        'Нет времени смотреть видео? Понимаю, я тоже все время на бегу. Хочешь я просто сразу дам тебе ссылку на платный канал со всеми моими инструментами и инструкцией как пользоваться?',
        Markup.inlineKeyboard([
          [Markup.button.callback('✨ Хочу!', 'video1_skip_to_payment')]
        ])
      );

      // Отмечаем что напоминание отправлено
      const userRepository = AppDataSource.getRepository(User);
      user.video1ReminderSent = true;
      await userRepository.save(user);

      console.log(`✅ Напоминание video1 отправлено пользователю ${user.userId}`);
    } catch (error) {
      console.error(`❌ Ошибка отправки напоминания video1 пользователю ${user.userId}:`, error);
    }
  }
}
