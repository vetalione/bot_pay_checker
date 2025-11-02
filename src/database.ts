import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './entities/User';
import { UserAction } from './entities/UserAction';
import { PaymentStats } from './entities/PaymentStats';

// Получаем DATABASE_URL из переменных окружения
// Для Railway это будет автоматически
// Локально можно использовать: postgresql://user:password@localhost:5432/dbname
const databaseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/telegram_bot';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  synchronize: true, // Автоматически создает таблицы (для production лучше использовать migrations)
  logging: process.env.NODE_ENV !== 'production' ? ['error', 'warn', 'schema'] : ['error'],
  entities: [User, UserAction, PaymentStats],
  subscribers: [],
  migrations: [],
  // Настройки для стабильного соединения с Railway
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectTimeoutMS: 30000,
  extra: {
    max: 10, // максимум соединений в пуле
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
  }
});

// Инициализация соединения
export async function initializeDatabase() {
  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      console.log(`🔄 Попытка подключения к БД... (${retries + 1}/${maxRetries})`);
      
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }
      
      console.log('✅ База данных подключена успешно');
      
      // Проверяем соединение
      await AppDataSource.query('SELECT 1');
      console.log('✅ Тестовый запрос выполнен успешно');
      
      return AppDataSource;
    } catch (error) {
      retries++;
      console.error(`❌ Ошибка подключения к БД (попытка ${retries}/${maxRetries}):`, error);
      
      if (retries >= maxRetries) {
        console.error('❌ Превышено максимальное количество попыток подключения к БД');
        throw error;
      }
      
      // Ждем перед следующей попыткой (экспоненциальная задержка)
      const delay = Math.min(1000 * Math.pow(2, retries), 10000);
      console.log(`⏳ Ожидание ${delay}ms перед следующей попыткой...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Не удалось подключиться к базе данных');
}
