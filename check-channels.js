require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

async function checkChannelAccess() {
  try {
    console.log('Checking bot info...');
    const botInfo = await bot.telegram.getMe();
    console.log('Bot:', botInfo);
    console.log('Bot ID:', botInfo.id);
    console.log('Bot Username:', botInfo.username);
    
    console.log('\n=== Trying Channel ID from .env ===');
    const channelId = process.env.CHANNEL_ID;
    console.log('Channel ID:', channelId);
    
    try {
      const chat = await bot.telegram.getChat(channelId);
      console.log('✅ Chat found:', chat);
      console.log('Chat type:', chat.type);
      console.log('Chat title:', chat.title);
      console.log('Chat username:', chat.username);
      console.log('Chat ID:', chat.id);
      
      try {
        const member = await bot.telegram.getChatMember(channelId, botInfo.id);
        console.log('✅ Bot status in channel:', member.status);
        console.log('Bot permissions:', member);
      } catch (err) {
        console.log('❌ Error checking bot membership:', err.message);
      }
    } catch (err) {
      console.log('❌ Error getting chat:', err.message);
    }
    
    // Попробуем также с инвайт-ссылкой
    console.log('\n=== Trying to extract ID from invite link ===');
    const inviteLink = process.env.CHANNEL_INVITE_LINK;
    console.log('Invite link:', inviteLink);
    
    // Попробуем альтернативные форматы ID
    console.log('\n=== Trying alternative ID formats ===');
    const alternatives = [
      channelId,
      channelId.replace('-100', ''),
      '-' + channelId.replace('-', ''),
      '@' + (channelId.match(/@(.+)/) || ['', ''])[1]
    ];
    
    for (const altId of alternatives) {
      if (!altId || altId === '@') continue;
      console.log(`\nTrying ID: ${altId}`);
      try {
        const chat = await bot.telegram.getChat(altId);
        console.log('✅ Found chat:', chat.title, 'ID:', chat.id, 'Type:', chat.type);
      } catch (err) {
        console.log('❌', err.message);
      }
    }
    
    console.log('\n=== Trying to get updates (to see recent chats) ===');
    try {
      const updates = await bot.telegram.getUpdates({ limit: 10 });
      console.log('Recent updates count:', updates.length);
      updates.forEach((update, i) => {
        if (update.message?.chat) {
          console.log(`Update ${i}:`, {
            chatId: update.message.chat.id,
            chatType: update.message.chat.type,
            chatTitle: update.message.chat.title,
            chatUsername: update.message.chat.username
          });
        }
        if (update.my_chat_member) {
          console.log(`My chat member update ${i}:`, {
            chatId: update.my_chat_member.chat.id,
            chatType: update.my_chat_member.chat.type,
            chatTitle: update.my_chat_member.chat.title,
            newStatus: update.my_chat_member.new_chat_member.status
          });
        }
      });
    } catch (err) {
      console.log('Error getting updates:', err.message);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkChannelAccess();
