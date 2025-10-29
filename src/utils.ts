// Утилиты для работы с форматированием и валидацией

/**
 * Форматирует номер карты для отображения
 * @param cardNumber - номер карты без пробелов
 * @returns отформатированный номер карты (XXXX XXXX XXXX XXXX)
 */
export function formatCardNumber(cardNumber: string): string {
  return cardNumber.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/**
 * Проверяет наличие суммы в тексте
 * @param text - текст для проверки
 * @param expectedAmount - ожидаемая сумма
 * @returns true если сумма найдена
 */
export function checkAmountInText(text: string, expectedAmount: number): boolean {
  const amountRegex = new RegExp(`${expectedAmount}`, 'g');
  return amountRegex.test(text);
}

/**
 * Проверяет наличие номера карты в тексте
 * @param text - текст для проверки
 * @param cardNumber - номер карты
 * @returns true если номер карты найден
 */
export function checkCardNumberInText(text: string, cardNumber: string): boolean {
  // Убираем пробелы из номера карты
  const cleanCardNumber = cardNumber.replace(/\s/g, '');
  
  // Проверяем с пробелами и без
  const withSpaces = formatCardNumber(cleanCardNumber);
  
  return text.includes(cleanCardNumber) || text.includes(withSpaces);
}

/**
 * Форматирует время до истечения ссылки
 * @param hours - количество часов
 * @returns отформатированная строка
 */
export function formatExpireTime(hours: number): string {
  if (hours === 24) {
    return '24 часа';
  } else if (hours < 24) {
    return `${hours} час${hours > 1 && hours < 5 ? 'а' : 'ов'}`;
  } else {
    const days = Math.floor(hours / 24);
    return `${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}`;
  }
}

/**
 * Логирование с временной меткой
 * @param message - сообщение для лога
 * @param data - дополнительные данные
 */
export function logWithTimestamp(message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data || '');
}

/**
 * Безопасное логирование (скрывает токены и чувствительные данные)
 * @param message - сообщение
 * @param data - данные (токены будут замаскированы)
 */
export function safeLog(message: string, data?: any): void {
  if (typeof data === 'object' && data !== null) {
    const safeCopy = { ...data };
    
    // Маскируем токены
    if (safeCopy.token) {
      safeCopy.token = '***';
    }
    if (safeCopy.botToken) {
      safeCopy.botToken = '***';
    }
    
    logWithTimestamp(message, safeCopy);
  } else {
    logWithTimestamp(message, data);
  }
}

/**
 * Задержка выполнения
 * @param ms - миллисекунды
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Генерирует уникальный ID для пользователя
 * @param userId - ID пользователя Telegram
 * @returns уникальный строковый идентификатор
 */
export function generateUniqueId(userId: number): string {
  const timestamp = Date.now();
  return `${userId}_${timestamp}`;
}
