/**
 * Сервис управления цепочкой рассылки курса "Снимите это немедленно!"
 */

import { AppDataSource } from '../database';
import { CourseChainProgress } from '../entities/CourseChainProgress';
import { Telegraf } from 'telegraf';
import * as fs from 'fs';
import * as path from 'path';

// FILE_IDs для быстрой отправки (без загрузки файлов каждый раз)
const FILE_IDS = {
  banner1: 'AgACAgIAAxkDAAKmqWk2YxAfrhfFePzsjml3O4D3ism9AAInEGsbgRGwSd3rAilx2BrgAQADAgADdwADNgQ',
  banner2: 'AgACAgIAAxkDAAKmqmk2YywXEwZEYK4Yrl5RbqXDmAyOAAIsEGsbgRGwSTZj0fBse-1BAQADAgADdwADNgQ',
  banner3: 'AgACAgIAAxkDAAKmt2k2bPjIGA8DEl_-GgtBcV06HlwkAAJgEGsbgRGwSeisdfBfez2oAQADAgADdwADNgQ',
  banner4: 'AgACAgIAAxkDAAKmuGk2bQ1BMtQPR5Vsn_lrjP06d8aOAAJiEGsbgRGwSQwccsfnyho8AQADAgADdwADNgQ'
};

const ADMIN_ID = 278263484;

// Контент сообщений (импортируем из broadcast_course_chain.ts)
const MESSAGES_CONTENT = {
  msg1: {
    image: FILE_IDS.banner1,
    text: `Привет, {firstName}! ✨ Это Юля.

Ты интересовался(ась) промтами для рилс - и я хочу рассказать тебе кое-что раньше других.

<b>12 декабря открываю продажи на курс «Снимите это немедленно!»</b> - система рилс, которые приводят клиентов. Не охваты, а деньги.

Для тебя ранний доступ уже открыт + скидка 10%.

<b>Что внутри:</b>

- 9 уроков: от ЦА до автоворонки
- 34 формата рилс под любую нишу
- Все промты + система использования
- Клуб + звонки со мной
- Опционально: 7 уроков по монтажу

Хочешь подробнее? 👇`,
    buttons: [
      [{ text: '🔥 Посмотреть программу', callback_data: 'course_msg2_trigger' }],
      [{ text: '✍️ Написать Юле', url: 'https://t.me/JFilipenko' }],
      [{ text: '🎟 Занять место', callback_data: 'course_reserve_spot' }]
    ]
  },
  msg2: {
    image: FILE_IDS.banner2,
    text: `Расскажу подробнее 🙌

<b>«Снимите это немедленно!»</b> - система, которую я собирала 3 года.

<b>Для кого:</b>

→ Охваты не конвертируются в деньги
→ Снимаешь, но результат - лотерея
→ Не знаешь с чего начать / боишься камеры
→ Хочешь систему без выгорания

<b>Что внутри:</b>

🎯 Уроки 1-2: Архетип + глубокий анализ ЦА
📈 Урок 3: Алгоритмы и прогрев аккаунта
🤖 Урок 4: Все промты - идеи, хуки, CTA
🎬 Уроки 5-6: 34 формата + сторителлинг
💰 Урок 7: Автоворонки и сбор лидов
🚀 Урок 8: Продвижение после публикации
💪 Урок 9: Страхи и выгорание

<b>+ Опционально:</b> 7 уроков по монтажу от эксперта

<b>Бонусы:</b> клуб на месяц, звонки со мной, чат, челлендж «30 рилс»

Как проходит курс? 👇`,
    buttons: [
      [{ text: '📋 Подробнее про формат', callback_data: 'course_msg3_trigger' }],
      [{ text: '✍️ Написать Юле', url: 'https://t.me/JFilipenko' }],
      [{ text: '🎟 Занять место', callback_data: 'course_reserve_spot' }]
    ]
  },
  msg3: {
    image: FILE_IDS.banner3,
    text: `Отвечу на частые вопросы:

<b>«Нет времени»</b> - Уроки в записи, 15-20 мин каждый. Смотри когда удобно.

<b>«Не умею монтаж»</b> - Курс про смыслы, не монтаж. Но есть отдельный модуль, если захочешь.

<b>«Боюсь камеры»</b> - Есть урок про это + форматы без лица + поддержка в чате.

<b>«Рилс - лотерея»</b> - Нет. Это система. Я научу тебя управлять алгоритмами.

<b>«А если не получится?»</b> - Задания + обратная связь + 4 звонка со мной.

<b>Что входит:</b>

✅ 9 уроков (доступ навсегда)
✅ Задания к каждому уроку
✅ Чат для поддержки
✅ 4 групповых звонка
✅ Клуб на месяц
✅ Промты, карта форматов, чек-листы

<b>Опционально:</b> +7 уроков монтажа с LUT, шрифтами, шаблонами

Показать тебе тарифы? 👇`,
    buttons: [
      [{ text: '💰 Посмотреть тарифы', callback_data: 'course_msg4_trigger' }],
      [{ text: '✍️ Написать Юле', url: 'https://t.me/JFilipenko' }],
      [{ text: '🎟 Занять место', callback_data: 'course_reserve_spot' }]
    ]
  },
  msg4: {
    image: FILE_IDS.banner4,
    text: `Вот конкретика 👇

<b>Твой результат после курса:</b>

→ Понимание ЦА: что болит, за сколько заплатят
→ Система рилс без хаоса
→ 34 формата + адаптация трендов
→ Воронка: рилс → лид → клиент
→ Уверенность и план на месяцы

<b>Тарифы (скидка 10% для тебя):</b>

🎯 <b>Базовый:</b> <s>$550</s> → <b>$495</b>
9 уроков + материалы + клуб + звонки

💎 <b>Курс + Монтаж:</b> <s>$750</s> → <b>$675</b>
Всё из базового + 7 уроков монтажа

🎬 <b>Только монтаж:</b> <s>$300</s> → <b>$270</b>

<b>Почему сейчас:</b>

⏰ Скидка 10% только до 12 декабря
⏰ Мест всего 20

<b>Бронь:</b> переведи любую сумму от 10$ чтобы забронировать своё место сейчас.`,
    buttons: [
      [{ text: '🔥 Забронировать место', url: 'https://t.me/tribute/app?startapp=dzWu' }],
      [{ text: '✍️ Написать Юле', url: 'https://t.me/JFilipenko' }]
    ]
  }
};

export class CourseChainService {
  private bot: Telegraf;
  
  constructor(bot: Telegraf) {
    this.bot = bot;
  }
  
  /**
   * Получить или создать запись прогресса пользователя
   */
  async getOrCreateProgress(userId: number, username?: string, firstName?: string): Promise<CourseChainProgress> {
    const repo = AppDataSource.getRepository(CourseChainProgress);
    
    let progress = await repo.findOne({ where: { userId } });
    
    if (!progress) {
      progress = new CourseChainProgress();
      progress.userId = userId;
      progress.username = username;
      progress.firstName = firstName;
      progress.msg1Status = 'pending';
      progress.msg2Status = 'pending';
      progress.msg3Status = 'pending';
      progress.msg4Status = 'pending';
      await repo.save(progress);
    }
    
    return progress;
  }
  
  /**
   * Отправить сообщение пользователю
   */
  async sendMessage(userId: number, messageNum: 1 | 2 | 3 | 4, firstName?: string): Promise<boolean> {
    const msgKey = `msg${messageNum}` as keyof typeof MESSAGES_CONTENT;
    const msgData = MESSAGES_CONTENT[msgKey];
    
    try {
      const name = firstName || 'друг';
      const personalizedText = msgData.text.replace('{firstName}', name);
      
      // Используем file_id для мгновенной отправки
      await this.bot.telegram.sendPhoto(
        userId,
        msgData.image,  // file_id строка
        {
          caption: personalizedText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: msgData.buttons as any
          }
        }
      );
      
      // Обновляем статус в БД
      const repo = AppDataSource.getRepository(CourseChainProgress);
      const progress = await this.getOrCreateProgress(userId, undefined, firstName);
      
      const statusField = `msg${messageNum}Status` as keyof CourseChainProgress;
      const sentAtField = `msg${messageNum}SentAt` as keyof CourseChainProgress;
      
      (progress as any)[statusField] = 'sent';
      (progress as any)[sentAtField] = new Date();
      
      await repo.save(progress);
      
      return true;
    } catch (error: any) {
      // Если пользователь заблокировал бота
      if (error.code === 403) {
        const repo = AppDataSource.getRepository(CourseChainProgress);
        const progress = await this.getOrCreateProgress(userId);
        progress.blocked = true;
        await repo.save(progress);
      }
      return false;
    }
  }
  
  /**
   * Отметить клик на кнопку и отправить следующее сообщение
   */
  async handleButtonClick(userId: number, messageNum: 1 | 2 | 3 | 4, firstName?: string): Promise<void> {
    await this.handleButtonClickWithResult(userId, messageNum, firstName);
  }

  /**
   * Отметить клик на кнопку и отправить следующее сообщение.
   * Возвращает true если следующее сообщение было отправлено, false если уже было отправлено ранее.
   */
  async handleButtonClickWithResult(userId: number, messageNum: 1 | 2 | 3 | 4, firstName?: string): Promise<boolean> {
    const repo = AppDataSource.getRepository(CourseChainProgress);
    const progress = await this.getOrCreateProgress(userId, undefined, firstName);
    
    // Отмечаем клик
    const clickedAtField = `msg${messageNum}ClickedAt` as keyof CourseChainProgress;
    const statusField = `msg${messageNum}Status` as keyof CourseChainProgress;
    
    (progress as any)[clickedAtField] = new Date();
    (progress as any)[statusField] = 'clicked';
    await repo.save(progress);
    
    // Отправляем следующее сообщение, если оно есть и ещё не отправлено
    if (messageNum < 4) {
      const nextMsgNum = (messageNum + 1) as 1 | 2 | 3 | 4;
      const nextStatusField = `msg${nextMsgNum}Status` as keyof CourseChainProgress;
      
      if ((progress as any)[nextStatusField] === 'pending') {
        await this.sendMessage(userId, nextMsgNum, firstName);
        return true;
      }
    }
    return false;
  }
  
  /**
   * Отметить бронирование места
   */
  async markReserved(userId: number): Promise<void> {
    const repo = AppDataSource.getRepository(CourseChainProgress);
    const progress = await this.getOrCreateProgress(userId);
    progress.reservedSpot = true;
    progress.reservedAt = new Date();
    await repo.save(progress);
  }
  
  /**
   * Получить пользователей для автоотправки по времени
   */
  async getUsersForAutoSend(messageNum: 2 | 3 | 4): Promise<CourseChainProgress[]> {
    const repo = AppDataSource.getRepository(CourseChainProgress);
    
    const now = new Date();
    const prevMsgNum = messageNum - 1;
    
    // Определяем время задержки
    let delayMs: number;
    switch (messageNum) {
      case 2: delayMs = 6 * 60 * 60 * 1000; break;  // 6 часов
      case 3: delayMs = 1 * 60 * 60 * 1000; break;  // 1 час
      case 4: delayMs = 30 * 60 * 1000; break;      // 30 минут
    }
    
    const cutoffTime = new Date(now.getTime() - delayMs);
    
    // Находим пользователей которые:
    // 1. Получили предыдущее сообщение
    // 2. НЕ кликнули на кнопку предыдущего сообщения
    // 3. НЕ получили текущее сообщение
    // 4. Прошло достаточно времени с отправки предыдущего
    // 5. Не заблокировали бота
    
    const query = repo.createQueryBuilder('p')
      .where(`p.msg${prevMsgNum}Status = 'sent'`)
      .andWhere(`p.msg${prevMsgNum}ClickedAt IS NULL`)
      .andWhere(`p.msg${messageNum}Status = 'pending'`)
      .andWhere(`p.msg${prevMsgNum}SentAt < :cutoffTime`, { cutoffTime })
      .andWhere('p.blocked = false');
    
    return query.getMany();
  }
  
  /**
   * Получить статистику цепочки
   */
  async getStats(): Promise<{
    total: number;
    msg1: { sent: number; clicked: number; pending: number };
    msg2: { sent: number; clicked: number; pending: number };
    msg3: { sent: number; clicked: number; pending: number };
    msg4: { sent: number; clicked: number; pending: number };
    reserved: number;
    blocked: number;
  }> {
    const repo = AppDataSource.getRepository(CourseChainProgress);
    
    const total = await repo.count();
    const blocked = await repo.count({ where: { blocked: true } });
    const reserved = await repo.count({ where: { reservedSpot: true } });
    
    const getStatusCounts = async (msgNum: number) => {
      const sent = await repo.count({ where: { [`msg${msgNum}Status`]: 'sent' } as any });
      const clicked = await repo.count({ where: { [`msg${msgNum}Status`]: 'clicked' } as any });
      const pending = await repo.count({ where: { [`msg${msgNum}Status`]: 'pending' } as any });
      return { sent, clicked, pending };
    };
    
    return {
      total,
      msg1: await getStatusCounts(1),
      msg2: await getStatusCounts(2),
      msg3: await getStatusCounts(3),
      msg4: await getStatusCounts(4),
      reserved,
      blocked
    };
  }
  
  /**
   * Форматировать статистику для отправки в Telegram
   */
  async formatStatsMessage(): Promise<string> {
    const stats = await this.getStats();
    
    return `📊 <b>Статистика цепочки курса</b>\n\n` +
      `👥 Всего в цепочке: ${stats.total}\n` +
      `🚫 Заблокировали: ${stats.blocked}\n` +
      `🎟 Забронировали: ${stats.reserved}\n\n` +
      `<b>Сообщение 1 (мягкий вход):</b>\n` +
      `  📤 Отправлено: ${stats.msg1.sent + stats.msg1.clicked}\n` +
      `  👆 Кликнули: ${stats.msg1.clicked}\n` +
      `  ⏳ Ожидают: ${stats.msg1.pending}\n\n` +
      `<b>Сообщение 2 (программа):</b>\n` +
      `  📤 Отправлено: ${stats.msg2.sent + stats.msg2.clicked}\n` +
      `  👆 Кликнули: ${stats.msg2.clicked}\n` +
      `  ⏳ Ожидают: ${stats.msg2.pending}\n\n` +
      `<b>Сообщение 3 (возражения):</b>\n` +
      `  📤 Отправлено: ${stats.msg3.sent + stats.msg3.clicked}\n` +
      `  👆 Кликнули: ${stats.msg3.clicked}\n` +
      `  ⏳ Ожидают: ${stats.msg3.pending}\n\n` +
      `<b>Сообщение 4 (тарифы):</b>\n` +
      `  📤 Отправлено: ${stats.msg4.sent + stats.msg4.clicked}\n` +
      `  👆 Кликнули: ${stats.msg4.clicked}\n` +
      `  ⏳ Ожидают: ${stats.msg4.pending}`;
  }

  /**
   * Выполнить автоотправку по таймерам для всех сообщений 2, 3, 4
   */
  async runAutoSend(): Promise<number> {
    let totalSent = 0;

    for (const msgNum of [2, 3, 4] as const) {
      const users = await this.getUsersForAutoSend(msgNum);
      
      if (users.length > 0) {
        console.log(`📤 [AutoSend] Сообщение ${msgNum}: ${users.length} пользователей`);
        
        for (const user of users) {
          const success = await this.sendMessage(Number(user.userId), msgNum, user.firstName);
          if (success) {
            totalSent++;
          }
          // Небольшая пауза между отправками
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }

    return totalSent;
  }

  /**
   * Запустить автоотправку с интервалом (автоотключение через 24 часа)
   * @param intervalMinutes - интервал проверки в минутах (по умолчанию 10)
   * @param durationHours - через сколько часов отключить (по умолчанию 24)
   */
  startAutoSendScheduler(intervalMinutes: number = 10, durationHours: number = 24): void {
    const startTime = Date.now();
    const endTime = startTime + (durationHours * 60 * 60 * 1000);
    
    console.log(`\n🚀 [CourseChain] Автоотправка запущена!`);
    console.log(`   📅 Интервал: каждые ${intervalMinutes} минут`);
    console.log(`   ⏰ Автоотключение через: ${durationHours} часов`);
    console.log(`   🔚 Завершится: ${new Date(endTime).toLocaleString('ru-RU')}\n`);

    // Уведомляем админа о запуске
    this.bot.telegram.sendMessage(
      ADMIN_ID,
      `🚀 <b>Автоотправка цепочки запущена!</b>\n\n` +
      `📅 Интервал: каждые ${intervalMinutes} мин\n` +
      `⏰ Отключится через: ${durationHours}ч\n` +
      `🔚 Завершится: ${new Date(endTime).toLocaleString('ru-RU')}`,
      { parse_mode: 'HTML' }
    ).catch(console.error);

    const intervalId = setInterval(async () => {
      const now = Date.now();
      
      // Проверяем не пора ли выключаться
      if (now >= endTime) {
        clearInterval(intervalId);
        console.log(`\n✅ [CourseChain] Автоотправка завершена (прошло ${durationHours}ч)`);
        
        // Уведомляем админа и отправляем финальную статистику
        try {
          const stats = await this.formatStatsMessage();
          await this.bot.telegram.sendMessage(
            ADMIN_ID,
            `✅ <b>Автоотправка цепочки завершена!</b>\n\n` +
            `Прошло ${durationHours} часов с момента запуска.\n\n` +
            stats,
            { parse_mode: 'HTML' }
          );
        } catch (e) {
          console.error('Ошибка отправки финального уведомления:', e);
        }
        return;
      }

      // Выполняем автоотправку
      try {
        const sent = await this.runAutoSend();
        if (sent > 0) {
          const hoursRemaining = Math.round((endTime - now) / (60 * 60 * 1000));
          console.log(`✅ [AutoSend] Отправлено ${sent} сообщений (осталось ${hoursRemaining}ч)`);
          
          // Уведомляем админа только если что-то отправили
          await this.bot.telegram.sendMessage(
            ADMIN_ID,
            `⏰ <b>Автоотправка по таймерам</b>\n\n` +
            `📤 Отправлено: ${sent} сообщений\n` +
            `⏳ Осталось: ${hoursRemaining}ч`,
            { parse_mode: 'HTML' }
          );
        }
      } catch (error) {
        console.error('[AutoSend] Ошибка:', error);
      }
    }, intervalMinutes * 60 * 1000);

    // Первая проверка сразу
    setTimeout(async () => {
      try {
        const sent = await this.runAutoSend();
        if (sent > 0) {
          console.log(`✅ [AutoSend] Первичная проверка: отправлено ${sent} сообщений`);
        } else {
          console.log(`ℹ️ [AutoSend] Первичная проверка: пока никому не нужно отправлять`);
        }
      } catch (error) {
        console.error('[AutoSend] Ошибка первичной проверки:', error);
      }
    }, 5000); // Через 5 секунд после запуска
  }
}
