import { AppDataSource } from './src/database';
import { StatsService } from './src/statsService';

async function testStats() {
  try {
    console.log('Подключаемся к базе данных...');
    await AppDataSource.initialize();
    console.log('✅ База данных подключена\n');

    const statsService = new StatsService();
    await statsService.logPaymentStats();

    const stats = await statsService.getPaymentStats();
    
    if (stats) {
      console.log('\n📋 Детальная информация:');
      console.log(JSON.stringify(stats, null, 2));
    }

    await AppDataSource.destroy();
    console.log('\n✅ Подключение закрыто');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

testStats();
