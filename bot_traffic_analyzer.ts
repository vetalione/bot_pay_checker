import * as dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

interface BotInfo {
  id: number;
  username: string;
  first_name: string;
  can_join_groups: boolean;
  can_read_all_group_messages: boolean;
  supports_inline_queries: boolean;
}

interface BotAnalysis {
  username: string;
  botInfo?: BotInfo;
  webhookInfo?: any;
  commands?: any[];
  description?: string;
  errors: string[];
}

/**
 * Анализ Telegram бота по username
 * Проверяет доступные публичные API методы
 */
class TelegramBotAnalyzer {
  private baseUrl = 'https://api.telegram.org';

  /**
   * Проверяет, существует ли бот с таким username
   */
  async checkBotExists(username: string): Promise<boolean> {
    try {
      // Попытка получить информацию о боте через публичные методы
      const response = await axios.get(`${this.baseUrl}/bot${username}/getMe`);
      return response.data.ok === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Анализирует бота по username
   */
  async analyzeBot(username: string): Promise<BotAnalysis> {
    const analysis: BotAnalysis = {
      username,
      errors: []
    };

    console.log(`🔍 Начинаем анализ бота @${username}\n`);

    try {
      // 1. Проверяем существование бота
      console.log('1️⃣ Проверка существования бота...');
      const exists = await this.checkBotExists(username);

      if (!exists) {
        analysis.errors.push('Бот не найден или токен недействителен');
        console.log('❌ Бот не найден');
        return analysis;
      }

      console.log('✅ Бот существует');

      // 2. Пытаемся получить информацию о боте
      console.log('\n2️⃣ Получение информации о боте...');
      try {
        const botInfoResponse = await axios.get(`${this.baseUrl}/bot${username}/getMe`);
        analysis.botInfo = botInfoResponse.data.result;
        console.log('✅ Информация получена:');
        console.log(`   - ID: ${analysis.botInfo!.id}`);
        console.log(`   - Имя: ${analysis.botInfo!.first_name}`);
        console.log(`   - Username: ${analysis.botInfo!.username}`);
        console.log(`   - Может присоединяться к группам: ${analysis.botInfo!.can_join_groups}`);
        console.log(`   - Поддержка inline: ${analysis.botInfo!.supports_inline_queries}`);
      } catch (error: any) {
        analysis.errors.push(`Не удалось получить информацию о боте: ${error.message}`);
        console.log('❌ Не удалось получить информацию о боте');
      }

      // 3. Проверяем webhook
      console.log('\n3️⃣ Проверка webhook...');
      try {
        const webhookResponse = await axios.get(`${this.baseUrl}/bot${username}/getWebhookInfo`);
        analysis.webhookInfo = webhookResponse.data.result;
        console.log('✅ Информация о webhook:');
        console.log(`   - URL: ${analysis.webhookInfo.url || 'не установлен'}`);
        console.log(`   - Pending updates: ${analysis.webhookInfo.pending_update_count}`);
        console.log(`   - Last error: ${analysis.webhookInfo.last_error_message || 'нет'}`);
      } catch (error: any) {
        analysis.errors.push(`Не удалось получить информацию о webhook: ${error.message}`);
        console.log('❌ Не удалось проверить webhook');
      }

      // 4. Проверяем команды бота
      console.log('\n4️⃣ Проверка команд бота...');
      try {
        const commandsResponse = await axios.get(`${this.baseUrl}/bot${username}/getMyCommands`);
        analysis.commands = commandsResponse.data.result;
        console.log('✅ Команды бота:');
        if (analysis.commands && analysis.commands.length > 0) {
          analysis.commands.forEach((cmd: any) => {
            console.log(`   - /${cmd.command}: ${cmd.description}`);
          });
        } else {
          console.log('   (команды не установлены)');
        }
      } catch (error: any) {
        analysis.errors.push(`Не удалось получить команды: ${error.message}`);
        console.log('❌ Не удалось получить команды');
      }

      // 5. Проверяем описание бота
      console.log('\n5️⃣ Проверка описания бота...');
      try {
        const descResponse = await axios.get(`${this.baseUrl}/bot${username}/getMyDescription`);
        if (descResponse.data.result?.description) {
          analysis.description = descResponse.data.result.description;
          console.log('✅ Описание бота:');
          console.log(`   "${analysis.description}"`);
        } else {
          console.log('   (описание не установлено)');
        }
      } catch (error: any) {
        console.log('❌ Не удалось получить описание');
      }

    } catch (error: any) {
      analysis.errors.push(`Общая ошибка анализа: ${error.message}`);
      console.log(`❌ Ошибка анализа: ${error.message}`);
    }

    console.log(`\n🎯 Анализ бота @${username} завершен!`);
    return analysis;
  }

  /**
   * Анализирует сетевой трафик (имитация)
   */
  async analyzeNetworkTraffic(botUsername: string): Promise<void> {
    console.log(`📡 Анализ сетевого трафика для @${botUsername}\n`);

    console.log('🔍 Для реального анализа трафика используйте:');
    console.log('');
    console.log('# 1. Wireshark для перехвата пакетов');
    console.log('sudo wireshark');
    console.log('');
    console.log('# 2. Фильтр по Telegram API');
    console.log('tcp port 443 and host api.telegram.org');
    console.log('');
    console.log('# 3. Поиск токена в трафике');
    console.log(`grep "${botUsername}" captured_traffic.pcap`);
    console.log('');
    console.log('# 4. Анализ webhook запросов');
    console.log('tcp port 443 and host *.railway.app');
    console.log('');
    console.log('⚠️  ВНИМАНИЕ: Анализ чужого трафика может быть незаконным!');
    console.log('    Используйте только для анализа своих систем.');
  }
}

// Основная функция
async function main() {
  const botUsername = process.argv[2] || 'Whyhive_bot';

  if (!botUsername.startsWith('@')) {
    console.log('❌ Укажите username бота с @, например: @Whyhive_bot');
    process.exit(1);
  }

  const cleanUsername = botUsername.replace('@', '');
  console.log(`🤖 Анализ Telegram бота @${cleanUsername}\n`);
  console.log('⚠️  ЭТО ИНСТРУМЕНТ ДЛЯ ОБРАЗОВАТЕЛЬНЫХ ЦЕЛЕЙ');
  console.log('⚠️  НЕ ИСПОЛЬЗУЙТЕ ДЛЯ ВЗЛОМА ЧУЖИХ БОТОВ\n');

  const analyzer = new TelegramBotAnalyzer();

  // Анализ через публичное API
  const analysis = await analyzer.analyzeBot(cleanUsername);

  // Анализ сетевого трафика (инструкции)
  await analyzer.analyzeNetworkTraffic(cleanUsername);

  // Вывод результатов
  console.log('\n📊 РЕЗУЛЬТАТЫ АНАЛИЗА:');
  console.log('='.repeat(50));

  if (analysis.botInfo) {
    console.log('✅ Бот найден!');
    console.log(`   ID: ${analysis.botInfo!.id}`);
    console.log(`   Username: @${analysis.botInfo!.username}`);
    console.log(`   Имя: ${analysis.botInfo!.first_name}`);
  } else {
    console.log('❌ Бот не найден или недоступен');
  }

  if (analysis.webhookInfo?.url) {
    console.log(`🔗 Webhook URL: ${analysis.webhookInfo.url}`);
  }

  if (analysis.commands && analysis.commands.length > 0) {
    console.log(`📝 Команды: ${analysis.commands.length}`);
  }

  if (analysis.errors.length > 0) {
    console.log('\n❌ Ошибки:');
    analysis.errors.forEach(error => console.log(`   - ${error}`));
  }

  console.log('\n🎯 Для полного анализа трафика запустите:');
  console.log(`sudo tcpdump -i eth0 -w ${cleanUsername}_traffic.pcap host api.telegram.org`);
}

main();