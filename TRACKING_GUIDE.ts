/**
 * ИНСТРУКЦИЯ: Как добавить tracking в существующие обработчики
 * 
 * В начале каждого bot.action() добавьте:
 * 
 * await trackUserAction(userService, ctx, 'название_действия', 'текущий_шаг');
 * 
 * Примеры:
 */

// ============================================
// ПРИМЕР 1: bot.action('want_more')
// ============================================
/*
bot.action('want_more', async (ctx) => {
  const userId = ctx.from!.id;
  
  // ✅ Добавить tracking
  await trackUserAction(userService, ctx, 'click_want_more', 'want_button');
  await updateUserStep(userService, userId, 'video1');
  
  // ... остальной код
});
*/

// ============================================
// ПРИМЕР 2: bot.action('continue_watching')
// ============================================
/*
bot.action('continue_watching', async (ctx) => {
  const userId = ctx.from!.id;
  
  // ✅ Добавить tracking
  await trackUserAction(userService, ctx, 'click_continue', 'continue_button');
  await updateUserStep(userService, userId, 'video2');
  
  // ... остальной код
});
*/

// ============================================
// ПРИМЕР 3: bot.action('payment_rub')
// ============================================
/*
bot.action('payment_rub', async (ctx) => {
  const userId = ctx.from!.id;
  
  // ✅ Добавить tracking
  await trackUserAction(userService, ctx, 'choose_rub', 'payment_choice');
  await setUserCurrency(userService, userId, 'RUB');
  await updateUserStep(userService, userId, 'waiting_receipt');
  
  // ... остальной код
});
*/

// ============================================
// ПРИМЕР 4: Успешная оплата
// ============================================
/*
// В обработчике валидации чека:
if (validationResult.isValid) {
  // ✅ Добавить tracking
  await markUserAsPaid(userService, userId);
  await trackUserAction(userService, ctx, 'payment_success', 'completed', {
    currency: state.currency,
    amount: state.currency === 'RUB' ? config.paymentAmount : config.paymentAmountUAH
  });
  
  // ... остальной код
}
*/

// ============================================
// СПИСОК ВСЕХ ДЕЙСТВИЙ ДЛЯ TRACKING:
// ============================================
/*
1. start                 - /start команда
2. click_want_more       - Кнопка "Хочу!"
3. video1_sent           - Отправлено видео 1
4. click_continue        - Кнопка "Смотреть дальше"
5. video2_sent           - Отправлено видео 2
6. click_ready           - Кнопка "Готов!"
7. video3_sent           - Отправлено видео 3
8. click_advantage       - Кнопка "Забрать преимущество!"
9. choose_rub            - Выбрал RUB
10. choose_uah           - Выбрал UAH
11. receipt_uploaded     - Загружен чек
12. receipt_valid        - Чек валидный
13. receipt_invalid      - Чек невалидный
14. payment_success      - Оплата подтверждена
15. joined_channel       - Вступил в канал
16. joined_chat          - Вступил в чат
*/

export {};
