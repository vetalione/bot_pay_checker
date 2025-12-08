import * as dotenv from 'dotenv';
dotenv.config();

import { Telegraf } from 'telegraf';

const bot = new Telegraf(process.env.BOT_TOKEN!);
const ADMIN_ID = 278263484;

async function getFileIds() {
  const banners = [
    './снимите это немедленно/banner_1.png',
    './снимите это немедленно/banner_2.png',
    './снимите это немедленно/banner_3.jpg',
    './снимите это немедленно/banner_4.png'
  ];
  
  console.log('Отправляю баннеры админу для получения file_id...\n');
  
  for (let i = 0; i < banners.length; i++) {
    console.log(`Отправляю баннер ${i + 1}...`);
    const result = await bot.telegram.sendPhoto(
      ADMIN_ID,
      { source: banners[i] },
      { caption: `Баннер ${i + 1}` }
    );
    
    // Получаем file_id из самого большого размера
    const photo = result.photo[result.photo.length - 1];
    console.log(`Banner ${i + 1} file_id: ${photo.file_id}\n`);
  }
  
  console.log('✅ Готово! Скопируйте file_id выше.');
}

getFileIds();
