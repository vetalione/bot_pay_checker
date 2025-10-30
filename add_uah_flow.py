#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re

# Read the file
with open('src/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update config to include UAH payment details
config_old = """const config = {
  botToken: process.env.BOT_TOKEN || '',
  channelId: parseInt(process.env.CHANNEL_ID || '0'),
  chatId: parseInt(process.env.CHAT_ID || '0'),
  paymentAmount: parseInt(process.env.PAYMENT_AMOUNT || '2000'),
  cardNumber: process.env.CARD_NUMBER || '',"""

config_new = """const config = {
  botToken: process.env.BOT_TOKEN || '',
  channelId: parseInt(process.env.CHANNEL_ID || '0'),
  chatId: parseInt(process.env.CHAT_ID || '0'),
  paymentAmount: parseInt(process.env.PAYMENT_AMOUNT || '2000'),
  cardNumber: process.env.CARD_NUMBER || '',
  paymentAmountUAH: parseInt(process.env.PAYMENT_AMOUNT_UAH || '1050'),
  cardNumberUAH: process.env.CARD_NUMBER_UAH || '5169155124283993',"""

content = content.replace(config_old, config_new)

# 2. Update UserState type to include currency
state_type_old = """type UserState = {
  step: 'start' | 'waiting_receipt' | 'completed';
  videosSent?: boolean;
};"""

state_type_new = """type UserState = {
  step: 'start' | 'waiting_receipt' | 'completed';
  videosSent?: boolean;
  currency?: 'RUB' | 'UAH';
};"""

content = content.replace(state_type_old, state_type_new)

# 3. Replace single "Оплатить доступ" button with two currency buttons
old_button = """  await ctx.reply(
    welcomeMessage,
    Markup.keyboard([
      [Markup.button.callback('💰 Оплатить доступ', 'pay_access')],
    ]).resize()
  );"""

new_buttons = """  await ctx.reply(
    welcomeMessage,
    Markup.keyboard([
      [Markup.button.callback('💵 Оплатить рублями (2000 ₽)', 'pay_rub')],
      [Markup.button.callback('💴 Оплатить гривнами (1050 ₴)', 'pay_uah')],
    ]).resize()
  );"""

content = content.replace(old_button, new_buttons)

# 4. Replace the pay_access action with two separate actions
old_action = """// Обработка нажатия кнопки "Оплатить доступ"
bot.action('pay_access', async (ctx) => {"""

new_action = """// Обработка нажатия кнопки "Оплатить рублями"
bot.action('pay_rub', async (ctx) => {"""

content = content.replace(old_action, new_action)

# 5. Add currency to state for RUB
old_state_rub = """  state.step = 'waiting_receipt';
  userStates.set(userId, state);

  // Форматируем номер карты для отображения
  const formattedCard = config.cardNumber.replace(/(\d{4})(?=\d)/g, '$1 ');"""

new_state_rub = """  state.step = 'waiting_receipt';
  state.currency = 'RUB';
  userStates.set(userId, state);

  // Форматируем номер карты для отображения
  const formattedCard = config.cardNumber.replace(/(\d{4})(?=\d)/g, '$1 ');"""

content = content.replace(old_state_rub, new_state_rub)

# 6. Add new UAH payment action after RUB action
uah_action = """
// Обработка нажатия кнопки "Оплатить гривнами"
bot.action('pay_uah', async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId) || { step: 'start' };

  await ctx.answerCbQuery();

  state.step = 'waiting_receipt';
  state.currency = 'UAH';
  userStates.set(userId, state);

  // Форматируем номер карты для отображения
  const formattedCard = config.cardNumberUAH.replace(/(\d{4})(?=\d)/g, '$1 ');

  await ctx.reply(
    '💳 **Реквизиты для оплаты:**\\n\\n' +
    `💰 Сумма: **${config.paymentAmountUAH} ₴**\\n` +
    `🏦 Карта: \\`${formattedCard}\\`\\n` +
    '👤 Получатель: **Микитась Юлія Олександрівна**\\n\\n' +
    '📋 **Инструкция:**\\n' +
    '1. Переведите указанную сумму на карту\\n' +
    '2. Сделайте скриншот или сохраните платежную квитанцию\\n' +
    '3. Отправьте квитанцию в этот чат\\n\\n' +
    '⚠️ **Важно:** На квитанции должна быть видна сумма перевода и номер карты получателя!\\n\\n' +
    '👇 После оплаты отправьте квитанцию сюда',
    { parse_mode: 'Markdown' }
  );

  // Добавляем кнопку для связи с ассистентом
  await ctx.reply(
    '💬 Если у вас возникли вопросы или трудности с оплатой:',
    Markup.inlineKeyboard([
      [Markup.button.url('📨 Связаться с ассистентом', 'https://t.me/ADA_gii')]
    ])
  );
});
"""

# Insert UAH action after the closing of RUB action (after the first "});")
# Find the position after the assistant button in pay_rub
pattern = r"(\[Markup\.button\.url\('📨 Связаться с ассистентом', 'https://t\.me/ADA_gii'\)\]\s*\]\s*\)\s*\);\s*}\);\s*\n)"
content = re.sub(pattern, r'\1' + uah_action + '\n', content, count=1)

# Write back
with open('src/index.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ UAH payment flow added successfully!")
print("📝 Don't forget to update .env file with:")
print("   PAYMENT_AMOUNT_UAH=1050")
print("   CARD_NUMBER_UAH=5169155124283993")
