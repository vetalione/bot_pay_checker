// Новая команда /stats с компактным форматом
// Импортировать в src/index.ts и заменить старую версию

import { Context } from 'telegraf';
import { StatsService } from '../statsService';
import { AppDataSource } from '../database';
import { BroadcastHistory } from '../entities/BroadcastHistory';

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
      warmupCounts,
      newStartReminderCounts,
      newVideo1ReminderCounts,
      newVideo2ReminderCounts,
      newVideo3ReminderCounts,
      reminderCounts,
      totalUsers,
      totalPaid,
      avgTimeToPayment,
      broadcasts,
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
      // Автодогрев (старая система)
      AppDataSource.query(`
        SELECT 
          COUNT(*) FILTER (WHERE "warmupStartSent" = true) as warmup_start,
          COUNT(*) FILTER (WHERE "warmupVideo1Sent" = true) as warmup_video1
        FROM users
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
      // Напоминания
      AppDataSource.query(`
        SELECT 
          COUNT(*) FILTER (WHERE "video1ReminderSent" = true) as video1_reminder,
          COUNT(*) FILTER (WHERE "paymentReminderSent" = true) as payment_reminder,
          COUNT(*) FILTER (WHERE "receiptReminderSent" = true) as receipt_reminder
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
      // Последние 3 рассылки
      AppDataSource.getRepository(BroadcastHistory)
        .find({ order: { createdAt: 'DESC' }, take: 3 }),
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
    const conversionRate = total > 0 ? ((paid / total) * 100).toFixed(1) : '0.0';
    
    const avgHours = parseFloat(avgTimeToPayment[0]?.avg_hours || '0');
    const avgTimeStr = avgHours >= 1 
      ? `${avgHours.toFixed(1)} ${avgHours > 4 ? 'часов' : 'часа'}`
      : `${(avgHours * 60).toFixed(0)} минут`;

    // Подсчет количества рассылок
    const totalBroadcasts = await AppDataSource.getRepository(BroadcastHistory).count();

    // Формируем сообщение
    let message = '📊 <b>СТАТИСТИКА БОТА</b>\n\n';

    // ПОЛЬЗОВАТЕЛИ
    const deltaUsers = delta && delta.hasChanges ? delta.changes.newUsers : 0;
    const deltaPaid = delta && delta.hasChanges ? delta.changes.newPayments : 0;
    
    message += '<b>👥 ПОЛЬЗОВАТЕЛИ</b>\n';
    message += `Всего: ${total}`;
    if (deltaUsers !== 0) message += ` (${deltaUsers > 0 ? '+' : ''}${deltaUsers})`;
    message += ` | Оплатили: ${paid}`;
    if (deltaPaid !== 0) message += ` (${deltaPaid > 0 ? '+' : ''}${deltaPaid})`;
    message += ` | Конверсия: ${conversionRate}%\n\n`;

    // ВОРОНКА
    message += '<b>📍 ВОРОНКА</b> (текущее положение';
    if (delta && delta.hasChanges) message += ' / дельта';
    message += ')\n';
    
    const steps = [
      { icon: '🚀', name: 'start', count: getStepCount('start'), key: 'currentStepStart' },
      { icon: '📹', name: 'video1', count: getStepCount('video1'), key: 'currentStepVideo1' },
      { icon: '📹', name: 'video2', count: getStepCount('video2'), key: 'currentStepVideo2' },
      { icon: '📹', name: 'video3', count: getStepCount('video3'), key: 'currentStepVideo3' },
      { icon: '💳', name: 'payment_choice', count: getStepCount('payment_choice'), key: 'currentStepPaymentChoice' },
      { icon: '💳', name: 'waiting_receipt', count: getStepCount('waiting_receipt'), key: 'currentStepWaitingReceipt' },
      { icon: '✅', name: 'completed', count: getStepCount('completed'), key: 'currentStepCompleted' }
    ];

    for (const step of steps) {
      message += `├─ ${step.icon} ${step.name}: ${step.count} чел`;
      
      if (delta && delta.hasChanges && delta.lastSnapshot) {
        const lastCount = (delta.lastSnapshot as any)[step.key] || 0;
        const deltaCount = step.count - lastCount;
        if (deltaCount !== 0) {
          message += ` (${deltaCount > 0 ? '+' : ''}${deltaCount})`;
        }
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

    // АВТОДОГРЕВ (старая система - скоро удалим)
    const warmupStart = parseInt(warmupCounts[0]?.warmup_start || '0');
    const warmupVideo1 = parseInt(warmupCounts[0]?.warmup_video1 || '0');
    const warmupTotal = warmupStart + warmupVideo1;
    
    const deltaWarmupStart = delta && delta.hasChanges ? delta.changes.newWarmupStartSent || 0 : 0;
    const deltaWarmupVideo1 = delta && delta.hasChanges ? delta.changes.newWarmupVideo1Sent || 0 : 0;

    message += '<b>🔥 АВТОДОГРЕВ (старый)</b>\n';
    message += `├─ На start (старый): ${warmupStart} всего`;
    if (deltaWarmupStart !== 0) message += ` (${deltaWarmupStart > 0 ? '+' : ''}${deltaWarmupStart})`;
    message += '\n';
    message += `└─ На video1: ${warmupVideo1} всего`;
    if (deltaWarmupVideo1 !== 0) message += ` (${deltaWarmupVideo1 > 0 ? '+' : ''}${deltaWarmupVideo1})`;
    message += '\n\n';

    // НОВАЯ СИСТЕМА START (3 уровня)
    const reminderLevel1Start = parseInt(newStartReminderCounts[0]?.reminder_level1_start || '0');
    const reminderLevel2Start = parseInt(newStartReminderCounts[0]?.reminder_level2_start || '0');
    const reminderLevel3Start = parseInt(newStartReminderCounts[0]?.reminder_level3_start || '0');
    const totalStartReminders = reminderLevel1Start + reminderLevel2Start + reminderLevel3Start;
    
    const deltaLevel1Start = delta && delta.hasChanges ? delta.changes.newReminderLevel1Start || 0 : 0;
    const deltaLevel2Start = delta && delta.hasChanges ? delta.changes.newReminderLevel2Start || 0 : 0;
    const deltaLevel3Start = delta && delta.hasChanges ? delta.changes.newReminderLevel3Start || 0 : 0;

    message += '<b>⚡️ НОВАЯ СИСТЕМА START (3 уровня)</b>\n';
    message += `├─ Level 1 (5 мин): ${reminderLevel1Start} всего`;
    if (deltaLevel1Start !== 0) message += ` (${deltaLevel1Start > 0 ? '+' : ''}${deltaLevel1Start})`;
    message += '\n';
    message += `├─ Level 2 (1 час): ${reminderLevel2Start} всего`;
    if (deltaLevel2Start !== 0) message += ` (${deltaLevel2Start > 0 ? '+' : ''}${deltaLevel2Start})`;
    message += '\n';
    message += `├─ Level 3 (24 часа): ${reminderLevel3Start} всего`;
    if (deltaLevel3Start !== 0) message += ` (${deltaLevel3Start > 0 ? '+' : ''}${deltaLevel3Start})`;
    message += '\n';
    message += `└─ Итого START напоминаний: ${totalStartReminders}`;
    if (deltaLevel1Start + deltaLevel2Start + deltaLevel3Start !== 0) {
      message += ` (+${deltaLevel1Start + deltaLevel2Start + deltaLevel3Start})`;
    }
    message += '\n\n';

    // НОВАЯ СИСТЕМА VIDEO1 (3 уровня)
    const reminderLevel1Video1 = parseInt(newVideo1ReminderCounts[0]?.reminder_level1_video1 || '0');
    const reminderLevel2Video1 = parseInt(newVideo1ReminderCounts[0]?.reminder_level2_video1 || '0');
    const reminderLevel3Video1 = parseInt(newVideo1ReminderCounts[0]?.reminder_level3_video1 || '0');
    const totalVideo1Reminders = reminderLevel1Video1 + reminderLevel2Video1 + reminderLevel3Video1;
    
    const deltaLevel1Video1 = delta && delta.hasChanges ? delta.changes.newReminderLevel1Video1 || 0 : 0;
    const deltaLevel2Video1 = delta && delta.hasChanges ? delta.changes.newReminderLevel2Video1 || 0 : 0;
    const deltaLevel3Video1 = delta && delta.hasChanges ? delta.changes.newReminderLevel3Video1 || 0 : 0;

    message += '<b>⚡️ НОВАЯ СИСТЕМА VIDEO1 (3 уровня)</b>\n';
    message += `├─ Level 1 (5 мин): ${reminderLevel1Video1} всего`;
    if (deltaLevel1Video1 !== 0) message += ` (${deltaLevel1Video1 > 0 ? '+' : ''}${deltaLevel1Video1})`;
    message += '\n';
    message += `├─ Level 2 (1 час): ${reminderLevel2Video1} всего`;
    if (deltaLevel2Video1 !== 0) message += ` (${deltaLevel2Video1 > 0 ? '+' : ''}${deltaLevel2Video1})`;
    message += '\n';
    message += `├─ Level 3 (24 часа): ${reminderLevel3Video1} всего`;
    if (deltaLevel3Video1 !== 0) message += ` (${deltaLevel3Video1 > 0 ? '+' : ''}${deltaLevel3Video1})`;
    message += '\n';
    message += `└─ Итого VIDEO1 напоминаний: ${totalVideo1Reminders}`;
    if (deltaLevel1Video1 + deltaLevel2Video1 + deltaLevel3Video1 !== 0) {
      message += ` (+${deltaLevel1Video1 + deltaLevel2Video1 + deltaLevel3Video1})`;
    }
    message += '\n\n';

    // НОВАЯ СИСТЕМА VIDEO2 (3 уровня)
    const reminderLevel1Video2 = parseInt(newVideo2ReminderCounts[0]?.reminder_level1_video2 || '0');
    const reminderLevel2Video2 = parseInt(newVideo2ReminderCounts[0]?.reminder_level2_video2 || '0');
    const reminderLevel3Video2 = parseInt(newVideo2ReminderCounts[0]?.reminder_level3_video2 || '0');
    const totalVideo2Reminders = reminderLevel1Video2 + reminderLevel2Video2 + reminderLevel3Video2;
    
    const deltaLevel1Video2 = delta && delta.hasChanges ? delta.changes.newReminderLevel1Video2 || 0 : 0;
    const deltaLevel2Video2 = delta && delta.hasChanges ? delta.changes.newReminderLevel2Video2 || 0 : 0;
    const deltaLevel3Video2 = delta && delta.hasChanges ? delta.changes.newReminderLevel3Video2 || 0 : 0;

    message += '<b>⚡️ НОВАЯ СИСТЕМА VIDEO2 (3 уровня)</b>\n';
    message += `├─ Level 1 (5 мин): ${reminderLevel1Video2} всего`;
    if (deltaLevel1Video2 !== 0) message += ` (${deltaLevel1Video2 > 0 ? '+' : ''}${deltaLevel1Video2})`;
    message += '\n';
    message += `├─ Level 2 (1 час): ${reminderLevel2Video2} всего`;
    if (deltaLevel2Video2 !== 0) message += ` (${deltaLevel2Video2 > 0 ? '+' : ''}${deltaLevel2Video2})`;
    message += '\n';
    message += `├─ Level 3 (24 часа): ${reminderLevel3Video2} всего`;
    if (deltaLevel3Video2 !== 0) message += ` (${deltaLevel3Video2 > 0 ? '+' : ''}${deltaLevel3Video2})`;
    message += '\n';
    message += `└─ Итого VIDEO2 напоминаний: ${totalVideo2Reminders}`;
    if (deltaLevel1Video2 + deltaLevel2Video2 + deltaLevel3Video2 !== 0) {
      message += ` (+${deltaLevel1Video2 + deltaLevel2Video2 + deltaLevel3Video2})`;
    }
    message += '\n\n';

    // НОВАЯ СИСТЕМА VIDEO3 (3 уровня)
    const reminderLevel1Video3 = parseInt(newVideo3ReminderCounts[0]?.reminder_level1_video3 || '0');
    const reminderLevel2Video3 = parseInt(newVideo3ReminderCounts[0]?.reminder_level2_video3 || '0');
    const reminderLevel3Video3 = parseInt(newVideo3ReminderCounts[0]?.reminder_level3_video3 || '0');
    const totalVideo3Reminders = reminderLevel1Video3 + reminderLevel2Video3 + reminderLevel3Video3;
    
    const deltaLevel1Video3 = delta && delta.hasChanges ? delta.changes.newReminderLevel1Video3 || 0 : 0;
    const deltaLevel2Video3 = delta && delta.hasChanges ? delta.changes.newReminderLevel2Video3 || 0 : 0;
    const deltaLevel3Video3 = delta && delta.hasChanges ? delta.changes.newReminderLevel3Video3 || 0 : 0;

    message += '<b>⚡️ НОВАЯ СИСТЕМА VIDEO3 (3 уровня)</b>\n';
    message += `├─ Level 1 (5 мин): ${reminderLevel1Video3} всего`;
    if (deltaLevel1Video3 !== 0) message += ` (${deltaLevel1Video3 > 0 ? '+' : ''}${deltaLevel1Video3})`;
    message += '\n';
    message += `├─ Level 2 (1 час): ${reminderLevel2Video3} всего`;
    if (deltaLevel2Video3 !== 0) message += ` (${deltaLevel2Video3 > 0 ? '+' : ''}${deltaLevel2Video3})`;
    message += '\n';
    message += `├─ Level 3 (24 часа): ${reminderLevel3Video3} всего`;
    if (deltaLevel3Video3 !== 0) message += ` (${deltaLevel3Video3 > 0 ? '+' : ''}${deltaLevel3Video3})`;
    message += '\n';
    message += `└─ Итого VIDEO3 напоминаний: ${totalVideo3Reminders}`;
    if (deltaLevel1Video3 + deltaLevel2Video3 + deltaLevel3Video3 !== 0) {
      message += ` (+${deltaLevel1Video3 + deltaLevel2Video3 + deltaLevel3Video3})`;
    }
    message += '\n\n';

    // НАПОМИНАНИЯ (старая система для других этапов)
    const video1Reminder = parseInt(reminderCounts[0]?.video1_reminder || '0');
    const paymentReminder = parseInt(reminderCounts[0]?.payment_reminder || '0');
    const receiptReminder = parseInt(reminderCounts[0]?.receipt_reminder || '0');

    const deltaVideo1Reminder = delta && delta.hasChanges ? delta.changes.newVideo1Reminders || 0 : 0;
    const deltaPaymentReminder = delta && delta.hasChanges ? delta.changes.newPaymentReminders || 0 : 0;
    const deltaReceiptReminder = delta && delta.hasChanges ? delta.changes.newReceiptReminders || 0 : 0;

    message += '<b>📢 НАПОМИНАНИЯ (старые)</b>\n';
    message += `├─ video1 (10 мин, старый): ${video1Reminder} всего`;
    if (deltaVideo1Reminder !== 0) message += ` (${deltaVideo1Reminder > 0 ? '+' : ''}${deltaVideo1Reminder})`;
    message += '\n';
    message += `├─ payment_choice (5 мин): ${paymentReminder} всего`;
    if (deltaPaymentReminder !== 0) message += ` (${deltaPaymentReminder > 0 ? '+' : ''}${deltaPaymentReminder})`;
    message += '\n';
    message += `└─ waiting_receipt (5 мин): ${receiptReminder} всего`;
    if (deltaReceiptReminder !== 0) message += ` (${deltaReceiptReminder > 0 ? '+' : ''}${deltaReceiptReminder})`;
    message += '\n\n';

    // РАЗОВЫЕ РАССЫЛКИ
    message += `<b>📣 РАЗОВЫЕ РАССЫЛКИ</b> (всего: ${totalBroadcasts} за все время)\n`;
    
    if (broadcasts.length === 0) {
      message += '└─ Рассылок пока не было\n\n';
    } else {
      for (let i = 0; i < broadcasts.length; i++) {
        const b = broadcasts[i];
        const date = new Date(b.createdAt);
        const dateStr = date.toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        const prefix = i === broadcasts.length - 1 ? '└─' : '├─';
        let segments: string[] = [];
        if (b.segmentStart > 0) segments.push(`start: ${b.segmentStart}`);
        if (b.segmentVideo1 > 0) segments.push(`video1: ${b.segmentVideo1}`);
        
        message += `${prefix} ${dateStr} | ${b.broadcastType}`;
        if (segments.length > 0) {
          message += ` | ${segments.join(', ')}`;
        }
        message += ` | ${b.totalSent}/${b.totalAttempted}\n`;
      }
      message += '\n';
    }

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
