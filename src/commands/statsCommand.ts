// Новая команда /stats с компактным форматом
// Импортировать в src/index.ts и заменить старую версию

import { Context } from 'telegraf';
import { StatsService } from '../statsService';
import { AppDataSource } from '../database';

export async function statsCommand(ctx: Context) {
  const userId = ctx.from!.id;
  
  // Проверка админа
  if (userId !== 278263484) {
    await ctx.reply('У вас нет доступа к этой команде.');
    return;
  }

  try {
    console.log('[/stats] Starting stats command...');
    const statsService = new StatsService();
    
    console.log('[/stats] Fetching data from database...');
    // Получаем все данные параллельно
    const [
      currentStepDistribution,
      paymentMethods,
      newStartReminderCounts,
      newVideo1ReminderCounts,
      newVideo2ReminderCounts,
      newVideo3ReminderCounts,
      totalUsers,
      totalPaid,
      avgTimeToPayment,
      blockedStats,
      delta
    ] = await Promise.all([
      // Распределение по currentStep
      AppDataSource.query(`
        SELECT "currentStep", COUNT(*) as count
        FROM users
        GROUP BY "currentStep"
      `),
      // Методы оплаты
      AppDataSource.query(`
        SELECT currency, COUNT(*) as count
        FROM users
        WHERE "hasPaid" = true
        GROUP BY currency
      `),
      // Новая система START (3 уровня)
      AppDataSource.query(`
        SELECT 
          COUNT(*) FILTER (WHERE "reminderLevel1Start" = true) as reminder_level1_start,
          COUNT(*) FILTER (WHERE "reminderLevel2Start" = true) as reminder_level2_start,
          COUNT(*) FILTER (WHERE "reminderLevel3Start" = true) as reminder_level3_start
        FROM users
      `),
      // Новая система VIDEO1 (3 уровня)
      AppDataSource.query(`
        SELECT 
          COUNT(*) FILTER (WHERE "reminderLevel1Video1" = true) as reminder_level1_video1,
          COUNT(*) FILTER (WHERE "reminderLevel2Video1" = true) as reminder_level2_video1,
          COUNT(*) FILTER (WHERE "reminderLevel3Video1" = true) as reminder_level3_video1
        FROM users
      `),
      // Новая система VIDEO2 (3 уровня)
      AppDataSource.query(`
        SELECT 
          COUNT(*) FILTER (WHERE "reminderLevel1Video2" = true) as reminder_level1_video2,
          COUNT(*) FILTER (WHERE "reminderLevel2Video2" = true) as reminder_level2_video2,
          COUNT(*) FILTER (WHERE "reminderLevel3Video2" = true) as reminder_level3_video2
        FROM users
      `),
      // Новая система VIDEO3 (3 уровня)
      AppDataSource.query(`
        SELECT 
          COUNT(*) FILTER (WHERE "reminderLevel1Video3" = true) as reminder_level1_video3,
          COUNT(*) FILTER (WHERE "reminderLevel2Video3" = true) as reminder_level2_video3,
          COUNT(*) FILTER (WHERE "reminderLevel3Video3" = true) as reminder_level3_video3
        FROM users
      `),
      // Всего пользователей
      AppDataSource.query(`SELECT COUNT(*) as count FROM users`),
      // Всего оплативших
      AppDataSource.query(`SELECT COUNT(*) as count FROM users WHERE "hasPaid" = true`),
      // Среднее время до оплаты (в часах)
      AppDataSource.query(`
        SELECT AVG(EXTRACT(EPOCH FROM ("paidAt" - "createdAt"))/3600) as avg_hours
        FROM users
        WHERE "hasPaid" = true AND "paidAt" IS NOT NULL
      `),
      // Статистика заблокированных по этапам
      AppDataSource.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE "currentStep" = 'start') as blocked_start,
          COUNT(*) FILTER (WHERE "currentStep" = 'video1') as blocked_video1,
          COUNT(*) FILTER (WHERE "currentStep" = 'video2') as blocked_video2,
          COUNT(*) FILTER (WHERE "currentStep" = 'video3') as blocked_video3,
          COUNT(*) FILTER (WHERE "currentStep" = 'payment_choice') as blocked_payment_choice,
          COUNT(*) FILTER (WHERE "currentStep" = 'waiting_receipt') as blocked_waiting_receipt
        FROM users
        WHERE "blockedBot" = true
      `),
      // Дельта
      statsService.getDelta()
    ]);

    console.log('[/stats] Data fetched successfully. Processing...');

    // Парсинг данных
    const getStepCount = (step: string): number => {
      const found = currentStepDistribution.find((row: any) => row.currentStep === step);
      return parseInt(found?.count || '0');
    };

    const getPaymentCount = (currency: string): number => {
      const found = paymentMethods.find((row: any) => row.currency === currency);
      return parseInt(found?.count || '0');
    };

    const total = parseInt(totalUsers[0].count);
    const paid = parseInt(totalPaid[0].count);
    const blockedTotal = parseInt(blockedStats[0]?.total || '0');
    const conversionRate = total > 0 ? ((paid / total) * 100).toFixed(1) : '0.0';
    
    const avgHours = parseFloat(avgTimeToPayment[0]?.avg_hours || '0');
    const avgTimeStr = avgHours >= 1 
      ? `${avgHours.toFixed(1)} ${avgHours > 4 ? 'часов' : 'часа'}`
      : `${(avgHours * 60).toFixed(0)} минут`;

    // Формируем сообщение
    let message = '📊 <b>СТАТИСТИКА БОТА</b>\n\n';

    // ПОЛЬЗОВАТЕЛИ
    const deltaUsers = delta && delta.hasChanges ? delta.changes.newUsers : 0;
    const deltaPaid = delta && delta.hasChanges ? delta.changes.newPayments : 0;
    const deltaBlocked = delta && delta.hasChanges ? delta.changes.newBlockedUsers : 0;
    
    message += '<b>👥 ПОЛЬЗОВАТЕЛИ</b>\n';
    message += `├─ Всего: ${total}`;
    if (deltaUsers !== 0) message += ` (${deltaUsers > 0 ? '+' : ''}${deltaUsers})`;
    message += '\n';
    message += `├─ Купили: ${paid}`;
    if (deltaPaid !== 0) message += ` (${deltaPaid > 0 ? '+' : ''}${deltaPaid})`;
    message += '\n';
    message += `├─ Заблокировали: ${blockedTotal}`;
    if (deltaBlocked !== 0) message += ` (${deltaBlocked > 0 ? '+' : ''}${deltaBlocked})`;
    message += '\n';
    message += `└─ Конверсия: ${conversionRate}%\n\n`;

    // ВОРОНКА
    message += '<b>📍 ВОРОНКА</b> (активные / дельта / [🚫заблокировано])\n';
    
    const steps = [
      { icon: '🚀', name: 'start', count: getStepCount('start'), key: 'currentStepStart', blockedKey: 'blocked_start' },
      { icon: '📹', name: 'video1', count: getStepCount('video1'), key: 'currentStepVideo1', blockedKey: 'blocked_video1' },
      { icon: '📹', name: 'video2', count: getStepCount('video2'), key: 'currentStepVideo2', blockedKey: 'blocked_video2' },
      { icon: '📹', name: 'video3', count: getStepCount('video3'), key: 'currentStepVideo3', blockedKey: 'blocked_video3' },
      { icon: '💳', name: 'payment_choice', count: getStepCount('payment_choice'), key: 'currentStepPaymentChoice', blockedKey: 'blocked_payment_choice' },
      { icon: '💳', name: 'waiting_receipt', count: getStepCount('waiting_receipt'), key: 'currentStepWaitingReceipt', blockedKey: 'blocked_waiting_receipt' },
      { icon: '✅', name: 'completed', count: getStepCount('completed'), key: 'currentStepCompleted', blockedKey: null }
    ];

    for (const step of steps) {
      const blockedCount = step.blockedKey ? parseInt(blockedStats[0]?.[step.blockedKey] || '0') : 0;
      const activeCount = step.count - blockedCount;
      
      message += `├─ ${step.icon} ${step.name}: ${activeCount} чел`;
      
      if (delta && delta.hasChanges && delta.lastSnapshot) {
        const lastCount = (delta.lastSnapshot as any)[step.key] || 0;
        const deltaCount = step.count - lastCount;
        if (deltaCount !== 0) {
          message += ` (${deltaCount > 0 ? '+' : ''}${deltaCount})`;
        }
      }
      
      if (blockedCount > 0) {
        message += ` [🚫${blockedCount}]`;
      }
      
      message += '\n';
    }
    message += '\n';

    // МЕТОДЫ ОПЛАТЫ
    const paidUAH = getPaymentCount('UAH');
    const paidRUB = getPaymentCount('RUB');
    const paidEUR = getPaymentCount('EUR');
    const percentUAH = paid > 0 ? ((paidUAH / paid) * 100).toFixed(1) : '0.0';
    const percentRUB = paid > 0 ? ((paidRUB / paid) * 100).toFixed(1) : '0.0';
    const percentEUR = paid > 0 ? ((paidEUR / paid) * 100).toFixed(1) : '0.0';

    // Дельта по методам оплаты
    const deltaUAH = delta && delta.hasChanges && delta.lastSnapshot ? paidUAH - delta.lastSnapshot.paidUAH : 0;
    const deltaRUB = delta && delta.hasChanges && delta.lastSnapshot ? paidRUB - delta.lastSnapshot.paidRUB : 0;
    const deltaEUR = delta && delta.hasChanges && delta.lastSnapshot ? paidEUR - delta.lastSnapshot.paidEUR : 0;

    message += `<b>💰 МЕТОДЫ ОПЛАТЫ</b> (всего ${paid}`;
    if (deltaPaid !== 0) message += ` / ${deltaPaid > 0 ? '+' : ''}${deltaPaid}`;
    message += ')\n';
    
    message += `├─ UAH Card: ${paidUAH} чел`;
    if (deltaUAH !== 0) message += ` (${deltaUAH > 0 ? '+' : ''}${deltaUAH})`;
    message += ` | ${percentUAH}%\n`;
    
    message += `├─ RUB Tribute: ${paidRUB} чел`;
    if (deltaRUB !== 0) message += ` (${deltaRUB > 0 ? '+' : ''}${deltaRUB})`;
    message += ` | ${percentRUB}%\n`;
    
    message += `└─ EUR Tribute: ${paidEUR} чел`;
    if (deltaEUR !== 0) message += ` (${deltaEUR > 0 ? '+' : ''}${deltaEUR})`;
    message += ` | ${percentEUR}%\n\n`;

    // НАПОМИНАНИЯ START (3 уровня)
    const reminderLevel1Start = parseInt(newStartReminderCounts[0]?.reminder_level1_start || '0') || 0;
    const reminderLevel2Start = parseInt(newStartReminderCounts[0]?.reminder_level2_start || '0') || 0;
    const reminderLevel3Start = parseInt(newStartReminderCounts[0]?.reminder_level3_start || '0') || 0;
    const totalStartReminders = reminderLevel1Start + reminderLevel2Start + reminderLevel3Start;
    
    // Дельта для напоминаний START
    console.log('[/stats] Delta object:', JSON.stringify(delta, null, 2));
    const deltaLevel1Start = delta && delta.hasChanges && delta.changes.newReminderLevel1Start ? delta.changes.newReminderLevel1Start : 0;
    const deltaLevel2Start = delta && delta.hasChanges && delta.changes.newReminderLevel2Start ? delta.changes.newReminderLevel2Start : 0;
    const deltaLevel3Start = delta && delta.hasChanges && delta.changes.newReminderLevel3Start ? delta.changes.newReminderLevel3Start : 0;
    console.log('[/stats] START deltas:', { deltaLevel1Start, deltaLevel2Start, deltaLevel3Start });
    const deltaTotalStart = deltaLevel1Start + deltaLevel2Start + deltaLevel3Start;

    message += '<b>⚡️ НАПОМИНАНИЯ START</b> (3 уровня)\n';
    message += `├─ Level 1 (5 мин): ${reminderLevel1Start}`;
    if (deltaLevel1Start !== 0) message += ` (${deltaLevel1Start > 0 ? '+' : ''}${deltaLevel1Start})`;
    message += '\n';
    message += `├─ Level 2 (1 час): ${reminderLevel2Start}`;
    if (deltaLevel2Start !== 0) message += ` (${deltaLevel2Start > 0 ? '+' : ''}${deltaLevel2Start})`;
    message += '\n';
    message += `├─ Level 3 (24 часа): ${reminderLevel3Start}`;
    if (deltaLevel3Start !== 0) message += ` (${deltaLevel3Start > 0 ? '+' : ''}${deltaLevel3Start})`;
    message += '\n';
    message += `└─ Итого START: ${totalStartReminders}`;
    if (deltaTotalStart !== 0) message += ` (${deltaTotalStart > 0 ? '+' : ''}${deltaTotalStart})`;
    message += '\n\n';

    // НАПОМИНАНИЯ VIDEO1 (3 уровня)
    const reminderLevel1Video1 = parseInt(newVideo1ReminderCounts[0]?.reminder_level1_video1 || '0') || 0;
    const reminderLevel2Video1 = parseInt(newVideo1ReminderCounts[0]?.reminder_level2_video1 || '0') || 0;
    const reminderLevel3Video1 = parseInt(newVideo1ReminderCounts[0]?.reminder_level3_video1 || '0') || 0;
    const totalVideo1Reminders = reminderLevel1Video1 + reminderLevel2Video1 + reminderLevel3Video1;
    
    const deltaLevel1Video1 = delta && delta.hasChanges && delta.changes.newReminderLevel1Video1 ? delta.changes.newReminderLevel1Video1 : 0;
    const deltaLevel2Video1 = delta && delta.hasChanges && delta.changes.newReminderLevel2Video1 ? delta.changes.newReminderLevel2Video1 : 0;
    const deltaLevel3Video1 = delta && delta.hasChanges && delta.changes.newReminderLevel3Video1 ? delta.changes.newReminderLevel3Video1 : 0;
    console.log('[/stats] VIDEO1 deltas:', { deltaLevel1Video1, deltaLevel2Video1, deltaLevel3Video1 });
    const deltaTotalVideo1 = deltaLevel1Video1 + deltaLevel2Video1 + deltaLevel3Video1;

    message += '<b>⚡️ НАПОМИНАНИЯ VIDEO1</b> (3 уровня)\n';
    message += `├─ Level 1 (5 мин): ${reminderLevel1Video1}`;
    if (deltaLevel1Video1 !== 0) message += ` (${deltaLevel1Video1 > 0 ? '+' : ''}${deltaLevel1Video1})`;
    message += '\n';
    message += `├─ Level 2 (1 час): ${reminderLevel2Video1}`;
    if (deltaLevel2Video1 !== 0) message += ` (${deltaLevel2Video1 > 0 ? '+' : ''}${deltaLevel2Video1})`;
    message += '\n';
    message += `├─ Level 3 (24 часа): ${reminderLevel3Video1}`;
    if (deltaLevel3Video1 !== 0) message += ` (${deltaLevel3Video1 > 0 ? '+' : ''}${deltaLevel3Video1})`;
    message += '\n';
    message += `└─ Итого VIDEO1: ${totalVideo1Reminders}`;
    if (deltaTotalVideo1 !== 0) message += ` (${deltaTotalVideo1 > 0 ? '+' : ''}${deltaTotalVideo1})`;
    message += '\n\n';

    // НАПОМИНАНИЯ VIDEO2 (3 уровня)
    const reminderLevel1Video2 = parseInt(newVideo2ReminderCounts[0]?.reminder_level1_video2 || '0') || 0;
    const reminderLevel2Video2 = parseInt(newVideo2ReminderCounts[0]?.reminder_level2_video2 || '0') || 0;
    const reminderLevel3Video2 = parseInt(newVideo2ReminderCounts[0]?.reminder_level3_video2 || '0') || 0;
    const totalVideo2Reminders = reminderLevel1Video2 + reminderLevel2Video2 + reminderLevel3Video2;
    
    const deltaLevel1Video2 = delta && delta.hasChanges && delta.changes.newReminderLevel1Video2 ? delta.changes.newReminderLevel1Video2 : 0;
    const deltaLevel2Video2 = delta && delta.hasChanges && delta.changes.newReminderLevel2Video2 ? delta.changes.newReminderLevel2Video2 : 0;
    const deltaLevel3Video2 = delta && delta.hasChanges && delta.changes.newReminderLevel3Video2 ? delta.changes.newReminderLevel3Video2 : 0;
    console.log('[/stats] VIDEO2 deltas:', { deltaLevel1Video2, deltaLevel2Video2, deltaLevel3Video2 });
    const deltaTotalVideo2 = deltaLevel1Video2 + deltaLevel2Video2 + deltaLevel3Video2;

    message += '<b>⚡️ НАПОМИНАНИЯ VIDEO2</b> (3 уровня)\n';
    message += `├─ Level 1 (5 мин): ${reminderLevel1Video2}`;
    if (deltaLevel1Video2 !== 0) message += ` (${deltaLevel1Video2 > 0 ? '+' : ''}${deltaLevel1Video2})`;
    message += '\n';
    message += `├─ Level 2 (1 час): ${reminderLevel2Video2}`;
    if (deltaLevel2Video2 !== 0) message += ` (${deltaLevel2Video2 > 0 ? '+' : ''}${deltaLevel2Video2})`;
    message += '\n';
    message += `├─ Level 3 (24 часа): ${reminderLevel3Video2}`;
    if (deltaLevel3Video2 !== 0) message += ` (${deltaLevel3Video2 > 0 ? '+' : ''}${deltaLevel3Video2})`;
    message += '\n';
    message += `└─ Итого VIDEO2: ${totalVideo2Reminders}`;
    if (deltaTotalVideo2 !== 0) message += ` (${deltaTotalVideo2 > 0 ? '+' : ''}${deltaTotalVideo2})`;
    message += '\n\n';

    // НАПОМИНАНИЯ VIDEO3 (3 уровня)
    const reminderLevel1Video3 = parseInt(newVideo3ReminderCounts[0]?.reminder_level1_video3 || '0') || 0;
    const reminderLevel2Video3 = parseInt(newVideo3ReminderCounts[0]?.reminder_level2_video3 || '0') || 0;
    const reminderLevel3Video3 = parseInt(newVideo3ReminderCounts[0]?.reminder_level3_video3 || '0') || 0;
    const totalVideo3Reminders = reminderLevel1Video3 + reminderLevel2Video3 + reminderLevel3Video3;
    
    const deltaLevel1Video3 = delta && delta.hasChanges && delta.changes.newReminderLevel1Video3 ? delta.changes.newReminderLevel1Video3 : 0;
    const deltaLevel2Video3 = delta && delta.hasChanges && delta.changes.newReminderLevel2Video3 ? delta.changes.newReminderLevel2Video3 : 0;
    const deltaLevel3Video3 = delta && delta.hasChanges && delta.changes.newReminderLevel3Video3 ? delta.changes.newReminderLevel3Video3 : 0;
    console.log('[/stats] VIDEO3 deltas:', { deltaLevel1Video3, deltaLevel2Video3, deltaLevel3Video3 });
    const deltaTotalVideo3 = deltaLevel1Video3 + deltaLevel2Video3 + deltaLevel3Video3;

    message += '<b>⚡️ НАПОМИНАНИЯ VIDEO3</b> (3 уровня)\n';
    message += `├─ Level 1 (5 мин): ${reminderLevel1Video3}`;
    if (deltaLevel1Video3 !== 0) message += ` (${deltaLevel1Video3 > 0 ? '+' : ''}${deltaLevel1Video3})`;
    message += '\n';
    message += `├─ Level 2 (1 час): ${reminderLevel2Video3}`;
    if (deltaLevel2Video3 !== 0) message += ` (${deltaLevel2Video3 > 0 ? '+' : ''}${deltaLevel2Video3})`;
    message += '\n';
    message += `├─ Level 3 (24 часа): ${reminderLevel3Video3}`;
    if (deltaLevel3Video3 !== 0) message += ` (${deltaLevel3Video3 > 0 ? '+' : ''}${deltaLevel3Video3})`;
    message += '\n';
    message += `└─ Итого VIDEO3: ${totalVideo3Reminders}`;
    if (deltaTotalVideo3 !== 0) message += ` (${deltaTotalVideo3 > 0 ? '+' : ''}${deltaTotalVideo3})`;
    message += '\n\n';

    // КОНВЕРСИЯ
    const startCount = getStepCount('start');
    const video1Count = getStepCount('video1');
    const passedVideo1 = total - startCount; // Прошли дальше start
    const convVideo1 = total > 0 ? ((passedVideo1 / total) * 100).toFixed(1) : '0.0';
    
    // Конверсия: из тех кто прошёл video1 → сколько оплатило
    const convPayment = passedVideo1 > 0 ? ((paid / passedVideo1) * 100).toFixed(1) : '0.0';

    message += '<b>⏱️ КОНВЕРСИЯ</b>\n';
    message += `├─ Средний путь до оплаты: ${avgTimeStr}\n`;
    message += `├─ start → video1: ${convVideo1}% (${passedVideo1}/${total})\n`;
    message += `├─ video1 → оплата: ${convPayment}% (${paid}/${passedVideo1})\n`;
    message += `└─ Общая конверсия: ${conversionRate}%`;

    console.log('[/stats] Sending reply...');
    await ctx.reply(message, { parse_mode: 'HTML' });

    console.log('[/stats] Creating snapshot...');
    // Создаем новый snapshot
    await statsService.createSnapshot();
    
    console.log('[/stats] Stats command completed successfully!');

  } catch (error) {
    console.error('[/stats] ERROR occurred:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    await ctx.reply('❌ Произошла ошибка при получении статистики');
  }
}
