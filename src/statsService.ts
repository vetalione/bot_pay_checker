import { AppDataSource } from './database';
import { PaymentStats } from './entities/PaymentStats';
import { CurrentSteps } from './entities/CurrentSteps';

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
   * Получить статистику по кликам на кнопки Tribute
   */
  async getTributeClicksStats(): Promise<{ rub: number; eur: number }> {
    try {
      const rubClicks = await AppDataSource.query(
        `SELECT COUNT(DISTINCT "userId") as count FROM user_actions WHERE action = 'choose_rub_tribute'`
      );
      const eurClicks = await AppDataSource.query(
        `SELECT COUNT(DISTINCT "userId") as count FROM user_actions WHERE action = 'choose_eur_tribute'`
      );
      
      return {
        rub: parseInt(rubClicks[0]?.count || '0'),
        eur: parseInt(eurClicks[0]?.count || '0')
      };
    } catch (error) {
      console.error('Ошибка получения статистики Tribute:', error);
      return { rub: 0, eur: 0 };
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
