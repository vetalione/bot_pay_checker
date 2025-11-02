import { Telegraf, Markup } from 'telegraf';
import { AppDataSource } from './database';
import { User } from './entities/User';
import { MoreThan } from 'typeorm';

export class ReminderService {
  private bot: Telegraf;
  private intervalId?: NodeJS.Timeout;
  private readonly REMINDER_DELAY_MS = 5 * 60 * 1000; // 5 минут

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

      console.log(`📊 Найдено пользователей для напоминания: ${usersToRemind.length}`);

      for (const user of usersToRemind) {
        // Проверяем что прошло ровно 5 минут или больше
        if (user.paymentChoiceShownAt && user.paymentChoiceShownAt <= fiveMinutesAgo) {
          await this.sendReminder(user);
        }
      }
    } catch (error) {
      console.error('❌ Ошибка в checkAndSendReminders:', error);
    }
  }

  /**
   * Отправка напоминания конкретному пользователю
   */
  private async sendReminder(user: User) {
    try {
      console.log(`🔔 Отправка напоминания пользователю ${user.userId}`);

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

      console.log(`✅ Напоминание отправлено пользователю ${user.userId}`);
    } catch (error) {
      console.error(`❌ Ошибка отправки напоминания пользователю ${user.userId}:`, error);
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
}
