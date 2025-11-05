import { Telegraf } from 'telegraf';
import { AppDataSource } from '../database';
import { User } from '../entities/User';
import { Friend } from '../entity/Friend';
import { UserService } from '../userService';

interface SyncResult {
  totalMembers: number;
  knownUsers: number;
  markedAsPaid: number;
  newFriends: number;
  alreadyPaid: number;
  errors: string[];
}

export class ChannelSyncService {
  private userService: UserService;

  constructor(private bot: Telegraf) {
    this.userService = new UserService();
  }

  /**
   * Получает список всех участников канала
   */
  private async getChannelMembers(channelId: string): Promise<Array<{
    userId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
  }>> {
    const members: Array<{
      userId: number;
      username?: string;
      firstName?: string;
      lastName?: string;
    }> = [];

    try {
      // Telegram Bot API не предоставляет прямого метода для получения всех участников канала
      // Но мы можем получить администраторов канала
      const admins = await this.bot.telegram.getChatAdministrators(channelId);
      
      console.log(`ℹ️  Получено ${admins.length} администраторов канала`);
      
      for (const admin of admins) {
        if (admin.user && !admin.user.is_bot) {
          members.push({
            userId: admin.user.id,
            username: admin.user.username,
            firstName: admin.user.first_name,
            lastName: admin.user.last_name,
          });
        }
      }

      console.log(`⚠️  ВАЖНО: Telegram Bot API не предоставляет список всех участников канала.`);
      console.log(`   Получены только администраторы: ${members.length}`);
      console.log(`   Для полной синхронизации нужно использовать Telegram MTProto API (pyrogram, telethon)`);
      
      return members;
    } catch (error) {
      console.error('❌ Ошибка при получении участников канала:', error);
      throw error;
    }
  }

  /**
   * Синхронизирует участников канала с базой данных
   */
  async syncChannelMembers(channelId: string): Promise<SyncResult> {
    const result: SyncResult = {
      totalMembers: 0,
      knownUsers: 0,
      markedAsPaid: 0,
      newFriends: 0,
      alreadyPaid: 0,
      errors: [],
    };

    try {
      console.log('🔄 Начинаем синхронизацию участников канала...');
      
      // Получаем список участников канала
      const members = await this.getChannelMembers(channelId);
      result.totalMembers = members.length;

      console.log(`📊 Найдено участников канала: ${members.length}`);

      const userRepository = AppDataSource.getRepository(User);
      const friendRepository = AppDataSource.getRepository(Friend);

      for (const member of members) {
        try {
          // Проверяем, есть ли пользователь в базе бота
          const existingUser = await userRepository.findOne({
            where: { userId: member.userId },
          });

          if (existingUser) {
            // Пользователь есть в базе бота
            result.knownUsers++;

            if (!existingUser.hasPaid) {
              // Помечаем как оплатившего
              await this.userService.markAsPaid(member.userId);
              result.markedAsPaid++;
              console.log(`✅ Пользователь ${member.username || member.firstName} (${member.userId}) помечен как оплативший`);
            } else {
              result.alreadyPaid++;
              console.log(`ℹ️  Пользователь ${member.username || member.firstName} (${member.userId}) уже был помечен как оплативший`);
            }
          } else {
            // Пользователя нет в базе бота - добавляем в friends
            const existingFriend = await friendRepository.findOne({
              where: { userId: member.userId },
            });

            if (!existingFriend) {
              const friend = friendRepository.create({
                userId: member.userId,
                username: member.username,
                firstName: member.firstName,
                lastName: member.lastName,
                notes: 'Добавлен автоматически через синхронизацию канала',
              });

              await friendRepository.save(friend);
              result.newFriends++;
              console.log(`➕ Новый friend добавлен: ${member.username || member.firstName} (${member.userId})`);
            } else {
              console.log(`ℹ️  Friend уже существует: ${member.username || member.firstName} (${member.userId})`);
            }
          }
        } catch (error) {
          const errorMsg = `Ошибка при обработке пользователя ${member.userId}: ${error}`;
          result.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      console.log('✅ Синхронизация завершена');
      return result;
    } catch (error) {
      console.error('❌ Критическая ошибка при синхронизации:', error);
      result.errors.push(`Критическая ошибка: ${error}`);
      return result;
    }
  }

  /**
   * Форматирует результат синхронизации для отчета
   */
  formatSyncReport(result: SyncResult): string {
    let report = '📊 <b>Отчет о синхронизации канала</b>\n\n';
    
    report += `👥 Всего участников: ${result.totalMembers}\n`;
    report += `✅ Известных пользователей: ${result.knownUsers}\n`;
    report += `💰 Помечено как оплативших: ${result.markedAsPaid}\n`;
    report += `✔️ Уже были оплачены: ${result.alreadyPaid}\n`;
    report += `👤 Новых friends добавлено: ${result.newFriends}\n`;

    if (result.errors.length > 0) {
      report += `\n⚠️ <b>Ошибки (${result.errors.length}):</b>\n`;
      result.errors.slice(0, 5).forEach((error, index) => {
        report += `${index + 1}. ${error}\n`;
      });
      if (result.errors.length > 5) {
        report += `...и еще ${result.errors.length - 5} ошибок\n`;
      }
    }

    report += '\n⚠️ <b>Важное замечание:</b>\n';
    report += 'Telegram Bot API предоставляет только список администраторов канала.\n';
    report += 'Для полной синхронизации всех участников требуется MTProto API.\n';

    return report;
  }
}
