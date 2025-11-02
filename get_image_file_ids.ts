/**
 * Скрипт для получения Image File IDs
 */

import { Telegraf, Input } from 'telegraf';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN!);
const YOUR_USER_ID = 278263484;

const images = [
  { path: './image 1.jpeg', name: 'Image 1' },
  { path: './image 2.jpeg', name: 'Image 2' },
  { path: './image 3.jpeg', name: 'Image 3' },
  { path: './image 4.jpeg', name: 'Image 4' },
  { path: './image 5.jpeg', name: 'Image 5' },
  { path: './image 6.jpeg', name: 'Image 6' },
  { path: './image 7.jpeg', name: 'Image 7' }
];

async function getImageFileIds() {
  console.log('📸 Начинаю отправку изображений для получения File IDs...\n');
  
  const fileIds: string[] = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const imagePath = path.resolve(image.path);
    
    console.log(`📷 Отправляю ${image.name}...`);
    
    try {
      const message = await bot.telegram.sendPhoto(YOUR_USER_ID, Input.fromLocalFile(imagePath), {
        caption: `📷 ${image.name} - File ID для кода`
      });

      const fileId = message.photo[message.photo.length - 1].file_id;
      
      if (fileId) {
        fileIds.push(fileId);
        console.log(`✅ ${image.name}: ${fileId}\n`);
      }

      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`❌ Ошибка при отправке ${image.name}:`, error);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✨ Скопируйте эти File IDs в код:');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log('const imageFileIds = [');
  fileIds.forEach((id, index) => {
    console.log(`  '${id}',${index < fileIds.length - 1 ? '' : ' // ' + images[index].name}`);
  });
  console.log('];');
  
  console.log('\n═══════════════════════════════════════════════════════\n');
  
  process.exit(0);
}

getImageFileIds().catch(error => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});
