import { AppDataSource } from './database';
import { User } from './entities/User';
import { UserAction } from './entities/UserAction';

export class UserService {
  private userRepository = AppDataSource.getRepository(User);
  private actionRepository = AppDataSource.getRepository(UserAction);

  /**
   * Получить или создать пользователя
   */
  async getOrCreateUser(
    userId: number,
    username?: string,
    firstName?: string,
    lastName?: string
  ): Promise<User> {
    let user = await this.userRepository.findOne({ where: { userId } });

    if (!user) {
      user = this.userRepository.create({
        userId,
        username,
        firstName,
        lastName,
        currentStep: 'start',
        hasPaid: false,
        lastActivityAt: new Date(),
        currentStepChangedAt: new Date(), // Инициализируем timestamp
        reminderLevel1Start: false,
        reminderLevel2Start: false,
        reminderLevel3Start: false,
      });
      await this.userRepository.save(user);
      console.log(`👤 Новый пользователь создан: ${userId} (@${username})`);
    } else {
      // Обновляем lastActivityAt
      user.lastActivityAt = new Date();
      await this.userRepository.save(user);
    }

    return user;
  }

  /**
   * Обновить текущий шаг пользователя
   */
  async updateUserStep(
    userId: number,
    step: User['currentStep']
  ): Promise<void> {
    await this.userRepository.update({ userId }, { 
      currentStep: step,
      lastActivityAt: new Date(),
      currentStepChangedAt: new Date() // Обновляем timestamp при смене этапа
    });
  }

  /**
   * Установить валюту пользователя
   */
  async setUserCurrency(userId: number, currency: 'RUB' | 'UAH' | 'EUR'): Promise<void> {
    await this.userRepository.update({ userId }, { 
      currency,
      paymentReminderSent: false,
      paymentChoiceShownAt: null as any
    });
  }

  /**
   * Отметить что пользователю показали выбор оплаты
   */
  async markPaymentChoiceShown(userId: number): Promise<void> {
    await this.userRepository.update({ userId }, {
      paymentChoiceShownAt: new Date(),
      paymentReminderSent: false
    });
  }

  /**
   * Отметить что пользователь выбрал валюту и ожидает отправки квитанции
   */
  async markWaitingForReceipt(userId: number): Promise<void> {
    await this.userRepository.update({ userId }, {
      waitingReceiptSince: new Date(),
      receiptReminderSent: false
    });
  }

  /**
   * Отметить что пользователю показано первое видео
   */
  async markVideo1Shown(userId: number): Promise<void> {
    await this.userRepository.update({ userId }, {
      video1ShownAt: new Date(),
      video1ReminderSent: false
    });
  }

  /**
   * Отметить пользователя как оплатившего
   */
  async markAsPaid(userId: number): Promise<void> {
    await this.userRepository.update({ userId }, {
      hasPaid: true,
      paidAt: new Date(),
      currentStep: 'completed'
    });
  }

  /**
   * Записать действие пользователя
   */
  async logAction(
    userId: number,
    action: string,
    step: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const userAction = this.actionRepository.create({
      userId,
      action,
      step,
      metadata,
    });
    await this.actionRepository.save(userAction);
  }

  /**
   * RETARGETING: Получить пользователей, которые застряли на определенном шаге
   * Например: посмотрели video1, но не пошли дальше
   */
  async getUsersStuckAtStep(step: User['currentStep'], hoursAgo: number = 24): Promise<User[]> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);

    return await this.userRepository
      .createQueryBuilder('user')
      .where('user.currentStep = :step', { step })
      .andWhere('user.hasPaid = false')
      .andWhere('user.lastActivityAt < :cutoffDate', { cutoffDate })
      .getMany();
  }

  /**
   * RETARGETING: Получить пользователей, которые дошли до оплаты, но не оплатили
   */
  async getUsersAbandonedPayment(hoursAgo: number = 24): Promise<User[]> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);

    return await this.userRepository
      .createQueryBuilder('user')
      .where('user.currentStep IN (:...paymentSteps)', {
        paymentSteps: ['payment_choice', 'waiting_receipt']
      })
      .andWhere('user.hasPaid = false')
      .andWhere('user.lastActivityAt < :cutoffDate', { cutoffDate })
      .getMany();
  }

  /**
   * ANALYTICS: Получить статистику по воронке
   */
  async getFunnelStats(): Promise<Record<string, number>> {
    const stats = await this.userRepository
      .createQueryBuilder('user')
      .select('user.currentStep', 'step')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.currentStep')
      .getRawMany();

    const result: Record<string, number> = {};
    stats.forEach(stat => {
      result[stat.step] = parseInt(stat.count);
    });

    return result;
  }

  /**
   * ANALYTICS: Конверсия в оплату
   */
  async getConversionRate(): Promise<{ total: number; paid: number; rate: number }> {
    const total = await this.userRepository.count();
    const paid = await this.userRepository.count({ where: { hasPaid: true } });
    const rate = total > 0 ? (paid / total) * 100 : 0;

    return { total, paid, rate };
  }

  /**
   * Получить всех пользователей (для применения новых сценариев на старую базу)
   */
  async getAllUsers(): Promise<User[]> {
    return await this.userRepository.find();
  }

  /**
   * Получить пользователей, которые уже прошли воронку (для новых допродаж)
   */
  async getCompletedUsers(): Promise<User[]> {
    return await this.userRepository.find({
      where: { hasPaid: true }
    });
  }
}
