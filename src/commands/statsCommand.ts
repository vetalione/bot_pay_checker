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
    const statsService = new StatsService();
    
    // Получаем все данные параллельно
    const [
      currentStepDistribution,
      paymentMethods,
      warmupCounts,
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
      // Автодогрев
      AppDataSource.query(`
        SELECT 
          COUNT(*) FILTER (WHERE "warmupStartSent" = true) as warmup_start,
          COUNT(*) FILTER (WHERE "warmupVideo1Sent" = true) as warmup_video1
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

    // АВТОДОГРЕВ
    const warmupStart = parseInt(warmupCounts[0].warmup_start);
    const warmupVideo1 = parseInt(warmupCounts[0].warmup_video1);
    const warmupTotal = warmupStart + warmupVideo1;
    
    const deltaWarmupStart = delta && delta.hasChanges ? delta.changes.newWarmupStartSent || 0 : 0;
    const deltaWarmupVideo1 = delta && delta.hasChanges ? delta.changes.newWarmupVideo1Sent || 0 : 0;

    message += '<b>🔥 АВТОДОГРЕВ</b> (за все время / дельта)\n';
    message += `├─ На start: ${warmupStart} всего`;
    if (deltaWarmupStart !== 0) message += ` (${deltaWarmupStart > 0 ? '+' : ''}${deltaWarmupStart})`;
    message += '\n';
    message += `├─ На video1: ${warmupVideo1} всего`;
    if (deltaWarmupVideo1 !== 0) message += ` (${deltaWarmupVideo1 > 0 ? '+' : ''}${deltaWarmupVideo1})`;
    message += '\n';
    message += `└─ Итого догревов: ${warmupTotal}`;
    if (deltaWarmupStart + deltaWarmupVideo1 !== 0) {
      message += ` (+${deltaWarmupStart + deltaWarmupVideo1})`;
    }
    message += '\n\n';

    // НАПОМИНАНИЯ
    const video1Reminder = parseInt(reminderCounts[0].video1_reminder);
    const paymentReminder = parseInt(reminderCounts[0].payment_reminder);
    const receiptReminder = parseInt(reminderCounts[0].receipt_reminder);

    message += '<b>📢 НАПОМИНАНИЯ 24ч</b> (за все время / дельта)\n';
    message += `├─ video1: ${video1Reminder} всего\n`;
    message += `├─ payment_choice: ${paymentReminder} всего\n`;
    message += `└─ waiting_receipt: ${receiptReminder} всего\n\n`;

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
    const video1Count = getStepCount('video1');
    const passedVideo1 = total - getStepCount('start');
    const convVideo1 = total > 0 ? ((passedVideo1 / total) * 100).toFixed(1) : '0.0';
    const convPayment = video1Count > 0 ? ((paid / video1Count) * 100).toFixed(1) : '0.0';

    message += '<b>⏱️ КОНВЕРСИЯ</b>\n';
    message += `├─ Средний путь до оплаты: ${avgTimeStr}\n`;
    message += `├─ start → video1: ${convVideo1}% (${passedVideo1}/${total})\n`;
    message += `├─ video1 → оплата: ${convPayment}% (${paid}/${video1Count})\n`;
    message += `└─ Общая конверсия: ${conversionRate}%`;

    await ctx.reply(message, { parse_mode: 'HTML' });

    // Создаем новый snapshot
    await statsService.createSnapshot();

  } catch (error) {
    console.error('Ошибка в команде /stats:', error);
    await ctx.reply('❌ Произошла ошибка при получении статистики');
  }
}
