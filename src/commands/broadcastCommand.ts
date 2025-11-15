// Команда /broadcast для просмотра истории разовых рассылок

import { Context } from 'telegraf';
import { AppDataSource } from '../database';
import { BroadcastHistory } from '../entities/BroadcastHistory';

export async function broadcastCommand(ctx: Context) {
  const userId = ctx.from!.id;
  
  // Проверка админа
  if (userId !== 278263484) {
    await ctx.reply('У вас нет доступа к этой команде.');
    return;
  }

  try {
    console.log('[/broadcast] Starting broadcast command...');
    
    // Получаем все рассылки, отсортированные по дате (последние сверху)
    const broadcasts = await AppDataSource.getRepository(BroadcastHistory)
      .find({ 
        order: { createdAt: 'DESC' },
        take: 20 // Показываем последние 20 рассылок
      });

    // Подсчитываем общую статистику
    const totalBroadcasts = await AppDataSource.getRepository(BroadcastHistory).count();
    
    const stats = await AppDataSource.query(`
      SELECT 
        SUM("totalSent") as total_sent,
        SUM("totalAttempted") as total_attempted,
        SUM("segmentStart") as total_start_segment,
        SUM("segmentVideo1") as total_video1_segment
      FROM broadcast_history
    `);

    const totalSent = parseInt(stats[0]?.total_sent || '0');
    const totalAttempted = parseInt(stats[0]?.total_attempted || '0');
    const totalStartSegment = parseInt(stats[0]?.total_start_segment || '0');
    const totalVideo1Segment = parseInt(stats[0]?.total_video1_segment || '0');
    
    const successRate = totalAttempted > 0 
      ? ((totalSent / totalAttempted) * 100).toFixed(1) 
      : '0.0';

    // Формируем сообщение
    let message = '📣 <b>РАЗОВЫЕ РАССЫЛКИ</b>\n\n';

    // ОБЩАЯ СТАТИСТИКА
    message += '<b>📊 ОБЩАЯ СТАТИСТИКА</b>\n';
    message += `├─ Всего рассылок: ${totalBroadcasts}\n`;
    message += `├─ Отправлено сообщений: ${totalSent}\n`;
    message += `├─ Попыток отправки: ${totalAttempted}\n`;
    message += `├─ Успешность: ${successRate}%\n`;
    message += `├─ Сегмент start: ${totalStartSegment} сообщений\n`;
    message += `└─ Сегмент video1: ${totalVideo1Segment} сообщений\n\n`;

    // ИСТОРИЯ РАССЫЛОК
    if (broadcasts.length === 0) {
      message += '<b>📋 ИСТОРИЯ</b>\n';
      message += '└─ Рассылок пока не было\n';
    } else {
      message += `<b>📋 ИСТОРИЯ</b> (последние ${broadcasts.length})\n`;
      
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
        
        // Формируем информацию о сегментах
        let segments: string[] = [];
        if (b.segmentStart > 0) segments.push(`start: ${b.segmentStart}`);
        if (b.segmentVideo1 > 0) segments.push(`video1: ${b.segmentVideo1}`);
        
        const segmentInfo = segments.length > 0 ? segments.join(', ') : 'все';
        const successRate = b.totalAttempted > 0 
          ? ((b.totalSent / b.totalAttempted) * 100).toFixed(0)
          : '0';

        message += `${prefix} <b>${dateStr}</b>\n`;
        message += `   │  Тип: ${b.broadcastType}\n`;
        message += `   │  Сегменты: ${segmentInfo}\n`;
        message += `   │  Результат: ${b.totalSent}/${b.totalAttempted} (${successRate}%)\n`;
        
        if (i < broadcasts.length - 1) {
          message += '   │\n';
        }
      }
    }

    console.log('[/broadcast] Sending reply...');
    await ctx.reply(message, { parse_mode: 'HTML' });
    
    console.log('[/broadcast] Broadcast command completed successfully!');

  } catch (error) {
    console.error('[/broadcast] ERROR occurred:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    await ctx.reply('❌ Произошла ошибка при получении истории рассылок');
  }
}
