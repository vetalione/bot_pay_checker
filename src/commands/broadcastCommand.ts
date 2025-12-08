// Команда /broadcast для просмотра истории разовых рассылок и статистики цепочки

import { Context } from 'telegraf';
import { AppDataSource } from '../database';
import { BroadcastHistory } from '../entities/BroadcastHistory';
import { CourseChainProgress } from '../entities/CourseChainProgress';

export async function broadcastCommand(ctx: Context) {
  const userId = ctx.from!.id;
  
  // Проверка админа
  if (userId !== 278263484) {
    await ctx.reply('У вас нет доступа к этой команде.');
    return;
  }

  try {
    console.log('[/broadcast] Starting broadcast command...');
    
    // ========== СТАТИСТИКА ЦЕПОЧКИ КУРСА ==========
    const chainRepo = AppDataSource.getRepository(CourseChainProgress);
    
    const chainTotal = await chainRepo.count();
    const chainBlocked = await chainRepo.count({ where: { blocked: true } });
    const chainReserved = await chainRepo.count({ where: { reservedSpot: true } });
    
    let chainMessage = '🎓 <b>ЦЕПОЧКА КУРСА</b>\n\n';
    
    if (chainTotal > 0) {
      // Получаем статистику по каждому сообщению
      const getStats = async (msgNum: number) => {
        const sent = await chainRepo.createQueryBuilder('p')
          .where(`p.msg${msgNum}Status = 'sent'`)
          .getCount();
        const clicked = await chainRepo.createQueryBuilder('p')
          .where(`p.msg${msgNum}Status = 'clicked'`)
          .getCount();
        const pending = await chainRepo.createQueryBuilder('p')
          .where(`p.msg${msgNum}Status = 'pending'`)
          .getCount();
        return { sent, clicked, pending, total: sent + clicked };
      };
      
      const msg1 = await getStats(1);
      const msg2 = await getStats(2);
      const msg3 = await getStats(3);
      const msg4 = await getStats(4);
      
      chainMessage += `👥 Всего: ${chainTotal} | 🚫 Блок: ${chainBlocked} | 🎟 Бронь: ${chainReserved}\n\n`;
      
      chainMessage += `<b>📨 Сообщение 1 (вход):</b>\n`;
      chainMessage += `   📤 ${msg1.total} отправлено | 👆 ${msg1.clicked} кликнули\n\n`;
      
      chainMessage += `<b>📨 Сообщение 2 (программа):</b>\n`;
      chainMessage += `   📤 ${msg2.total} отправлено | 👆 ${msg2.clicked} кликнули\n\n`;
      
      chainMessage += `<b>📨 Сообщение 3 (возражения):</b>\n`;
      chainMessage += `   📤 ${msg3.total} отправлено | 👆 ${msg3.clicked} кликнули\n\n`;
      
      chainMessage += `<b>📨 Сообщение 4 (тарифы):</b>\n`;
      chainMessage += `   📤 ${msg4.total} отправлено | 👆 ${msg4.clicked} кликнули\n\n`;
      
      // Конверсия
      if (msg1.total > 0) {
        const conv1to2 = ((msg2.total / msg1.total) * 100).toFixed(1);
        const conv1to4 = ((msg4.total / msg1.total) * 100).toFixed(1);
        chainMessage += `📈 <b>Конверсия:</b> 1→2: ${conv1to2}% | 1→4: ${conv1to4}%\n`;
      }
    } else {
      chainMessage += '└─ Цепочка ещё не запускалась\n';
    }
    
    chainMessage += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    
    // ========== ИСТОРИЯ РАССЫЛОК ==========
    const broadcasts = await AppDataSource.getRepository(BroadcastHistory)
      .find({ 
        order: { createdAt: 'DESC' },
        take: 10
      });

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

    // Формируем сообщение - начинаем с цепочки курса
    let message = chainMessage;
    
    message += '📣 <b>РАЗОВЫЕ РАССЫЛКИ</b>\n\n';

    // ОБЩАЯ СТАТИСТИКА
    message += `📊 Всего: ${totalBroadcasts} | Отправлено: ${totalSent}\n\n`;

    // ИСТОРИЯ РАССЫЛОК (краткая)
    if (broadcasts.length === 0) {
      message += '└─ Рассылок пока не было\n';
    } else {
      message += `<b>📋 Последние ${broadcasts.length}:</b>\n`;
      
      for (let i = 0; i < broadcasts.length; i++) {
        const b = broadcasts[i];
        const date = new Date(b.createdAt);
        const dateStr = date.toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        const prefix = i === broadcasts.length - 1 ? '└─' : '├─';
        
        const successRate = b.totalAttempted > 0 
          ? ((b.totalSent / b.totalAttempted) * 100).toFixed(0)
          : '0';

        message += `${prefix} ${dateStr} | ${b.broadcastType} | ${b.totalSent}/${b.totalAttempted}\n`;
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