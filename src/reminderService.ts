import { Telegraf, Markup } from 'telegraf';
import { AppDataSource } from './database';
import { User } from './entities/User';
import { MoreThan } from 'typeorm';

export class ReminderService {
  private bot: Telegraf;
  private intervalId?: NodeJS.Timeout;
  private readonly LEVEL1_DELAY_MS = 5 * 60 * 1000; // 5 минут
  private readonly LEVEL2_DELAY_MS = 60 * 60 * 1000; // 1 час
  private readonly LEVEL3_DELAY_MS = 24 * 60 * 60 * 1000; // 24 часа
  private readonly VIDEO1_REMINDER_DELAY_MS = 10 * 60 * 1000; // 10 минут (старая логика для video1)

  constructor(bot: Telegraf) {
    this.bot = bot;
  }

  /**
   * Определение пола по имени
   * Скопировано из broadcast_black_friday.ts
   */
  private detectGender(firstName: string | undefined): 'male' | 'female' | 'unknown' {
    if (!firstName) return 'unknown';
    
    const name = firstName.toLowerCase().trim();
    
    // Женские окончания
    const femaleEndings = ['а', 'я', 'на', 'ла', 'ка', 'ша', 'ся'];
    
    // Исключения - мужские имена на -а/-я
    const maleExceptions = ['никита', 'илья', 'савва', 'данила', 'миша', 'саша', 'женя'];
    
    // Проверяем исключения
    if (maleExceptions.includes(name)) {
      return 'male';
    }
    
    // Проверяем женские окончания
    for (const ending of femaleEndings) {
      if (name.endsWith(ending)) {
        return 'female';
      }
    }
    
    // По умолчанию - мужской пол
    return 'male';
  }

  /**
   * Персонализация текста по полу
   */
  private personalizeText(text: string, gender: 'male' | 'female' | 'unknown'): string {
    if (gender === 'female') {
      return text
        .replace(/запустил\(а\/\)/g, 'запустила')
        .replace(/остановился\(ась\/\)/g, 'остановилась')
        .replace(/готов\(а\/\)/g, 'готова')
        .replace(/видел\(а\/\)/g, 'видела')
        .replace(/\(а\/\)/g, 'а');
    } else {
      // Мужской или unknown
      return text
        .replace(/запустил\(а\/\)/g, 'запустил')
        .replace(/остановился\(ась\/\)/g, 'остановился')
        .replace(/готов\(а\/\)/g, 'готов')
        .replace(/видел\(а\/\)/g, 'видел')
        .replace(/\(а\/\)/g, '');
    }
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
      // Новая система: 3 уровня для START
      await this.checkStartRemindersLevel1();
      await this.checkStartRemindersLevel2();
      await this.checkStartRemindersLevel3();
      
      // Старая система для остальных этапов (пока не мигрировали)
      await this.checkPaymentChoiceReminders();
      // await this.checkReceiptReminders(); // УБРАНО: RUB теперь только через Tribute
      await this.checkVideo1Reminders();
    } catch (error) {
      console.error('❌ Ошибка в checkAndSendReminders:', error);
    }
  }

  /**
   * ===== НОВАЯ СИСТЕМА: 3 уровня напоминаний для START =====
   */

  /**
   * Level 1: Проверка напоминаний START (5 минут)
   */
  private async checkStartRemindersLevel1() {
    const userRepository = AppDataSource.getRepository(User);
    const fiveMinutesAgo = new Date(Date.now() - this.LEVEL1_DELAY_MS);

    const usersToRemind = await userRepository.find({
      where: {
        currentStep: 'start',
        hasPaid: false,
        reminderLevel1Start: false,
      }
    });

    console.log(`📊 START Level 1: найдено ${usersToRemind.length} пользователей для проверки`);

    for (const user of usersToRemind) {
      if (user.currentStepChangedAt && user.currentStepChangedAt <= fiveMinutesAgo) {
        await this.sendStartReminderLevel1(user);
      }
    }
  }

  /**
   * Level 2: Проверка напоминаний START (1 час)
   */
  private async checkStartRemindersLevel2() {
    const userRepository = AppDataSource.getRepository(User);
    const oneHourAgo = new Date(Date.now() - this.LEVEL2_DELAY_MS);

    const usersToRemind = await userRepository.find({
      where: {
        currentStep: 'start',
        hasPaid: false,
        reminderLevel1Start: true, // Уже получили Level 1
        reminderLevel2Start: false,
      }
    });

    console.log(`📊 START Level 2: найдено ${usersToRemind.length} пользователей для проверки`);

    for (const user of usersToRemind) {
      if (user.currentStepChangedAt && user.currentStepChangedAt <= oneHourAgo) {
        await this.sendStartReminderLevel2(user);
      }
    }
  }

  /**
   * Level 3: Проверка напоминаний START (24 часа)
   */
  private async checkStartRemindersLevel3() {
    const userRepository = AppDataSource.getRepository(User);
    const twentyFourHoursAgo = new Date(Date.now() - this.LEVEL3_DELAY_MS);

    const usersToRemind = await userRepository.find({
      where: {
        currentStep: 'start',
        hasPaid: false,
        reminderLevel2Start: true, // Уже получили Level 2
        reminderLevel3Start: false,
      }
    });

    console.log(`📊 START Level 3: найдено ${usersToRemind.length} пользователей для проверки`);

    for (const user of usersToRemind) {
      if (user.currentStepChangedAt && user.currentStepChangedAt <= twentyFourHoursAgo) {
        await this.sendStartReminderLevel3(user);
      }
    }
  }

  /**
   * Отправка START Level 1 (5 минут)
   */
  private async sendStartReminderLevel1(user: User) {
    try {
      const firstName = user.firstName || 'Друг';
      const gender = this.detectGender(user.firstName);
      
      let text = `${firstName}, все в порядке? 😊

Видел(а/), что ты запустил(а/) бота, но остановился(ась/). 
Понимаю — иногда отвлекаемся на другие дела.

Если интересно посмотреть как я заработал(а/) $15,000 через рилс — 
просто нажми кнопку "Хочу!" ниже 👇`;

      text = this.personalizeText(text, gender);

      await this.bot.telegram.sendMessage(
        user.userId,
        text,
        Markup.inlineKeyboard([
          [Markup.button.callback('▶️ Продолжить', 'want')]
        ])
      );

      const userRepository = AppDataSource.getRepository(User);
      user.reminderLevel1Start = true;
      await userRepository.save(user);

      console.log(`✅ START Level 1 отправлен пользователю ${user.userId}`);
    } catch (error: any) {
      console.error(`❌ Ошибка отправки START Level 1 пользователю ${user.userId}:`, error.message);
    }
  }

  /**
   * Отправка START Level 2 (1 час)
   */
  private async sendStartReminderLevel2(user: User) {
    try {
      const firstName = user.firstName || 'Друг';

      const text = `${firstName}, 73% моих клиентов говорят что пожалели только об одном — 
что не начали раньше 😅

У тебя всё ещё есть шанс попасть в закрытый чат, 
где уже 110+ человек делятся своими результатами в рилс.

Видео займёт 2 минуты, либо ты можешь их проматывать.`;

      await this.bot.telegram.sendMessage(
        user.userId,
        text,
        Markup.inlineKeyboard([
          [Markup.button.callback('🎬 Смотреть видео', 'want')]
        ])
      );

      const userRepository = AppDataSource.getRepository(User);
      user.reminderLevel2Start = true;
      await userRepository.save(user);

      console.log(`✅ START Level 2 отправлен пользователю ${user.userId}`);
    } catch (error: any) {
      console.error(`❌ Ошибка отправки START Level 2 пользователю ${user.userId}:`, error.message);
    }
  }

  /**
   * Отправка START Level 3 (24 часа)
   */
  private async sendStartReminderLevel3(user: User) {
    try {
      const firstName = user.firstName || 'Друг';
      const gender = this.detectGender(user.firstName);

      let text = `${firstName}, последний раз напоминаю — обещаю не спамить 🙌

Если сейчас не время — всё ок, возвращайся когда будешь готов(а/).

Но если хочешь узнать систему которая принесла мне $15k — 
я здесь, чтобы помочь.`;

      text = this.personalizeText(text, gender);

      await this.bot.telegram.sendMessage(
        user.userId,
        text,
        Markup.inlineKeyboard([
          [Markup.button.url('💬 Написать ассистенту', 'https://t.me/vetalsmirnov')],
          [Markup.button.callback('▶️ Посмотреть видео', 'want')]
        ])
      );

      const userRepository = AppDataSource.getRepository(User);
      user.reminderLevel3Start = true;
      await userRepository.save(user);

      console.log(`✅ START Level 3 отправлен пользователю ${user.userId}`);
    } catch (error: any) {
      console.error(`❌ Ошибка отправки START Level 3 пользователю ${user.userId}:`, error.message);
    }
  }

  /**
   * ===== СТАРАЯ СИСТЕМА (для payment_choice и video1) =====
   */

  /**
   * Проверка напоминаний о выборе способа оплаты
   */
  private async checkPaymentChoiceReminders() {
    const userRepository = AppDataSource.getRepository(User);
    
    // Вычисляем время 5 минут назад
    const fiveMinutesAgo = new Date(Date.now() - this.LEVEL1_DELAY_MS);

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
    const fiveMinutesAgo = new Date(Date.now() - this.LEVEL1_DELAY_MS);

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
