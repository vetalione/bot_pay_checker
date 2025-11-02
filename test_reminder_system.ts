import { AppDataSource } from './src/database';
import { User } from './src/entities/User';

async function testReminderSystem() {
  try {
    console.log('Подключаемся к базе данных...');
    await AppDataSource.initialize();
    console.log('✅ База данных подключена\n');

    const userRepository = AppDataSource.getRepository(User);

    // Находим пользователей на этапе выбора оплаты
    const usersAtPaymentChoice = await userRepository.find({
      where: { currentStep: 'payment_choice' }
    });

    console.log('📊 СТАТИСТИКА ПО ВЫБОРУ ОПЛАТЫ:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Всего на этапе выбора оплаты: ${usersAtPaymentChoice.length}`);

    if (usersAtPaymentChoice.length > 0) {
      console.log('\n📋 Детали по пользователям:');
      
      for (const user of usersAtPaymentChoice) {
        console.log(`\nUserId: ${user.userId}`);
        console.log(`Username: @${user.username || 'unknown'}`);
        console.log(`Валюта выбрана: ${user.currency || 'НЕТ'}`);
        console.log(`Время показа выбора: ${user.paymentChoiceShownAt || 'НЕ УСТАНОВЛЕНО'}`);
        console.log(`Напоминание отправлено: ${user.paymentReminderSent ? 'ДА' : 'НЕТ'}`);
        
        if (user.paymentChoiceShownAt) {
          const minutesAgo = Math.floor((Date.now() - user.paymentChoiceShownAt.getTime()) / (60 * 1000));
          console.log(`Прошло минут: ${minutesAgo}`);
          
          if (minutesAgo >= 5 && !user.paymentReminderSent && !user.currency) {
            console.log('⚠️  ДОЛЖНО БЫТЬ ОТПРАВЛЕНО НАПОМИНАНИЕ!');
          }
        }
        console.log('─'.repeat(50));
      }
    }

    // Статистика по напоминаниям
    const remindersSent = await userRepository.count({
      where: { paymentReminderSent: true }
    });

    console.log('\n📈 ОБЩАЯ СТАТИСТИКА:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Всего отправлено напоминаний: ${remindersSent}`);

    await AppDataSource.destroy();
    console.log('\n✅ Подключение закрыто');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

testReminderSystem();
