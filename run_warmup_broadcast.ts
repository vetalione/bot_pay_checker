import 'reflect-metadata';
import { Telegraf } from 'telegraf';
import { AppDataSource } from './src/database';
import { WarmupService } from './src/services/warmupService';
import * as dotenv from 'dotenv';

dotenv.config();

// Переопределяем DATABASE_URL для Railway
process.env.DATABASE_URL = 'postgresql://postgres:tbswlvQbgFmiOdcJPKyAckRuSmvrYxxw@nozomi.proxy.rlwy.net:35365/railway';

async function runWarmupBroadcast() {
  try {
    console.log('🔥 Инициализация warmup рассылки...\n');

    // Подключаемся к БД
    await AppDataSource.initialize();
    console.log('✅ База данных подключена');
    console.log('📊 База:', AppDataSource.options.database, '\n');

    // Создаём бота
    const bot = new Telegraf(process.env.BOT_TOKEN!);
    
    // Создаём WarmupService
    const warmupService = new WarmupService(bot);
    
    console.log('📨 Начинаю разовую рассылку warmup для всех застрявших на start и video1...\n');
    
    // Запускаем рассылку
    const result = await warmupService.sendBroadcastToStuck();
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔥 РЕЗУЛЬТАТЫ WARMUP РАССЫЛКИ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`👥 Всего пользователей: ${result.total}`);
    console.log(`✅ Отправлено: ${result.sent}`);
    console.log(`❌ Ошибок: ${result.failed}\n`);
    
    const successRate = result.total > 0 ? ((result.sent / result.total) * 100).toFixed(1) : '0';
    console.log(`📊 Успешность: ${successRate}%\n`);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Рассылка завершена!');
    console.log('\n💡 Теперь используй /stats в боте чтобы увидеть результаты!\n');

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка при warmup рассылке:', error);
    await AppDataSource.destroy();
    process.exit(1);
  }
}

runWarmupBroadcast();
