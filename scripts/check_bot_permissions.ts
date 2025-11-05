/**
 * 🔍 Диагностика прав бота в канале и чате
 * 
 * Проверяет:
 * 1. Есть ли бот в канале
 * 2. Является ли бот администратором
 * 3. Какие права у бота
 * 4. Может ли бот создавать invite ссылки
 */

import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не найден в .env файле!');
  process.exit(1);
}

if (!CHANNEL_ID) {
  console.error('❌ CHANNEL_ID не найден в .env файле!');
  process.exit(1);
}

if (!CHAT_ID) {
  console.error('❌ CHAT_ID не найден в .env файле!');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

async function checkBotPermissions() {
  try {
    console.log('🔍 Диагностика прав бота...\n');
    console.log('=' .repeat(60));
    
    // Получаем информацию о боте
    const botInfo = await bot.telegram.getMe();
    console.log(`🤖 Бот: @${botInfo.username} (ID: ${botInfo.id})\n`);
    
    // Проверка КАНАЛА
    console.log('📺 ПРОВЕРКА КАНАЛА');
    console.log('=' .repeat(60));
    console.log(`Channel ID: ${CHANNEL_ID}\n`);
    
    try {
      // Получаем информацию о канале
      const channelInfo = await bot.telegram.getChat(CHANNEL_ID);
      console.log(`✅ Канал найден: ${channelInfo.title || 'Без названия'}`);
      console.log(`   Тип: ${channelInfo.type}`);
      
      // Проверяем статус бота в канале
      const channelMember = await bot.telegram.getChatMember(CHANNEL_ID, botInfo.id);
      console.log(`\n👤 Статус бота в канале: ${channelMember.status}`);
      
      if (channelMember.status === 'administrator') {
        const admin = channelMember as any;
        console.log('\n🔑 Права администратора:');
        console.log(`   - Может создавать invite ссылки: ${admin.can_invite_users ? '✅' : '❌'}`);
        console.log(`   - Может управлять чатом: ${admin.can_manage_chat ? '✅' : '❌'}`);
        console.log(`   - Может постить сообщения: ${admin.can_post_messages !== undefined ? (admin.can_post_messages ? '✅' : '❌') : 'N/A'}`);
        console.log(`   - Может редактировать сообщения: ${admin.can_edit_messages !== undefined ? (admin.can_edit_messages ? '✅' : '❌') : 'N/A'}`);
        console.log(`   - Может удалять сообщения: ${admin.can_delete_messages ? '✅' : '❌'}`);
        
        // Пробуем создать тестовую invite ссылку
        console.log('\n🔗 Тестирование создания invite ссылки...');
        try {
          const testInvite = await bot.telegram.createChatInviteLink(CHANNEL_ID, {
            member_limit: 1,
            expire_date: Math.floor(Date.now() / 1000) + 3600 // 1 час
          });
          console.log(`✅ Успешно создана тестовая ссылка: ${testInvite.invite_link}`);
          
          // Отзываем тестовую ссылку
          await bot.telegram.revokeChatInviteLink(CHANNEL_ID, testInvite.invite_link);
          console.log('✅ Тестовая ссылка успешно отозвана');
          
        } catch (inviteError: any) {
          console.error(`❌ Ошибка создания invite ссылки: ${inviteError.message}`);
        }
        
      } else if (channelMember.status === 'creator') {
        console.log('✅ Бот является создателем канала (все права)');
      } else {
        console.log(`❌ Бот не является администратором! Статус: ${channelMember.status}`);
        console.log('   Добавьте бота как администратора с правом создания invite ссылок');
      }
      
    } catch (channelError: any) {
      console.error(`❌ Ошибка доступа к каналу: ${channelError.message}`);
      console.log('\n💡 Возможные причины:');
      console.log('   1. Неверный CHANNEL_ID');
      console.log('   2. Бот не добавлен в канал');
      console.log('   3. Канал не существует');
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Проверка ЧАТА
    console.log('💬 ПРОВЕРКА ЧАТА');
    console.log('=' .repeat(60));
    console.log(`Chat ID: ${CHAT_ID}\n`);
    
    try {
      // Получаем информацию о чате
      const chatInfo = await bot.telegram.getChat(CHAT_ID);
      console.log(`✅ Чат найден: ${chatInfo.title || 'Без названия'}`);
      console.log(`   Тип: ${chatInfo.type}`);
      
      // Проверяем статус бота в чате
      const chatMember = await bot.telegram.getChatMember(CHAT_ID, botInfo.id);
      console.log(`\n👤 Статус бота в чате: ${chatMember.status}`);
      
      if (chatMember.status === 'administrator') {
        const admin = chatMember as any;
        console.log('\n🔑 Права администратора:');
        console.log(`   - Может создавать invite ссылки: ${admin.can_invite_users ? '✅' : '❌'}`);
        console.log(`   - Может управлять чатом: ${admin.can_manage_chat ? '✅' : '❌'}`);
        console.log(`   - Может удалять сообщения: ${admin.can_delete_messages ? '✅' : '❌'}`);
        console.log(`   - Может банить пользователей: ${admin.can_restrict_members ? '✅' : '❌'}`);
        
        // Пробуем создать тестовую invite ссылку
        console.log('\n🔗 Тестирование создания invite ссылки...');
        try {
          const testInvite = await bot.telegram.createChatInviteLink(CHAT_ID, {
            member_limit: 1,
            expire_date: Math.floor(Date.now() / 1000) + 3600 // 1 час
          });
          console.log(`✅ Успешно создана тестовая ссылка: ${testInvite.invite_link}`);
          
          // Отзываем тестовую ссылку
          await bot.telegram.revokeChatInviteLink(CHAT_ID, testInvite.invite_link);
          console.log('✅ Тестовая ссылка успешно отозвана');
          
        } catch (inviteError: any) {
          console.error(`❌ Ошибка создания invite ссылки: ${inviteError.message}`);
        }
        
      } else if (chatMember.status === 'creator') {
        console.log('✅ Бот является создателем чата (все права)');
      } else {
        console.log(`❌ Бот не является администратором! Статус: ${chatMember.status}`);
        console.log('   Добавьте бота как администратора с правом создания invite ссылок');
      }
      
    } catch (chatError: any) {
      console.error(`❌ Ошибка доступа к чату: ${chatError.message}`);
      console.log('\n💡 Возможные причины:');
      console.log('   1. Неверный CHAT_ID');
      console.log('   2. Бот не добавлен в чат');
      console.log('   3. Чат не существует');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Диагностика завершена!\n');
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  }
}

checkBotPermissions();
