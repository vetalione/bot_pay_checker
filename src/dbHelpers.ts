import { UserService } from './userService';
import { Context } from 'telegraf';

/**
 * Вспомогательные функции для работы с БД в боте
 */

/**
 * Сохранить пользователя и действие в БД
 */
export async function trackUserAction(
  userService: UserService | undefined,
  ctx: Context,
  action: string,
  step: string,
  metadata?: Record<string, any>
): Promise<void> {
  if (!userService) return;

  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    // Создаем/обновляем пользователя
    await userService.getOrCreateUser(
      userId,
      ctx.from.username,
      ctx.from.first_name,
      ctx.from.last_name
    );

    // Логируем действие
    await userService.logAction(userId, action, step, metadata);
  } catch (error) {
    console.error(`DB Error (trackUserAction):`, error);
    // Не прерываем работу бота если БД недоступна
  }
}

/**
 * Обновить шаг пользователя в БД
 */
export async function updateUserStep(
  userService: UserService | undefined,
  userId: number,
  step: string
): Promise<void> {
  if (!userService) return;

  try {
    await userService.updateUserStep(userId, step as any);
  } catch (error) {
    console.error(`DB Error (updateUserStep):`, error);
  }
}

/**
 * Установить валюту пользователя
 */
export async function setUserCurrency(
  userService: UserService | undefined,
  userId: number,
  currency: 'RUB' | 'UAH'
): Promise<void> {
  if (!userService) return;

  try {
    await userService.setUserCurrency(userId, currency);
  } catch (error) {
    console.error(`DB Error (setUserCurrency):`, error);
  }
}

/**
 * Отметить пользователя как оплатившего
 */
export async function markUserAsPaid(
  userService: UserService | undefined,
  userId: number
): Promise<void> {
  if (!userService) return;

  try {
    await userService.markAsPaid(userId);
  } catch (error) {
    console.error(`DB Error (markUserAsPaid):`, error);
  }
}
