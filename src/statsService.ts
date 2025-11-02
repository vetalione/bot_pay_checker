import { AppDataSource } from './database';
import { PaymentStats } from './entities/PaymentStats';

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
}
