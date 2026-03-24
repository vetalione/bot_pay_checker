import express, { Request, Response } from 'express';
import { Telegraf } from 'telegraf';
import { UserService } from './userService';
import { AppDataSource } from './database';
import { User } from './entities/User';

/**
 * Tribute Webhook Handler
 * Обрабатывает уведомления о платежах от Tribute API
 */

interface TributeWebhookPayload {
  name: string; // "new_subscription"
  created_at: string;
  sent_at: string;
  payload: {
    subscription_name: string;
    subscription_id: number;
    period_id: number;
    period: string; // "monthly"
    price: number; // Цена в минорных единицах (копейках/центах)
    amount: number; // Фактическая сумма после комиссии
    currency: string; // "rub" | "eur" | "usd"
    trb_user_id: number; // Новый единый ID пользователя в Tribute (заменяет user_id с 14.04.2026)
    user_id?: number; // Устаревший ID пользователя в Tribute (удаляется 14.04.2026)
    telegram_user_id: number; // ID пользователя в Telegram
    channel_id: number;
    channel_name: string;
    expires_at: string;
  };
}

export class TributeWebhookService {
  private app: express.Application;
  private bot: Telegraf;
  private userService: UserService;
  private apiKey: string;

  constructor(bot: Telegraf, apiKey: string) {
    this.app = express();
    this.bot = bot;
    this.apiKey = apiKey;
    this.userService = new UserService();
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // Parse JSON bodies
    this.app.use(express.json());
    
    // CORS для Tribute
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      next();
    });

    // Логирование всех входящих запросов
    this.app.use((req, res, next) => {
      const timestamp = new Date().toISOString();
      console.log(`📥 [${timestamp}] ${req.method} ${req.path}`);
      console.log(`   Headers:`, JSON.stringify(req.headers, null, 2));
      if (req.body && Object.keys(req.body).length > 0) {
        console.log(`   Body:`, JSON.stringify(req.body, null, 2));
      }
      next();
    });
  }

  private setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Tribute webhook GET endpoint (для проверки доступности)
    this.app.get('/webhook/tribute', (req, res) => {
      res.json({ 
        status: 'ready',
        service: 'Tribute Webhook Handler',
        methods: ['POST'],
        timestamp: new Date().toISOString()
      });
    });

    // OPTIONS для CORS preflight
    this.app.options('/webhook/tribute', (req, res) => {
      res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.status(204).send();
    });

    // Tribute webhook endpoint
    this.app.post('/webhook/tribute', async (req: Request, res: Response) => {
      try {
        await this.handleTributeWebhook(req, res);
      } catch (error) {
        console.error('❌ Ошибка обработки Tribute webhook:', error);
        res.status(500).json({ 
          success: false,
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  }

  private async handleTributeWebhook(req: Request, res: Response) {
    const payload = req.body as TributeWebhookPayload;

    console.log('🔔 Получен webhook от Tribute:');
    console.log('  Event:', payload.name);
    console.log('  Telegram User ID:', payload.payload?.telegram_user_id);
    console.log('  Tribute User ID (trb_user_id):', payload.payload?.trb_user_id);
    console.log('  Tribute User ID (user_id, deprecated):', payload.payload?.user_id);
    console.log('  Currency:', payload.payload?.currency?.toUpperCase());
    console.log('  Price:', payload.payload?.price);

    // Быстрый ответ Tribute (важно ответить быстро!)
    res.status(200).json({ 
      success: true,
      status: 'received',
      event: payload.name,
      timestamp: new Date().toISOString()
    });

    // Обрабатываем платеж асинхронно
    this.processPayment(payload).catch(error => {
      console.error('❌ Ошибка асинхронной обработки платежа:', error);
    });
  }

  private async processPayment(payload: TributeWebhookPayload) {
    const { telegram_user_id, currency, price, trb_user_id, user_id } = payload.payload;

    // Используем trb_user_id как основной идентификатор Tribute (с fallback на user_id до 14.04.2026)
    const tributeUserId = trb_user_id ?? user_id;
    console.log(`🆔 Tribute user: trb_user_id=${trb_user_id}, user_id(deprecated)=${user_id}, telegram_user_id=${telegram_user_id}`);

    // Проверяем событие
    if (payload.name !== 'new_subscription') {
      console.log(`⚠️ Пропускаем событие: ${payload.name}`);
      return;
    }

    try {
      // Получаем пользователя из БД
      const userRepository = AppDataSource.getRepository(User);
      let user = await userRepository.findOne({
        where: { userId: telegram_user_id }
      });

      if (!user) {
        console.log(`⚠️ Пользователь ${telegram_user_id} не найден в БД. Создаем новую запись...`);
        
        // Создаем нового пользователя
        user = userRepository.create({
          userId: telegram_user_id,
          currentStep: 'completed',
          hasPaid: true,
          paidAt: new Date(),
          currency: currency.toUpperCase() as 'RUB' | 'EUR' | 'UAH',
        });
      } else {
        // Обновляем существующего пользователя
        user.hasPaid = true;
        user.paidAt = new Date();
        user.currentStep = 'completed';
        user.currency = currency.toUpperCase() as 'RUB' | 'EUR' | 'UAH';
      }

      await userRepository.save(user);

      console.log(`✅ Пользователь ${telegram_user_id} помечен как оплативший (${currency.toUpperCase()}, ${price})`);

      // Отправляем приглашение в канал
      await this.sendChannelInvite(telegram_user_id);

    } catch (error) {
      console.error(`❌ Ошибка обработки платежа для пользователя ${telegram_user_id}:`, error);
      throw error;
    }
  }

  private async sendChannelInvite(userId: number) {
    try {
      const channelId = process.env.CHANNEL_ID!;
      const chatId = process.env.CHAT_ID!;

      // Генерируем invite link для канала
      const channelInvite = await this.bot.telegram.createChatInviteLink(channelId, {
        member_limit: 1,
        name: `User_${userId}`
      });

      // Генерируем invite link для чата
      const chatInvite = await this.bot.telegram.createChatInviteLink(chatId, {
        member_limit: 1,
        name: `User_${userId}_chat`
      });

      // Отправляем сообщение пользователю
      const message = `🎉 Поздравляем! Оплата получена!

✅ Вот ваши ссылки для доступа:

📢 Канал с контентом:
${channelInvite.invite_link}

💬 Чат участников:
${chatInvite.invite_link}

Добро пожаловать в нашу команду! 🚀`;

      await this.bot.telegram.sendMessage(userId, message);

      console.log(`✅ Отправлены инвайты пользователю ${userId}`);

    } catch (error: any) {
      console.error(`❌ Ошибка отправки инвайтов пользователю ${userId}:`, error?.message || error);
      
      // Если не удалось отправить инвайты, логируем это
      // но не падаем - платеж уже обработан в БД
      if (error?.response?.error_code === 403) {
        console.log(`⚠️ Пользователь ${userId} заблокировал бота`);
      }
    }
  }

  public start(port: number = 3000): void {
    const server = this.app.listen(port, '0.0.0.0', () => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🚀 Tribute Webhook Server ЗАПУЩЕН`);
      console.log(`${'='.repeat(60)}`);
      console.log(`🌐 Host: 0.0.0.0`);
      console.log(`🔌 Port: ${port}`);
      console.log(`📡 Health Check: http://0.0.0.0:${port}/health`);
      console.log(`📡 Webhook URL: http://0.0.0.0:${port}/webhook/tribute`);
      console.log(`🔑 API Key: ${this.apiKey.substring(0, 12)}...`);
      console.log(`${'='.repeat(60)}\n`);
    });

    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Порт ${port} уже используется!`);
      } else {
        console.error(`❌ Ошибка запуска сервера:`, error);
      }
      process.exit(1);
    });
  }

  public getApp(): express.Application {
    return this.app;
  }
}
