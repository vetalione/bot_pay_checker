#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re

# Read the file
with open('src/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update config to include UAH payment details
config_pattern = r"(const config = \{[^}]+cardNumber: process\.env\.CARD_NUMBER \|\| '',)"
config_replacement = r"\1\n  paymentAmountUAH: parseInt(process.env.PAYMENT_AMOUNT_UAH || '1050'),\n  cardNumberUAH: process.env.CARD_NUMBER_UAH || '5169155124283993',"

content = re.sub(config_pattern, config_replacement, content)

# 2. Update UserState type to include currency
state_type_pattern = r"(type UserState = \{[^}]+videosSent\?: boolean;)"
state_type_replacement = r"\1\n  currency?: 'RUB' | 'UAH';"

content = re.sub(state_type_pattern, state_type_replacement, content)

# 3. Replace single button with two currency buttons
old_button_text = "Markup.button.callback('💰 Оплатить доступ', 'pay_access')"
new_buttons_text = """Markup.button.callback('💵 Оплатить рублями (2000 ₽)', 'pay_rub')],
      [Markup.button.callback('💴 Оплатить гривнами (1050 ₴)', 'pay_uah')"""

content = content.replace(old_button_text, new_buttons_text)

# 4. Replace pay_access with pay_rub
content = content.replace("bot.action('pay_access'", "bot.action('pay_rub'")
content = content.replace("// Обработка нажатия кнопки \"Оплатить доступ\"", "// Обработка нажатия кнопки \"Оплатить рублями\"")

# 5. Add currency to RUB state
old_rub_state = "  state.step = 'waiting_receipt';\n  userStates.set(userId, state);"
new_rub_state = "  state.step = 'waiting_receipt';\n  state.currency = 'RUB';\n  userStates.set(userId, state);"

content = content.replace(old_rub_state, new_rub_state)

# 6. Add UAH payment action - find where to insert it
# Insert after the pay_rub action closes (after its closing });)
insertion_marker = "  await ctx.reply(\n    '💬 Если у вас возникли вопросы или трудности с оплатой:',\n    Markup.inlineKeyboard([\n      [Markup.button.url('📨 Связаться с ассистентом', 'https://t.me/ADA_gii')]\n    ])\n  );\n});"

uah_action = '''

// Обработка нажатия кнопки "Оплатить гривнами"
bot.action('pay_uah', async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId) || { step: 'start' };

  await ctx.answerCbQuery();

  state.step = 'waiting_receipt';
  state.currency = 'UAH';
  userStates.set(userId, state);

  // Форматируем номер карты для отображения
  const formattedCard = config.cardNumberUAH.replace(/(\\d{4})(?=\\d)/g, '$1 ');

  await ctx.reply(
    '💳 **Реквизиты для оплаты:**\\\\n\\\\n' +
    `💰 Сумма: **${config.paymentAmountUAH} ₴**\\\\n` +
    `🏦 Карта: \\\\`${formattedCard}\\\\`\\\\n` +
    '👤 Получатель: **Микитась Юлія Олександрівна**\\\\n\\\\n' +
    '📋 **Инструкция:**\\\\n' +
    '1. Переведите указанную сумму на карту\\\\n' +
    '2. Сделайте скриншот или сохраните платежную квитанцию\\\\n' +
    '3. Отправьте квитанцию в этот чат\\\\n\\\\n' +
    '⚠️ **Важно:** На квитанции должна быть видна сумма перевода и номер карты получателя!\\\\n\\\\n' +
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
});'''

content = content.replace(insertion_marker, insertion_marker + uah_action)

# Write back
with open('src/index.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ UAH payment flow added successfully!")
print("📝 Now updating .env file...")

# Update .env file
try:
    with open('.env', 'r', encoding='utf-8') as f:
        env_content = f.read()
    
    if 'PAYMENT_AMOUNT_UAH' not in env_content:
        env_content += '\n# UAH Payment Settings\n'
        env_content += 'PAYMENT_AMOUNT_UAH=1050\n'
        env_content += 'CARD_NUMBER_UAH=5169155124283993\n'
        
        with open('.env', 'w', encoding='utf-8') as f:
            f.write(env_content)
        print("✅ .env file updated with UAH settings!")
    else:
        print("ℹ️  UAH settings already in .env file")
except Exception as e:
    print(f"⚠️  Could not update .env: {e}")
    print("   Please add manually:")
    print("   PAYMENT_AMOUNT_UAH=1050")
    print("   CARD_NUMBER_UAH=5169155124283993")
