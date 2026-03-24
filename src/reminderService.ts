import { Telegraf, Markup } from 'telegraf';
import { AppDataSource } from './database';
import { User } from './entities/User';
import { MoreThan } from 'typeorm';
import * as path from 'path';

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
   * Помечает пользователя как заблокировавшего бота
   */
  private async markUserAsBlocked(userId: number): Promise<void> {
    try {
      const userRepository = AppDataSource.getRepository(User);
      
      // Проверяем, не помечен ли пользователь уже
      const user = await userRepository.findOne({ 
        where: { userId }, 
        select: ['blockedBot'] 
      });
      
      if (user?.blockedBot) {
        return; // Уже помечен, ничего не делаем
      }
      
      await userRepository.update(
        { userId },
        { 
          blockedBot: true, 
          blockedAt: new Date() 
        }
      );
      console.log(`🚫 Пользователь ${userId} заблокировал бота. Помечен в БД, больше не будем отправлять сообщения.`);
    } catch (error: any) {
      console.error(`❌ Ошибка при маркировке пользователя ${userId} как заблокированного:`, error.message);
    }
  }

  /**
   * Проверяет, является ли ошибка блокировкой бота пользователем
   */
  private isBlockedByUserError(error: any): boolean {
    return error && 
           error.response && 
           error.response.error_code === 403 && 
           error.response.description && 
           error.response.description.includes('bot was blocked by the user');
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
      
      // Новая система: 3 уровня для VIDEO1
      await this.checkVideo1RemindersLevel1();
      await this.checkVideo1RemindersLevel2();
      await this.checkVideo1RemindersLevel3();
      
      // Новая система: 3 уровня для VIDEO2
      await this.checkVideo2RemindersLevel1();
      await this.checkVideo2RemindersLevel2();
      await this.checkVideo2RemindersLevel3();
      
      // Новая система: 3 уровня для VIDEO3
      await this.checkVideo3RemindersLevel1();
      await this.checkVideo3RemindersLevel2();
      await this.checkVideo3RemindersLevel3();
      
      // Старая система для остальных этапов (пока не мигрировали)
      await this.checkPaymentChoiceReminders();
      // await this.checkReceiptReminders(); // УБРАНО: RUB теперь только через Tribute
      // await this.checkVideo1Reminders(); // УБРАНО: Заменено на 3-уровневую систему
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
        blockedBot: false,
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
   * Level 2: Проверка напоминаний START (1 час после Level 1)
   */
  private async checkStartRemindersLevel2() {
    const oneHourAgo = new Date(Date.now() - this.LEVEL2_DELAY_MS);

    // Используем прямой SQL запрос - проверяем время отправки Level 1
    const users = await AppDataSource.query(
      `SELECT * FROM users 
       WHERE "currentStep" = 'start' 
       AND "hasPaid" = false 
       AND "reminderLevel1Start" = true 
       AND "reminderLevel2Start" = false
       AND "reminderLevel1StartSentAt" IS NOT NULL
       AND "reminderLevel1StartSentAt" <= $1
       AND ("blockedBot" = false OR "blockedBot" IS NULL)`,
      [oneHourAgo]
    );

    console.log(`📊 START Level 2: найдено ${users.length} пользователей (>1ч после L1)`);

    for (const userData of users) {
      const user = userData as User;
      await this.sendStartReminderLevel2(user);
    }
  }

  /**
   * Level 3: Проверка напоминаний START (24 часа после Level 2)
   */
  private async checkStartRemindersLevel3() {
    const twentyFourHoursAgo = new Date(Date.now() - this.LEVEL3_DELAY_MS);

    // Используем прямой SQL запрос
    const users = await AppDataSource.query(
      `SELECT * FROM users 
       WHERE "currentStep" = 'start' 
       AND "hasPaid" = false 
       AND "reminderLevel2Start" = true 
       AND "reminderLevel3Start" = false
       AND "reminderLevel2StartSentAt" IS NOT NULL
       AND "reminderLevel2StartSentAt" <= $1
       AND ("blockedBot" = false OR "blockedBot" IS NULL)`,
      [twentyFourHoursAgo]
    );

    console.log(`📊 START Level 3: найдено ${users.length} пользователей для проверки (>24 часа после L2)`);

    for (const userData of users) {
      const user = userData as User;
      await this.sendStartReminderLevel3(user);
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
          [Markup.button.callback('▶️ Продолжить', 'want_more')]
        ])
      );

      const userRepository = AppDataSource.getRepository(User);
      user.reminderLevel1Start = true;
      user.reminderLevel1StartSentAt = new Date();
      await userRepository.save(user);

      console.log(`✅ START Level 1 отправлен пользователю ${user.userId}`);
    } catch (error: any) {
      // Проверяем, заблокировал ли пользователь бота
      if (this.isBlockedByUserError(error)) {
        await this.markUserAsBlocked(user.userId);
        return;
      }
      
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
          [Markup.button.callback('🎬 Смотреть видео', 'want_more')]
        ])
      );

      const userRepository = AppDataSource.getRepository(User);
      user.reminderLevel2Start = true;
      user.reminderLevel2StartSentAt = new Date();
      await userRepository.save(user);

      console.log(`✅ START Level 2 отправлен пользователю ${user.userId}`);
    } catch (error: any) {
      // Проверяем, заблокировал ли пользователь бота
      if (this.isBlockedByUserError(error)) {
        await this.markUserAsBlocked(user.userId);
        return;
      }
      
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
          [Markup.button.callback('▶️ Посмотреть видео', 'want_more')]
        ])
      );

      const userRepository = AppDataSource.getRepository(User);
      user.reminderLevel3Start = true;
      user.reminderLevel3StartSentAt = new Date();
      user.reminderLevel3StartSentAt = new Date();
      await userRepository.save(user);

      console.log(`✅ START Level 3 отправлен пользователю ${user.userId}`);
    } catch (error: any) {
      // Проверяем, заблокировал ли пользователь бота
      if (this.isBlockedByUserError(error)) {
        await this.markUserAsBlocked(user.userId);
        return;
      }
      
      console.error(`❌ Ошибка отправки START Level 3 пользователю ${user.userId}:`, error.message);
    }
  }

  /**
   * ===== НОВАЯ СИСТЕМА: 3 уровня напоминаний для VIDEO1 =====
   */

  /**
   * Level 1: Проверка напоминаний VIDEO1 (5 минут)
   */
  private async checkVideo1RemindersLevel1() {
    const userRepository = AppDataSource.getRepository(User);
    const fiveMinutesAgo = new Date(Date.now() - this.LEVEL1_DELAY_MS);

    const usersToRemind = await userRepository.find({
      where: {
        currentStep: 'video1',
        hasPaid: false,
        reminderLevel1Video1: false,
        blockedBot: false,
      }
    });

    console.log(`📊 VIDEO1 Level 1: найдено ${usersToRemind.length} пользователей для проверки`);

    for (const user of usersToRemind) {
      if (user.currentStepChangedAt && user.currentStepChangedAt <= fiveMinutesAgo) {
        await this.sendVideo1ReminderLevel1(user);
      }
    }
  }

  /**
   * Level 2: Проверка напоминаний VIDEO1 (1 час после Level 1)
   */
  private async checkVideo1RemindersLevel2() {
    const oneHourAgo = new Date(Date.now() - this.LEVEL2_DELAY_MS);

    // Прямой SQL запрос - проверяем время отправки Level 1
    const usersToRemind = await AppDataSource.query(`
      SELECT * FROM users
      WHERE "currentStep" = 'video1'
        AND "hasPaid" = false
        AND "reminderLevel1Video1" = true
        AND "reminderLevel2Video1" = false
        AND "reminderLevel1Video1SentAt" IS NOT NULL
        AND "reminderLevel1Video1SentAt" <= $1
        AND ("blockedBot" = false OR "blockedBot" IS NULL)
    `, [oneHourAgo]) as User[];

    console.log(`📊 VIDEO1 Level 2: найдено ${usersToRemind.length} пользователей (>1ч после L1)`);

    for (const user of usersToRemind) {
      await this.sendVideo1ReminderLevel2(user);
    }
  }

  /**
   * Level 3: Проверка напоминаний VIDEO1 (24 часа после Level 2)
   */
  private async checkVideo1RemindersLevel3() {
    const twentyFourHoursAgo = new Date(Date.now() - this.LEVEL3_DELAY_MS);

    // Прямой SQL запрос - проверяем время отправки Level 2
    const usersToRemind = await AppDataSource.query(`
      SELECT * FROM users
      WHERE "currentStep" = 'video1'
        AND "hasPaid" = false
        AND "reminderLevel2Video1" = true
        AND "reminderLevel3Video1" = false
        AND "reminderLevel2Video1SentAt" IS NOT NULL
        AND "reminderLevel2Video1SentAt" <= $1
        AND ("blockedBot" = false OR "blockedBot" IS NULL)
    `, [twentyFourHoursAgo]) as User[];

    console.log(`📊 VIDEO1 Level 3: найдено ${usersToRemind.length} пользователей (>24ч после L2)`);

    for (const user of usersToRemind) {
      await this.sendVideo1ReminderLevel3(user);
    }
  }

  /**
   * Отправка VIDEO1 Level 1 (5 минут)
   */
  private async sendVideo1ReminderLevel1(user: User) {
    try {
      const firstName = user.firstName || 'Друг';
      const gender = this.detectGender(user.firstName);
      
      let text = `${firstName}, видео зависло? 🤔

Или решил(а/) обдумать? Это нормально — 
когда видишь чужие результаты, сначала кажется нереальным.

Но вот факт: 8 человек из вчерашней рассылки уже оплатили 
и получили доступ к инструментам. Сегодня они уже в деле 💪

Продолжим?`;

      text = this.personalizeText(text, gender);

      await this.bot.telegram.sendMessage(
        user.userId,
        text,
        Markup.inlineKeyboard([
          [Markup.button.callback('▶️ Смотреть дальше', 'continue_watching')]
        ])
      );

      const userRepository = AppDataSource.getRepository(User);
      user.reminderLevel1Video1 = true;
      user.reminderLevel1Video1SentAt = new Date();
      user.reminderLevel1Video1SentAt = new Date();
      await userRepository.save(user);

      console.log(`✅ VIDEO1 Level 1 отправлен пользователю ${user.userId}`);
    } catch (error: any) {
      // Проверяем, заблокировал ли пользователь бота
      if (this.isBlockedByUserError(error)) {
        await this.markUserAsBlocked(user.userId);
        return;
      }
      
      console.error(`❌ Ошибка отправки VIDEO1 Level 1 пользователю ${user.userId}:`, error.message);
    }
  }

  /**
   * Отправка VIDEO1 Level 2 (1 час)
   */
  private async sendVideo1ReminderLevel2(user: User) {
    try {
      const firstName = user.firstName || 'Друг';

      const text = `${firstName}, а ты знаешь что самое крутое?

90% тех кто дошел до конца воронки — оплатили в первый же день.
Потому что увидели реальную систему, а не очередной "волшебный курс".

Не хочешь смотреть видео? Понимаю, у всех мало времени.
Могу сразу показать ссылку на платный канал с инструментами.`;

      await this.bot.telegram.sendMessage(
        user.userId,
        text,
        Markup.inlineKeyboard([
          [Markup.button.callback('💎 Хочу сразу в канал', 'video1_skip_to_payment')],
          [Markup.button.callback('🎬 Досмотреть видео', 'continue_watching')]
        ])
      );

      const userRepository = AppDataSource.getRepository(User);
      user.reminderLevel2Video1 = true;
      user.reminderLevel2Video1SentAt = new Date();
      user.reminderLevel2Video1SentAt = new Date();
      await userRepository.save(user);

      console.log(`✅ VIDEO1 Level 2 отправлен пользователю ${user.userId}`);
    } catch (error: any) {
      // Проверяем, заблокировал ли пользователь бота
      if (this.isBlockedByUserError(error)) {
        await this.markUserAsBlocked(user.userId);
        return;
      }
      
      console.error(`❌ Ошибка отправки VIDEO1 Level 2 пользователю ${user.userId}:`, error.message);
    }
  }

  /**
   * Отправка VIDEO1 Level 3 (24 часа)
   */
  private async sendVideo1ReminderLevel3(user: User) {
    try {
      const firstName = user.firstName || 'Друг';
      const gender = this.detectGender(user.firstName);

      let text = `${firstName}, честно скажу — жалко терять тебя 😔

Ты уже потратил(а/) время на первое видео.
Осталось 5 минут до финала и кнопки оплаты.

После этого я больше не буду беспокоить. Обещаю.`;

      text = this.personalizeText(text, gender);

      await this.bot.telegram.sendMessage(
        user.userId,
        text,
        Markup.inlineKeyboard([
          [Markup.button.url('📨 Написать ассистенту', 'https://t.me/vetalsmirnov')],
          [Markup.button.callback('▶️ Закончить просмотр', 'continue_watching')]
        ])
      );

      const userRepository = AppDataSource.getRepository(User);
      user.reminderLevel3Video1 = true;
      user.reminderLevel3Video1SentAt = new Date();
      user.reminderLevel3Video1SentAt = new Date();
      await userRepository.save(user);

      console.log(`✅ VIDEO1 Level 3 отправлен пользователю ${user.userId}`);
    } catch (error: any) {
      // Проверяем, заблокировал ли пользователь бота
      if (this.isBlockedByUserError(error)) {
        await this.markUserAsBlocked(user.userId);
        return;
      }
      
      console.error(`❌ Ошибка отправки VIDEO1 Level 3 пользователю ${user.userId}:`, error.message);
    }
  }

  /**
   * ===== НОВАЯ СИСТЕМА: 3 уровня напоминаний для VIDEO2 =====
   */

  /**
   * Level 1: Проверка напоминаний VIDEO2 (5 минут)
   */
  private async checkVideo2RemindersLevel1() {
    const userRepository = AppDataSource.getRepository(User);
    const fiveMinutesAgo = new Date(Date.now() - this.LEVEL1_DELAY_MS);

    const usersToRemind = await userRepository.find({
      where: {
        currentStep: 'video2',
        hasPaid: false,
        reminderLevel1Video2: false,
        blockedBot: false,
      }
    });

    console.log(`📊 VIDEO2 Level 1: найдено ${usersToRemind.length} пользователей для проверки`);

    for (const user of usersToRemind) {
      if (user.currentStepChangedAt && user.currentStepChangedAt <= fiveMinutesAgo) {
        await this.sendVideo2ReminderLevel1(user);
      }
    }
  }

  /**
   * Level 2: Проверка напоминаний VIDEO2 (1 час после Level 1)
   */
  private async checkVideo2RemindersLevel2() {
    const oneHourAgo = new Date(Date.now() - this.LEVEL2_DELAY_MS);

    // Прямой SQL запрос - проверяем время отправки Level 1
    const usersToRemind = await AppDataSource.query(`
      SELECT * FROM users
      WHERE "currentStep" = 'video2'
        AND "hasPaid" = false
        AND "reminderLevel1Video2" = true
        AND "reminderLevel2Video2" = false
        AND "reminderLevel1Video2SentAt" IS NOT NULL
        AND "reminderLevel1Video2SentAt" <= $1
        AND ("blockedBot" = false OR "blockedBot" IS NULL)
    `, [oneHourAgo]) as User[];

    console.log(`📊 VIDEO2 Level 2: найдено ${usersToRemind.length} пользователей (>1ч после L1)`);

    for (const user of usersToRemind) {
      await this.sendVideo2ReminderLevel2(user);
    }
  }

  /**
   * Level 3: Проверка напоминаний VIDEO2 (24 часа после Level 2)
   */
  private async checkVideo2RemindersLevel3() {
    const twentyFourHoursAgo = new Date(Date.now() - this.LEVEL3_DELAY_MS);

    // Прямой SQL запрос - проверяем время отправки Level 2
    const usersToRemind = await AppDataSource.query(`
      SELECT * FROM users
      WHERE "currentStep" = 'video2'
        AND "hasPaid" = false
        AND "reminderLevel2Video2" = true
        AND "reminderLevel3Video2" = false
        AND "reminderLevel2Video2SentAt" IS NOT NULL
        AND "reminderLevel2Video2SentAt" <= $1
        AND ("blockedBot" = false OR "blockedBot" IS NULL)
    `, [twentyFourHoursAgo]) as User[];

    console.log(`📊 VIDEO2 Level 3: найдено ${usersToRemind.length} пользователей (>24ч после L2)`);

    for (const user of usersToRemind) {
      await this.sendVideo2ReminderLevel3(user);
    }
  }

  /**
   * Отправка VIDEO2 Level 1 (5 минут)
   */
  private async sendVideo2ReminderLevel1(user: User) {
    try {
      const firstName = user.firstName || 'Друг';
      const gender = this.detectGender(user.firstName);
      
      let text = `${firstName}, осталось совсем чуть-чуть! 🔥

Ты уже прошел(ла/) 60% воронки.
Третье видео — самое важное, там я показываю 
КАК ИМЕННО работают инструменты.

Не останавливайся на середине 😊`;

      text = this.personalizeText(text, gender);

      await this.bot.telegram.sendMessage(
        user.userId,
        text,
        Markup.inlineKeyboard([
          [Markup.button.callback('▶️ Последнее видео', 'ready_for_more')]
        ])
      );

      const userRepository = AppDataSource.getRepository(User);
      user.reminderLevel1Video2 = true;
      user.reminderLevel1Video2SentAt = new Date();
      user.reminderLevel1Video2SentAt = new Date();
      await userRepository.save(user);

      console.log(`✅ VIDEO2 Level 1 отправлен пользователю ${user.userId}`);
    } catch (error: any) {
      // Проверяем, заблокировал ли пользователь бота
      if (this.isBlockedByUserError(error)) {
        await this.markUserAsBlocked(user.userId);
        return;
      }
      
      console.error(`❌ Ошибка отправки VIDEO2 Level 1 пользователю ${user.userId}:`, error.message);
    }
  }

  /**
   * Отправка VIDEO2 Level 2 (1 час)
   */
  private async sendVideo2ReminderLevel2(user: User) {
    try {
      const firstName = user.firstName || 'Друг';

      const text = `${firstName}, вопрос: что останавливает?

Если видео слишком длинные — могу сразу дать ссылку на канал.
Если есть вопросы — напиши ассистенту.
Если просто откладываешь на потом — не откладывай, цена может вырасти.`;

      await this.bot.telegram.sendMessage(
        user.userId,
        text,
        Markup.inlineKeyboard([
          [Markup.button.url('💬 Задать вопрос', 'https://t.me/vetalsmirnov')],
          [Markup.button.callback('💎 Хочу сразу в канал', 'video2_skip_to_payment')]
        ])
      );

      const userRepository = AppDataSource.getRepository(User);
      user.reminderLevel2Video2 = true;
      user.reminderLevel2Video2SentAt = new Date();
      user.reminderLevel2Video2SentAt = new Date();
      await userRepository.save(user);

      console.log(`✅ VIDEO2 Level 2 отправлен пользователю ${user.userId}`);
    } catch (error: any) {
      // Проверяем, заблокировал ли пользователь бота
      if (this.isBlockedByUserError(error)) {
        await this.markUserAsBlocked(user.userId);
        return;
      }
      
      console.error(`❌ Ошибка отправки VIDEO2 Level 2 пользователю ${user.userId}:`, error.message);
    }
  }

  /**
   * Отправка VIDEO2 Level 3 (24 часа) с фото
   */
  private async sendVideo2ReminderLevel3(user: User) {
    try {
      const firstName = user.firstName || 'Друг';
      const gender = this.detectGender(user.firstName);

      let text = `${firstName}, ок, понял(а/). Ты из тех кто думает долго 🤓

Но вот честный факт: те кто оплатили вчера — 
уже сняли свои первые рилс по моим шаблонам.

А ты всё ещё тут. Последний шанс присоединиться.`;

      text = this.personalizeText(text, gender);

      // Отправляем фото с текстом
      await this.bot.telegram.sendPhoto(
        user.userId,
        { source: './Image_2_screen.jpeg' },
        {
          caption: text,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎬 Закончить путь', callback_data: 'ready_for_more' }],
              [{ text: '❌ Не интересно', callback_data: 'not_interested' }]
            ]
          }
        }
      );

      const userRepository = AppDataSource.getRepository(User);
      user.reminderLevel3Video2 = true;
      user.reminderLevel3Video2SentAt = new Date();
      user.reminderLevel3Video2SentAt = new Date();
      await userRepository.save(user);

      console.log(`✅ VIDEO2 Level 3 отправлен пользователю ${user.userId}`);
    } catch (error: any) {
      // Проверяем, заблокировал ли пользователь бота
      if (this.isBlockedByUserError(error)) {
        await this.markUserAsBlocked(user.userId);
        return;
      }
      
      console.error(`❌ Ошибка отправки VIDEO2 Level 3 пользователю ${user.userId}:`, error.message);
    }
  }

  /**
   * ===== НОВАЯ СИСТЕМА: 3 уровня напоминаний для VIDEO3 =====
   */

  /**
   * Level 1: Проверка напоминаний VIDEO3 (5 минут)
   */
  private async checkVideo3RemindersLevel1() {
    const userRepository = AppDataSource.getRepository(User);
    const fiveMinutesAgo = new Date(Date.now() - this.LEVEL1_DELAY_MS);

    console.log(`[VIDEO3 L1] Starting check. Looking for users on video3, not paid, reminder not sent yet`);
    
    // Используем прямой SQL запрос вместо repository.find() чтобы избежать проблем с кешированием TypeORM
    const usersToRemind = await AppDataSource.query(`
      SELECT * FROM users
      WHERE "currentStep" = 'video3'
        AND "hasPaid" = false
        AND "reminderLevel1Video3" = false
        AND "currentStepChangedAt" <= $1
        AND ("blockedBot" = false OR "blockedBot" IS NULL)
    `, [fiveMinutesAgo]) as User[];

    console.log(`[VIDEO3 L1] Query returned ${usersToRemind.length} users`);
    console.log(`[VIDEO3 L1] Filtering by time: currentStepChangedAt <= ${fiveMinutesAgo.toISOString()}`);
    console.log(`📊 VIDEO3 Level 1: найдено ${usersToRemind.length} пользователей для проверки`);

    for (const user of usersToRemind) {
      console.log(`[VIDEO3 L1] Sending reminder to user ${user.userId} (${user.firstName})`);
      await this.sendVideo3ReminderLevel1(user);
    }
  }

  /**
   * Level 2: Проверка напоминаний VIDEO3 (1 час после Level 1)
   */
  private async checkVideo3RemindersLevel2() {
    const oneHourAgo = new Date(Date.now() - this.LEVEL2_DELAY_MS);

    // Прямой SQL запрос - проверяем время отправки Level 1
    const usersToRemind = await AppDataSource.query(`
      SELECT * FROM users
      WHERE "currentStep" = 'video3'
        AND "hasPaid" = false
        AND "reminderLevel1Video3" = true
        AND "reminderLevel2Video3" = false
        AND "reminderLevel1Video3SentAt" IS NOT NULL
        AND "reminderLevel1Video3SentAt" <= $1
        AND ("blockedBot" = false OR "blockedBot" IS NULL)
    `, [oneHourAgo]) as User[];

    console.log(`📊 VIDEO3 Level 2: найдено ${usersToRemind.length} пользователей (>1ч после L1)`);

    for (const user of usersToRemind) {
      await this.sendVideo3ReminderLevel2(user);
    }
  }

  /**
   * Level 3: Проверка напоминаний VIDEO3 (24 часа после Level 2)
   */
  private async checkVideo3RemindersLevel3() {
    const twentyFourHoursAgo = new Date(Date.now() - this.LEVEL3_DELAY_MS);

    // Прямой SQL запрос - проверяем время отправки Level 2
    const usersToRemind = await AppDataSource.query(`
      SELECT * FROM users
      WHERE "currentStep" = 'video3'
        AND "hasPaid" = false
        AND "reminderLevel2Video3" = true
        AND "reminderLevel3Video3" = false
        AND "reminderLevel2Video3SentAt" IS NOT NULL
        AND "reminderLevel2Video3SentAt" <= $1
        AND ("blockedBot" = false OR "blockedBot" IS NULL)
    `, [twentyFourHoursAgo]) as User[];

    console.log(`📊 VIDEO3 Level 3: найдено ${usersToRemind.length} пользователей (>24ч после L2)`);

    for (const user of usersToRemind) {
      await this.sendVideo3ReminderLevel3(user);
    }
  }

  /**
   * Отправка VIDEO3 Level 1 (5 минут) с фото
   */
  private async sendVideo3ReminderLevel1(user: User) {
    try {
      console.log(`[VIDEO3 L1 SEND] Starting send to user ${user.userId} (${user.firstName})`);
      
      const firstName = user.firstName || 'Друг';
      const gender = this.detectGender(user.firstName);
      
      let text = `${firstName}, ты прошел(ла/) ВСЮ воронку! 🎉

Это значит что система тебя зацепила.
Осталось только выбрать способ оплаты и получить доступ.

Кстати, в канале сейчас 110+ человек. 
Через неделю там будет 200+. 
Чем раньше войдешь — тем больше поддержки получишь от первых участников 💪`;

      text = this.personalizeText(text, gender);

      // Отправляем фото с текстом
      await this.bot.telegram.sendPhoto(
        user.userId,
        { source: './Image_3_screen.jpeg' },
        {
          caption: text,
          reply_markup: {
            inline_keyboard: [
              [{ text: '� Оплатить в рублях (RUB) - Tribute', url: 'https://t.me/tribute/app?startapp=sF8Z' }],
              [{ text: '💳 Оплатить в евро (EUR) - Tribute', url: 'https://t.me/tribute/app?startapp=sFe6' }],
              [{ text: '💴 Оплатить в гривнах (UAH)', callback_data: 'pay_uah' }]
            ]
          }
        }
      );

      console.log(`[VIDEO3 L1 SEND] Photo sent successfully, updating database...`);
      
      const userRepository = AppDataSource.getRepository(User);
      user.reminderLevel1Video3 = true;
      user.reminderLevel1Video3SentAt = new Date();
      await userRepository.save(user);

      console.log(`✅ VIDEO3 Level 1 отправлен пользователю ${user.userId}`);
    } catch (error: any) {
      // Проверяем, заблокировал ли пользователь бота
      if (this.isBlockedByUserError(error)) {
        await this.markUserAsBlocked(user.userId);
        return;
      }
      
      console.error(`❌ [VIDEO3 L1 SEND] Ошибка отправки пользователю ${user.userId}:`);
      console.error(`   Error type: ${error.constructor.name}`);
      console.error(`   Error message: ${error.message}`);
      console.error(`   Error stack:`, error.stack);
    }
  }

  /**
   * Отправка VIDEO3 Level 2 (1 час)
   */
  private async sendVideo3ReminderLevel2(user: User) {
    try {
      const firstName = user.firstName || 'Друг';
      const gender = this.detectGender(user.firstName);

      let text = `${firstName}, серьёзно? 😅

Ты уже посмотрел(а/) все 3 видео, увидел(а/) результаты, 
понял(а/) систему... и остановился(ась/) в одном шаге от цели?

Может что-то не понятно с оплатой? 
Напиши ассистенту — он поможет за 2 минуты.`;

      text = this.personalizeText(text, gender);

      await this.bot.telegram.sendMessage(
        user.userId,
        text,
        Markup.inlineKeyboard([
          [Markup.button.url('� Оплатить в рублях (RUB) - Tribute', 'https://t.me/tribute/app?startapp=sF8Z')],
          [Markup.button.url('💳 Оплатить в евро (EUR) - Tribute', 'https://t.me/tribute/app?startapp=sFe6')],
          [Markup.button.callback('💴 Оплатить в гривнах (UAH)', 'pay_uah')],
          [Markup.button.url('📨 Написать ассистенту', 'https://t.me/vetalsmirnov')]
        ])
      );

      const userRepository = AppDataSource.getRepository(User);
      user.reminderLevel2Video3 = true;
      user.reminderLevel2Video3SentAt = new Date();
      await userRepository.save(user);

      console.log(`✅ VIDEO3 Level 2 отправлен пользователю ${user.userId}`);
    } catch (error: any) {
      // Проверяем, заблокировал ли пользователь бота
      if (this.isBlockedByUserError(error)) {
        await this.markUserAsBlocked(user.userId);
        return;
      }
      
      console.error(`❌ Ошибка отправки VIDEO3 Level 2 пользователю ${user.userId}:`, error.message);
    }
  }

  /**
   * Отправка VIDEO3 Level 3 (24 часа)
   */
  private async sendVideo3ReminderLevel3(user: User) {
    try {
      const firstName = user.firstName || 'Друг';
      const gender = this.detectGender(user.firstName);

      let text = `${firstName}, это моё последнее сообщение. Обещаю.

Ты прошел(ла/) весь путь. Значит тема интересна.
Но почему-то не оплачиваешь.

Если цена кусается — напиши ассистенту, возможно найдём вариант.
Если просто откладываешь — не откладывай, завтра может быть поздно.

Решай сейчас.`;

      text = this.personalizeText(text, gender);

      await this.bot.telegram.sendMessage(
        user.userId,
        text,
        Markup.inlineKeyboard([
          [Markup.button.url('� Оплатить в рублях (RUB) - Tribute', 'https://t.me/tribute/app?startapp=sF8Z')],
          [Markup.button.url('💳 Оплатить в евро (EUR) - Tribute', 'https://t.me/tribute/app?startapp=sFe6')],
          [Markup.button.callback('💴 Оплатить в гривнах (UAH)', 'pay_uah')],
          [Markup.button.url('💬 Обсудить цену', 'https://t.me/vetalsmirnov')]
        ])
      );

      const userRepository = AppDataSource.getRepository(User);
      user.reminderLevel3Video3 = true;
      user.reminderLevel3Video3SentAt = new Date();
      await userRepository.save(user);

      console.log(`✅ VIDEO3 Level 3 отправлен пользователю ${user.userId}`);
    } catch (error: any) {
      // Проверяем, заблокировал ли пользователь бота
      if (this.isBlockedByUserError(error)) {
        await this.markUserAsBlocked(user.userId);
        return;
      }
      
      console.error(`❌ Ошибка отправки VIDEO3 Level 3 пользователю ${user.userId}:`, error.message);
    }
  }

  /**
   * ===== СТАРАЯ СИСТЕМА (для payment_choice) =====
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
        paymentChoiceShownAt: MoreThan(new Date(0)), // Проверяем что поле установлено
        blockedBot: false // Исключаем заблокировавших бота
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
        waitingReceiptSince: MoreThan(new Date(0)),
        blockedBot: false // Исключаем заблокировавших бота
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
    } catch (error: any) {
      // Проверяем, заблокировал ли пользователь бота
      if (this.isBlockedByUserError(error)) {
        await this.markUserAsBlocked(user.userId);
        return;
      }
      
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
    } catch (error: any) {
      // Проверяем, заблокировал ли пользователь бота
      if (this.isBlockedByUserError(error)) {
        await this.markUserAsBlocked(user.userId);
        return;
      }
      
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
    } catch (error: any) {
      // Проверяем, заблокировал ли пользователь бота
      if (this.isBlockedByUserError(error)) {
        await this.markUserAsBlocked(user.userId);
        return;
      }
      
      console.error(`❌ Ошибка отправки напоминания video1 пользователю ${user.userId}:`, error);
    }
  }
}
