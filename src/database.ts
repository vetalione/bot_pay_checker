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
  logging: false,
  entities: [User, UserAction, PaymentStats],
  subscribers: [],
  migrations: [],
});

// Инициализация соединения
export async function initializeDatabase() {
  try {
    await AppDataSource.initialize();
    console.log('✅ База данных подключена успешно');
    return AppDataSource;
  } catch (error) {
    console.error('❌ Ошибка подключения к БД:', error);
    throw error;
  }
}
