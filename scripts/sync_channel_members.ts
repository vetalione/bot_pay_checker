import * as dotenv from 'dotenv';
// ВАЖНО: загружаем .env ДО импорта других модулей
dotenv.config();

import { Telegraf } from 'telegraf';
import { AppDataSource } from '../src/database';
import { ChannelSyncService } from '../src/services/channelSyncService';

const bot = new Telegraf(process.env.BOT_TOKEN!);
const CHANNEL_ID = process.env.CHANNEL_ID!;

async function syncChannel() {
  console.log('🔄 Запуск синхронизации участников канала...\n');

  try {
    // Подключаемся к БД
    await AppDataSource.initialize();
    console.log('✅ База данных подключена\n');

    // Создаём сервис синхронизации
    const channelSyncService = new ChannelSyncService(bot);
    
    console.log(`📢 Канал ID: ${CHANNEL_ID}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Запускаем синхронизацию
    const result = await channelSyncService.syncChannelMembers(CHANNEL_ID);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🎉 Синхронизация завершена!\n');
    console.log('📊 РЕЗУЛЬТАТЫ:');
    console.log(`   👥 Всего участников: ${result.totalMembers}`);
    console.log(`   ✅ Оплативших: ${result.paidMembers}`);
    console.log(`   ❌ Удалено из канала: ${result.removedUsers}`);
    console.log(`   ℹ️  Уже не было в канале: ${result.alreadyNotInChannel}`);
    
    if (result.errors > 0) {
      console.log(`   ⚠️  Ошибок при удалении: ${result.errors}`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error: any) {
    console.error('❌ Критическая ошибка:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
    process.exit(0);
  }
}

// Запускаем
syncChannel();
