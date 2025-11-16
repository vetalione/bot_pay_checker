import { AppDataSource } from './database';
import { PaymentStats } from './entities/PaymentStats';
import { CurrentSteps } from './entities/CurrentSteps';

// Интерфейс для snapshot статистики
interface StatsSnapshot {
  timestamp: Date;
  totalUsers: number;
  successfulPayments: number;
  
  // Старые поля (legacy, оставляем для совместимости)
  stuckAtStart: number;
  stuckAtVideo1: number;
  stuckAtVideo2: number;
  stuckAtVideo3: number;
  stuckAtPaymentChoice: number;
  chosePaymentNoReceipt: number;
  receiptRejected: number;
  tributeClicksTotal: number;
  
  // Новые поля: распределение по currentStep
  currentStepStart: number;
  currentStepVideo1: number;
  currentStepVideo2: number;
  currentStepVideo3: number;
  currentStepPaymentChoice: number;
  currentStepWaitingReceipt: number;
  currentStepCompleted: number;
  
  // Новая система напоминаний START (3 уровня)
  reminderLevel1Start: number;
  reminderLevel2Start: number;
  reminderLevel3Start: number;
  
  // Новая система напоминаний VIDEO1 (3 уровня)
  reminderLevel1Video1: number;
  reminderLevel2Video1: number;
  reminderLevel3Video1: number;
  
  // Новая система напоминаний VIDEO2 (3 уровня)
  reminderLevel1Video2: number;
  reminderLevel2Video2: number;
  reminderLevel3Video2: number;
  
  // Новая система напоминаний VIDEO3 (3 уровня)
  reminderLevel1Video3: number;
  reminderLevel2Video3: number;
  reminderLevel3Video3: number;
  
  // Напоминания (старая система для других этапов)
  video1ReminderSent: number;
  paymentReminderSent: number;
  receiptReminderSent: number;
  
  // Методы оплаты
  paidUAH: number;
  paidRUB: number;
  paidEUR: number;
}

// Хранилище последнего snapshot (в памяти, для простоты)
let lastSnapshot: StatsSnapshot | null = null;

export class StatsService {
  /**
   * Получить агрегированную статистику по платежам
   */
  async getPaymentStats(): Promise<PaymentStats | null> {
    const statsRepository = AppDataSource.getRepository(PaymentStats);
    const stats = await statsRepository.findOne({ where: { id: 1 } });
    return stats;
  }

  /**
   * Получить статистику по воронке (текущие шаги пользователей)
   */
  async getCurrentSteps(): Promise<CurrentSteps | null> {
    const stepsRepository = AppDataSource.getRepository(CurrentSteps);
    const steps = await stepsRepository.findOne({ where: { id: 1 } });
    return steps;
  }

  /**
   * Получить расширенную статистику по кликам на кнопки Tribute
   */
  async getTributeClicksStats(): Promise<{ 
    rub: number; 
    eur: number;
    both: number;
    onlyRub: number;
    onlyEur: number;
    total: number;
    lastChoiceRub: number;
    lastChoiceEur: number;
  }> {
    try {
      // Пользователи кликавшие на RUB
      const rubClicks = await AppDataSource.query(
        `SELECT COUNT(DISTINCT "userId") as count FROM user_actions WHERE action = 'choose_rub_tribute'`
      );
      
      // Пользователи кликавшие на EUR
      const eurClicks = await AppDataSource.query(
        `SELECT COUNT(DISTINCT "userId") as count FROM user_actions WHERE action = 'choose_eur_tribute'`
      );
      
      // Пользователи кликавшие на обе кнопки
      const bothClicks = await AppDataSource.query(`
        WITH rub_users AS (
          SELECT DISTINCT "userId" FROM user_actions WHERE action = 'choose_rub_tribute'
        ),
        eur_users AS (
          SELECT DISTINCT "userId" FROM user_actions WHERE action = 'choose_eur_tribute'
        )
        SELECT COUNT(*) as count FROM rub_users r
        INNER JOIN eur_users e ON r."userId" = e."userId"
      `);
      
      // Последний выбор пользователей (финальное решение)
      const lastChoice = await AppDataSource.query(`
        WITH last_tribute_action AS (
          SELECT DISTINCT ON ("userId") 
            "userId", 
            action,
            timestamp
          FROM user_actions 
          WHERE action IN ('choose_rub_tribute', 'choose_eur_tribute')
          ORDER BY "userId", timestamp DESC
        )
        SELECT 
          COUNT(CASE WHEN action = 'choose_rub_tribute' THEN 1 END) as rub_final,
          COUNT(CASE WHEN action = 'choose_eur_tribute' THEN 1 END) as eur_final
        FROM last_tribute_action
      `);
      
      const rub = parseInt(rubClicks[0]?.count || '0');
      const eur = parseInt(eurClicks[0]?.count || '0');
      const both = parseInt(bothClicks[0]?.count || '0');
      
      return {
        rub, // всего кликали на RUB
        eur, // всего кликали на EUR
        both, // кликали на обе
        onlyRub: rub - both, // кликали только на RUB
        onlyEur: eur - both, // кликали только на EUR
        total: rub + eur - both, // уникальных пользователей всего
        lastChoiceRub: parseInt(lastChoice[0]?.rub_final || '0'), // финальный выбор RUB
        lastChoiceEur: parseInt(lastChoice[0]?.eur_final || '0'), // финальный выбор EUR
      };
    } catch (error) {
      console.error('Ошибка получения статистики Tribute:', error);
      return { 
        rub: 0, 
        eur: 0, 
        both: 0, 
        onlyRub: 0, 
        onlyEur: 0, 
        total: 0,
        lastChoiceRub: 0,
        lastChoiceEur: 0,
      };
    }
  }

  /**
   * Получить количество отправленных напоминаний по категориям
   */
  async getReminderStats(): Promise<{
    video1: number;
    paymentChoice: number;
    receipt: number;
    reminderLevel1Start: number;
    reminderLevel2Start: number;
    reminderLevel3Start: number;
    reminderLevel1Video1: number;
    reminderLevel2Video1: number;
    reminderLevel3Video1: number;
    reminderLevel1Video2: number;
    reminderLevel2Video2: number;
    reminderLevel3Video2: number;
    reminderLevel1Video3: number;
    reminderLevel2Video3: number;
    reminderLevel3Video3: number;
  }> {
    try {
      const video1Reminders = await AppDataSource.query(
        `SELECT COUNT(*) as count FROM users WHERE "video1ReminderSent" = true`
      );
      const paymentChoiceReminders = await AppDataSource.query(
        `SELECT COUNT(*) as count FROM users WHERE "paymentReminderSent" = true`
      );
      const receiptReminders = await AppDataSource.query(
        `SELECT COUNT(*) as count FROM users WHERE "receiptReminderSent" = true`
      );
      
      // Новая система START
      const reminderLevel1StartCount = await AppDataSource.query(
        `SELECT COUNT(*) as count FROM users WHERE "reminderLevel1Start" = true`
      );
      const reminderLevel2StartCount = await AppDataSource.query(
        `SELECT COUNT(*) as count FROM users WHERE "reminderLevel2Start" = true`
      );
      const reminderLevel3StartCount = await AppDataSource.query(
        `SELECT COUNT(*) as count FROM users WHERE "reminderLevel3Start" = true`
      );
      
      // Новая система VIDEO1
      const reminderLevel1Video1Count = await AppDataSource.query(
        `SELECT COUNT(*) as count FROM users WHERE "reminderLevel1Video1" = true`
      );
      const reminderLevel2Video1Count = await AppDataSource.query(
        `SELECT COUNT(*) as count FROM users WHERE "reminderLevel2Video1" = true`
      );
      const reminderLevel3Video1Count = await AppDataSource.query(
        `SELECT COUNT(*) as count FROM users WHERE "reminderLevel3Video1" = true`
      );
      
      // Новая система VIDEO2
      const reminderLevel1Video2Count = await AppDataSource.query(
        `SELECT COUNT(*) as count FROM users WHERE "reminderLevel1Video2" = true`
      );
      const reminderLevel2Video2Count = await AppDataSource.query(
        `SELECT COUNT(*) as count FROM users WHERE "reminderLevel2Video2" = true`
      );
      const reminderLevel3Video2Count = await AppDataSource.query(
        `SELECT COUNT(*) as count FROM users WHERE "reminderLevel3Video2" = true`
      );
      
      // Новая система VIDEO3
      const reminderLevel1Video3Count = await AppDataSource.query(
        `SELECT COUNT(*) as count FROM users WHERE "reminderLevel1Video3" = true`
      );
      const reminderLevel2Video3Count = await AppDataSource.query(
        `SELECT COUNT(*) as count FROM users WHERE "reminderLevel2Video3" = true`
      );
      const reminderLevel3Video3Count = await AppDataSource.query(
        `SELECT COUNT(*) as count FROM users WHERE "reminderLevel3Video3" = true`
      );

      return {
        video1: parseInt(video1Reminders[0]?.count || '0'),
        paymentChoice: parseInt(paymentChoiceReminders[0]?.count || '0'),
        receipt: parseInt(receiptReminders[0]?.count || '0'),
        reminderLevel1Start: parseInt(reminderLevel1StartCount[0]?.count || '0'),
        reminderLevel2Start: parseInt(reminderLevel2StartCount[0]?.count || '0'),
        reminderLevel3Start: parseInt(reminderLevel3StartCount[0]?.count || '0'),
        reminderLevel1Video1: parseInt(reminderLevel1Video1Count[0]?.count || '0'),
        reminderLevel2Video1: parseInt(reminderLevel2Video1Count[0]?.count || '0'),
        reminderLevel3Video1: parseInt(reminderLevel3Video1Count[0]?.count || '0'),
        reminderLevel1Video2: parseInt(reminderLevel1Video2Count[0]?.count || '0'),
        reminderLevel2Video2: parseInt(reminderLevel2Video2Count[0]?.count || '0'),
        reminderLevel3Video2: parseInt(reminderLevel3Video2Count[0]?.count || '0'),
        reminderLevel1Video3: parseInt(reminderLevel1Video3Count[0]?.count || '0'),
        reminderLevel2Video3: parseInt(reminderLevel2Video3Count[0]?.count || '0'),
        reminderLevel3Video3: parseInt(reminderLevel3Video3Count[0]?.count || '0'),
      };
    } catch (error) {
      console.error('Ошибка получения статистики напоминаний:', error);
      return { 
        video1: 0, 
        paymentChoice: 0, 
        receipt: 0,
        reminderLevel1Start: 0,
        reminderLevel2Start: 0,
        reminderLevel3Start: 0,
        reminderLevel1Video1: 0,
        reminderLevel2Video1: 0,
        reminderLevel3Video1: 0,
        reminderLevel1Video2: 0,
        reminderLevel2Video2: 0,
        reminderLevel3Video2: 0,
        reminderLevel1Video3: 0,
        reminderLevel2Video3: 0,
        reminderLevel3Video3: 0,
      };
    }
  }

  /**
   * Создать snapshot текущей статистики для отслеживания изменений
   */
  async createSnapshot(): Promise<void> {
    try {
      const stats = await this.getPaymentStats();
      const steps = await this.getCurrentSteps();
      const tributeClicks = await this.getTributeClicksStats();
      const reminders = await this.getReminderStats();

      if (!stats || !steps) {
        return;
      }

      // Получаем распределение по currentStep
      const currentStepDistribution = await AppDataSource.query(`
        SELECT 
          "currentStep",
          COUNT(*) as count
        FROM users
        GROUP BY "currentStep"
      `);
      
      const getStepCount = (step: string): number => {
        const found = currentStepDistribution.find((row: any) => row.currentStep === step);
        return parseInt(found?.count || '0');
      };

      // Получаем методы оплаты
      const paymentMethods = await AppDataSource.query(`
        SELECT 
          currency,
          COUNT(*) as count
        FROM users
        WHERE "hasPaid" = true
        GROUP BY currency
      `);
      
      const getPaymentCount = (currency: string): number => {
        const found = paymentMethods.find((row: any) => row.currency === currency);
        return parseInt(found?.count || '0');
      };

      lastSnapshot = {
        timestamp: new Date(),
        totalUsers: stats.total_users_started,
        successfulPayments: stats.total_successful_payments,
        
        // Legacy поля
        stuckAtStart: steps.stuck_at_start,
        stuckAtVideo1: steps.stuck_at_video1,
        stuckAtVideo2: steps.stuck_at_video2,
        stuckAtVideo3: steps.stuck_at_video3,
        stuckAtPaymentChoice: steps.stuck_at_payment_choice,
        chosePaymentNoReceipt: steps.chose_payment_no_receipt,
        receiptRejected: steps.receipt_rejected,
        tributeClicksTotal: tributeClicks.total,
        
        // Новые: распределение по currentStep
        currentStepStart: getStepCount('start'),
        currentStepVideo1: getStepCount('video1'),
        currentStepVideo2: getStepCount('video2'),
        currentStepVideo3: getStepCount('video3'),
        currentStepPaymentChoice: getStepCount('payment_choice'),
        currentStepWaitingReceipt: getStepCount('waiting_receipt'),
        currentStepCompleted: getStepCount('completed'),
        
        // Новая система START
        reminderLevel1Start: reminders.reminderLevel1Start,
        reminderLevel2Start: reminders.reminderLevel2Start,
        reminderLevel3Start: reminders.reminderLevel3Start,
        
        // Новая система VIDEO1
        reminderLevel1Video1: reminders.reminderLevel1Video1,
        reminderLevel2Video1: reminders.reminderLevel2Video1,
        reminderLevel3Video1: reminders.reminderLevel3Video1,
        
        // Новая система VIDEO2
        reminderLevel1Video2: reminders.reminderLevel1Video2,
        reminderLevel2Video2: reminders.reminderLevel2Video2,
        reminderLevel3Video2: reminders.reminderLevel3Video2,
        
        // Новая система VIDEO3
        reminderLevel1Video3: reminders.reminderLevel1Video3,
        reminderLevel2Video3: reminders.reminderLevel2Video3,
        reminderLevel3Video3: reminders.reminderLevel3Video3,
        
        // Напоминания
        video1ReminderSent: reminders.video1,
        paymentReminderSent: reminders.paymentChoice,
        receiptReminderSent: reminders.receipt,
        
        // Методы оплаты
        paidUAH: getPaymentCount('UAH'),
        paidRUB: getPaymentCount('RUB'),
        paidEUR: getPaymentCount('EUR'),
      };
    } catch (error) {
      console.error('Ошибка создания snapshot:', error);
    }
  }

  /**
   * Получить изменения с момента последнего snapshot
   */
  async getDelta(): Promise<{
    hasChanges: boolean;
    timeSinceLastCheck: string;
    lastSnapshot: StatsSnapshot;
    changes: {
      newUsers: number;
      newPayments: number;
      stuckAtStart: number;
      stuckAtVideo1: number;
      stuckAtVideo2: number;
      stuckAtVideo3: number;
      stuckAtPaymentChoice: number;
      chosePaymentNoReceipt: number;
      receiptRejected: number;
      newTributeClicks: number;
      newReminderLevel1Start: number;
      newReminderLevel2Start: number;
      newReminderLevel3Start: number;
      newReminderLevel1Video1: number;
      newReminderLevel2Video1: number;
      newReminderLevel3Video1: number;
      newReminderLevel1Video2: number;
      newReminderLevel2Video2: number;
      newReminderLevel3Video2: number;
      newReminderLevel1Video3: number;
      newReminderLevel2Video3: number;
      newReminderLevel3Video3: number;
      newVideo1Reminders: number;
      newPaymentReminders: number;
      newReceiptReminders: number;
    };
  } | null> {
    if (!lastSnapshot) {
      return null;
    }

    try {
      const stats = await this.getPaymentStats();
      const steps = await this.getCurrentSteps();
      const tributeClicks = await this.getTributeClicksStats();
      const reminders = await this.getReminderStats();

      if (!stats || !steps) {
        return null;
      }

      // Вычисляем время с момента последней проверки
      const now = new Date();
      const diffMs = now.getTime() - lastSnapshot.timestamp.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMinutes / 60);
      const remainingMinutes = diffMinutes % 60;

      let timeSinceLastCheck = '';
      if (diffHours > 0) {
        timeSinceLastCheck = `${diffHours}ч ${remainingMinutes}м`;
      } else {
        timeSinceLastCheck = `${diffMinutes}м`;
      }

      const changes = {
        newUsers: stats.total_users_started - lastSnapshot.totalUsers,
        newPayments: stats.total_successful_payments - lastSnapshot.successfulPayments,
        stuckAtStart: steps.stuck_at_start - lastSnapshot.stuckAtStart,
        stuckAtVideo1: steps.stuck_at_video1 - lastSnapshot.stuckAtVideo1,
        stuckAtVideo2: steps.stuck_at_video2 - lastSnapshot.stuckAtVideo2,
        stuckAtVideo3: steps.stuck_at_video3 - lastSnapshot.stuckAtVideo3,
        stuckAtPaymentChoice: steps.stuck_at_payment_choice - lastSnapshot.stuckAtPaymentChoice,
        chosePaymentNoReceipt: steps.chose_payment_no_receipt - lastSnapshot.chosePaymentNoReceipt,
        receiptRejected: steps.receipt_rejected - lastSnapshot.receiptRejected,
        newTributeClicks: tributeClicks.total - lastSnapshot.tributeClicksTotal,
        newReminderLevel1Start: reminders.reminderLevel1Start - lastSnapshot.reminderLevel1Start,
        newReminderLevel2Start: reminders.reminderLevel2Start - lastSnapshot.reminderLevel2Start,
        newReminderLevel3Start: reminders.reminderLevel3Start - lastSnapshot.reminderLevel3Start,
        newReminderLevel1Video1: reminders.reminderLevel1Video1 - lastSnapshot.reminderLevel1Video1,
        newReminderLevel2Video1: reminders.reminderLevel2Video1 - lastSnapshot.reminderLevel2Video1,
        newReminderLevel3Video1: reminders.reminderLevel3Video1 - lastSnapshot.reminderLevel3Video1,
        newReminderLevel1Video2: reminders.reminderLevel1Video2 - lastSnapshot.reminderLevel1Video2,
        newReminderLevel2Video2: reminders.reminderLevel2Video2 - lastSnapshot.reminderLevel2Video2,
        newReminderLevel3Video2: reminders.reminderLevel3Video2 - lastSnapshot.reminderLevel3Video2,
        newReminderLevel1Video3: reminders.reminderLevel1Video3 - lastSnapshot.reminderLevel1Video3,
        newReminderLevel2Video3: reminders.reminderLevel2Video3 - lastSnapshot.reminderLevel2Video3,
        newReminderLevel3Video3: reminders.reminderLevel3Video3 - lastSnapshot.reminderLevel3Video3,
        newVideo1Reminders: reminders.video1 - lastSnapshot.video1ReminderSent,
        newPaymentReminders: reminders.paymentChoice - lastSnapshot.paymentReminderSent,
        newReceiptReminders: reminders.receipt - lastSnapshot.receiptReminderSent,
      };

      // Проверяем есть ли хоть какие-то изменения
      const hasChanges = Object.values(changes).some(val => val !== 0);

      return {
        hasChanges,
        timeSinceLastCheck,
        lastSnapshot,
        changes,
      };
    } catch (error) {
      console.error('Ошибка вычисления delta:', error);
      return null;
    }
  }

  /**
   * Вывести статистику в консоль
   */
  async logPaymentStats(): Promise<void> {
    const stats = await this.getPaymentStats();
    
    if (!stats) {
      console.log('❌ Статистика недоступна');
      return;
    }

    console.log('\n📊 СТАТИСТИКА ПЛАТЕЖЕЙ:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👥 Всего уникальных пользователей: ${stats.total_users_started}`);
    console.log(`✅ Успешных оплат: ${stats.total_successful_payments}`);
    console.log(`💵 Оплат в рублях: ${stats.total_rub_payments}`);
    console.log(`💴 Оплат в гривнах: ${stats.total_uah_payments}`);
    console.log(`📷 Отправлено "не квитанций": ${stats.total_non_receipts}`);
    console.log(`❌ Квитанций не прошедших проверку: ${stats.total_failed_receipts}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  /**
   * Вывести статистику воронки в консоль
   */
  async logFunnelStats(): Promise<void> {
    const steps = await this.getCurrentSteps();
    
    if (!steps) {
      console.log('❌ Статистика воронки недоступна');
      return;
    }

    console.log('\n📊 ВОРОНКА КОНВЕРСИИ:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👥 Всего начали: ${steps.total_users_started}`);
    console.log(`🚫 Застряли на старте: ${steps.stuck_at_start}`);
    console.log(`📹 Застряли на видео 1: ${steps.stuck_at_video1}`);
    console.log(`📹 Застряли на видео 2: ${steps.stuck_at_video2}`);
    console.log(`📹 Застряли на видео 3: ${steps.stuck_at_video3}`);
    console.log(`💳 Застряли на выборе оплаты: ${steps.stuck_at_payment_choice}`);
    console.log(`⏳ Выбрали оплату, но не прислали квитанцию: ${steps.chose_payment_no_receipt}`);
    console.log(`❌ Прислали квитанцию, но не подошла: ${steps.receipt_rejected}`);
    
    // Вычисляем проценты конверсии
    if (steps.total_users_started > 0) {
      const paidUsers = steps.total_users_started - steps.stuck_at_start - steps.stuck_at_video1 
        - steps.stuck_at_video2 - steps.stuck_at_video3 - steps.stuck_at_payment_choice 
        - steps.chose_payment_no_receipt - steps.receipt_rejected;
      const conversionRate = ((paidUsers / steps.total_users_started) * 100).toFixed(2);
      console.log(`\n✅ Оплатили: ${paidUsers} (${conversionRate}%)`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}
