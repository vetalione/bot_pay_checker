// ЭТОТ КОД ЗАМЕНЯЕТ КОМАНДУ /stats в src/index.ts (строки 128-185)

// Команда /stats для админа
bot.command('stats', async (ctx) => {
  const userId = ctx.from.id;
  
  // Проверяем что это админ
  if (userId !== 278263484) {
    await ctx.reply('У вас нет доступа к этой команде.');
    return;
  }

  const statsService = new StatsService();
  const stats = await statsService.getPaymentStats();
  const steps = await statsService.getCurrentSteps();
  const tributeClicks = await statsService.getTributeClicksStats();
  const reminders = await statsService.getReminderStats();
  const delta = await statsService.getDelta();

  if (!stats || !steps) {
    await ctx.reply('❌ Статистика недоступна');
    return;
  }

  // Вычисляем конверсию
  const conversionRate = stats.total_users_started > 0 
    ? ((stats.total_successful_payments / stats.total_users_started) * 100).toFixed(2)
    : '0.00';

  let message = 
    '📊 <b>СТАТИСТИКА ПЛАТЕЖЕЙ</b>\\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n' +
    `👥 <b>Всего уникальных пользователей:</b> ${stats.total_users_started}\\n` +
    `✅ <b>Успешных оплат:</b> ${stats.total_successful_payments} (${conversionRate}%)\\n` +
    `💵 <b>Оплат в рублях:</b> ${stats.total_rub_payments}\\n` +
    `💴 <b>Оплат в гривнах:</b> ${stats.total_uah_payments}\\n` +
    `📷 <b>Отправлено "не квитанций":</b> ${stats.total_non_receipts}\\n` +
    `❌ <b>Квитанций не прошедших проверку:</b> ${stats.total_failed_receipts}\\n\\n`;

  // Секция UPDATES (дельта изменений)
  if (delta && delta.hasChanges) {
    message += 
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n' +
      '📈 <b>UPDATES (с момента последней проверки)</b>\\n' +
      `⏱ <b>Прошло времени:</b> ${delta.timeSinceLastCheck}\\n\\n`;

    if (delta.changes.newUsers !== 0) {
      message += `👥 Новых пользователей: ${delta.changes.newUsers > 0 ? '+' : ''}${delta.changes.newUsers}\\n`;
    }
    if (delta.changes.newPayments !== 0) {
      message += `✅ Новых оплат: ${delta.changes.newPayments > 0 ? '+' : ''}${delta.changes.newPayments}\\n`;
    }
    if (delta.changes.newTributeClicks !== 0) {
      message += `💳 Кликов на Tribute: ${delta.changes.newTributeClicks > 0 ? '+' : ''}${delta.changes.newTributeClicks}\\n`;
    }
    
    // Изменения в воронке
    const funnelChanges: string[] = [];
    if (delta.changes.stuckAtStart !== 0) {
      funnelChanges.push(`Старт: ${delta.changes.stuckAtStart > 0 ? '+' : ''}${delta.changes.stuckAtStart}`);
    }
    if (delta.changes.stuckAtVideo1 !== 0) {
      funnelChanges.push(`Видео1: ${delta.changes.stuckAtVideo1 > 0 ? '+' : ''}${delta.changes.stuckAtVideo1}`);
    }
    if (delta.changes.stuckAtVideo2 !== 0) {
      funnelChanges.push(`Видео2: ${delta.changes.stuckAtVideo2 > 0 ? '+' : ''}${delta.changes.stuckAtVideo2}`);
    }
    if (delta.changes.stuckAtVideo3 !== 0) {
      funnelChanges.push(`Видео3: ${delta.changes.stuckAtVideo3 > 0 ? '+' : ''}${delta.changes.stuckAtVideo3}`);
    }
    if (delta.changes.stuckAtPaymentChoice !== 0) {
      funnelChanges.push(`Выбор оплаты: ${delta.changes.stuckAtPaymentChoice > 0 ? '+' : ''}${delta.changes.stuckAtPaymentChoice}`);
    }
    if (delta.changes.chosePaymentNoReceipt !== 0) {
      funnelChanges.push(`Ждут квитанции: ${delta.changes.chosePaymentNoReceipt > 0 ? '+' : ''}${delta.changes.chosePaymentNoReceipt}`);
    }
    
    if (funnelChanges.length > 0) {
      message += `\\n📊 Изменения в воронке:\\n${funnelChanges.map(c => `  • ${c}`).join('\\n')}\\n`;
    }

    message += '\\n';
  } else if (delta && !delta.hasChanges) {
    message += 
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n' +
      '📊 <b>UPDATES</b>\\n' +
      `⏱ С последней проверки: ${delta.timeSinceLastCheck}\\n` +
      `ℹ️ Изменений нет\\n\\n`;
  }

  message +=
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n' +
    '💳 <b>КЛИКИ НА TRIBUTE КНОПКИ</b>\\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n' +
    `👥 <b>Уникальных пользователей:</b> ${tributeClicks.total}\\n\\n` +
    `💵 <b>RUB Tribute:</b> ${tributeClicks.rub} (${tributeClicks.onlyRub} только RUB)\\n` +
    `💳 <b>EUR Tribute:</b> ${tributeClicks.eur} (${tributeClicks.onlyEur} только EUR)\\n` +
    `🔄 <b>Кликали на обе:</b> ${tributeClicks.both}\\n\\n` +
    `<b>Финальный выбор:</b>\\n` +
    `  💵 RUB: ${tributeClicks.lastChoiceRub}\\n` +
    `  💳 EUR: ${tributeClicks.lastChoiceEur}\\n\\n` +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n' +
    '📈 <b>ВОРОНКА КОНВЕРСИИ</b>\\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n' +
    `👥 <b>Начали:</b> ${steps.total_users_started}\\n` +
    `🚫 <b>Застряли на старте:</b> ${steps.stuck_at_start}\\n` +
    `📹 <b>Застряли на видео 1:</b> ${steps.stuck_at_video1}` + 
    (reminders.video1 > 0 ? ` (📨 ${reminders.video1})` : '') + `\\n` +
    `📹 <b>Застряли на видео 2:</b> ${steps.stuck_at_video2}\\n` +
    `📹 <b>Застряли на видео 3:</b> ${steps.stuck_at_video3}\\n` +
    `💳 <b>Застряли на выборе оплаты:</b> ${steps.stuck_at_payment_choice}` +
    (reminders.paymentChoice > 0 ? ` (📨 ${reminders.paymentChoice})` : '') + `\\n` +
    `⏳ <b>Выбрали оплату, нет квитанции:</b> ${steps.chose_payment_no_receipt}` +
    (reminders.receipt > 0 ? ` (📨 ${reminders.receipt})` : '') + `\\n` +
    `❌ <b>Квитанция не подошла:</b> ${steps.receipt_rejected}\\n\\n` +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

  await ctx.reply(message, { parse_mode: 'HTML' });

  // Создаём snapshot для следующей проверки
  await statsService.createSnapshot();
});
