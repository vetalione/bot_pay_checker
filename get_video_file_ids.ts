/**
 * Скрипт для получения Video File IDs
 * Отправляет видео как VIDEO (не как документ) и получает File ID
 */

import { Telegraf, Input } from 'telegraf';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN!);
const YOUR_USER_ID = 278263484; // Ваш Telegram ID

const videos = [
  { path: './video 1.MOV', name: 'Видео 1' },
  { path: './video 2.MOV', name: 'Видео 2' },
  { path: './video 3.MOV', name: 'Видео 3' }
];

async function getVideoFileIds() {
  console.log('🎬 Начинаю отправку видео для получения File IDs...\n');
  
  const fileIds: string[] = [];

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const videoPath = path.resolve(video.path);
    
    console.log(`📹 Отправляю ${video.name}...`);
    
    try {
      // Проверяем существует ли файл
      if (!fs.existsSync(videoPath)) {
        console.error(`❌ Файл не найден: ${videoPath}`);
        continue;
      }

      // Отправляем видео как VIDEO с оптимальными параметрами
      const message = await bot.telegram.sendVideo(YOUR_USER_ID, Input.fromLocalFile(videoPath), {
        caption: `📹 ${video.name} - File ID для .env`,
        supports_streaming: true,
        width: 1280,
        height: 720
      });

      // Получаем File ID
      const fileId = message.video?.file_id;
      
      if (fileId) {
        fileIds.push(fileId);
        console.log(`✅ ${video.name}: ${fileId}\n`);
      } else {
        console.error(`❌ Не удалось получить File ID для ${video.name}\n`);
      }

      // Пауза между отправками
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`❌ Ошибка при отправке ${video.name}:`, error);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✨ Скопируйте эти строки в ваш .env файл на Railway:');
  console.log('═══════════════════════════════════════════════════════\n');
  
  fileIds.forEach((id, index) => {
    console.log(`VIDEO_${index + 1}_FILE_ID=${id}`);
  });
  
  console.log('\n═══════════════════════════════════════════════════════\n');
  
  process.exit(0);
}

getVideoFileIds().catch(error => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});
