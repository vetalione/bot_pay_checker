require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

console.log(`
===========================================
ИНСТРУКЦИЯ ПО ПОЛУЧЕНИЮ ID КАНАЛА:
===========================================

1. Перешлите ЛЮБОЕ сообщение из вашего канала в этого бота: @Reels_sale_bot
2. Или добавьте бота в канал как администратора
3. ID канала появится в консоли

Ожидаю сообщений...
===========================================
`);

bot.on('channel_post', (ctx) => {
  console.log('\n✅ ПОЛУЧЕНО СООБЩЕНИЕ ИЗ КАНАЛА!');
  console.log('Chat ID:', ctx.chat.id);
  console.log('Chat Title:', ctx.chat.title);
  console.log('Chat Type:', ctx.chat.type);
  console.log('Chat Username:', ctx.chat.username);
  console.log('\n=== ИСПОЛЬЗУЙТЕ ЭТОТ ID В .env ===');
  console.log(`CHANNEL_ID=${ctx.chat.id}`);
  console.log('=====================================\n');
});

bot.on('my_chat_member', (ctx) => {
  console.log('\n✅ БОТ ДОБАВЛЕН/ИЗМЕНЕН В ЧАТЕ!');
  console.log('Chat ID:', ctx.chat.id);
  console.log('Chat Title:', ctx.chat.title);
  console.log('Chat Type:', ctx.chat.type);
  console.log('Chat Username:', ctx.chat.username);
  console.log('New Status:', ctx.myChatMember.new_chat_member.status);
  console.log('\n=== ИСПОЛЬЗУЙТЕ ЭТОТ ID В .env ===');
  console.log(`CHANNEL_ID=${ctx.chat.id}`);
  console.log('=====================================\n');
});

bot.on('message', (ctx) => {
  if (ctx.message.forward_from_chat) {
    console.log('\n✅ ПЕРЕСЛАНО ИЗ КАНАЛА!');
    console.log('Channel ID:', ctx.message.forward_from_chat.id);
    console.log('Channel Title:', ctx.message.forward_from_chat.title);
    console.log('Channel Type:', ctx.message.forward_from_chat.type);
    console.log('Channel Username:', ctx.message.forward_from_chat.username);
    console.log('\n=== ИСПОЛЬЗУЙТЕ ЭТОТ ID В .env ===');
    console.log(`CHANNEL_ID=${ctx.message.forward_from_chat.id}`);
    console.log('=====================================\n');
  } else {
    console.log('Chat ID:', ctx.chat.id, 'Type:', ctx.chat.type);
  }
});

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
