const { Telegraf } = require('telegraf');
require('dotenv').config();
const bot = new Telegraf(process.env.BOT_TOKEN);
bot.telegram.sendPhoto(278263484, { source: './снимите это немедленно/banner_4.png' }, { caption: 'Banner 4' })
  .then(r => console.log('Banner 4 file_id:', r.photo[r.photo.length-1].file_id))
  .catch(console.error);
