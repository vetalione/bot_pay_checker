import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN!);

console.log(`
════════════════════════════════════════════════════════════
📹 ИНСТРУКЦИЯ ПО ПОЛУЧЕНИЮ FILE_ID ДЛЯ ВИДЕО
════════════════════════════════════════════════════════════

1. Запустите этот скрипт: npm run get-file-id
2. Откройте Telegram и найдите бота @Reels_sale_bot
3. Отправьте боту ваши 3 видео:
   - video 1.MOV
   - video 2.MOV
   - video 3.MOV
4. Бот покажет file_id для каждого видео
5. Скопируйте file_id в .env файл

════════════════════════════════════════════════════════════
⏳ Ожидаю видео...
════════════════════════════════════════════════════════════
`);

let videoCount = 0;

bot.on('video', (ctx) => {
  videoCount++;
  const video = ctx.message.video;
  
  console.log(`\n✅ ВИДЕО #${videoCount} ПОЛУЧЕНО!`);
  console.log('══════════════════════════════════════════════');
  console.log(`📊 Размер: ${(video.file_size! / 1024 / 1024).toFixed(2)} МБ`);
  console.log(`⏱️  Длительность: ${video.duration} сек`);
  console.log(`📐 Разрешение: ${video.width}x${video.height}`);
  console.log(`\n🆔 FILE_ID:`);
  console.log(`${video.file_id}`);
  console.log('\n📝 Добавьте в .env:');
  console.log(`VIDEO_${videoCount}_FILE_ID=${video.file_id}`);
  console.log('══════════════════════════════════════════════\n');
  
  ctx.reply(`✅ Видео #${videoCount} получено! File ID сохранен в консоли.`);
});

bot.on('document', (ctx) => {
  videoCount++;
  const doc = ctx.message.document;
  
  console.log(`\n✅ ДОКУМЕНТ #${videoCount} ПОЛУЧЕН!`);
  console.log('══════════════════════════════════════════════');
  console.log(`📊 Размер: ${(doc.file_size! / 1024 / 1024).toFixed(2)} МБ`);
  console.log(`📄 Имя файла: ${doc.file_name}`);
  console.log(`\n🆔 FILE_ID:`);
  console.log(`${doc.file_id}`);
  console.log('\n📝 Добавьте в .env:');
  console.log(`VIDEO_${videoCount}_FILE_ID=${doc.file_id}`);
  console.log('══════════════════════════════════════════════\n');
  
  ctx.reply(`✅ Документ #${videoCount} получен! File ID сохранен в консоли.`);
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
