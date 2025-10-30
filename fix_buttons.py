#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Read the file
with open('src/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all instances of single "Оплатить доступ" button with two currency buttons
old_button_1 = """      reply_markup: {
        inline_keyboard: [
          [{ text: '💰 Оплатить доступ', callback_data: 'pay' }]
        ]
      }"""

new_buttons_1 = """      reply_markup: {
        inline_keyboard: [
          [{ text: '💵 Оплатить рублями (2000 ₽)', callback_data: 'pay_rub' }],
          [{ text: '💴 Оплатить гривнами (1050 ₴)', callback_data: 'pay_uah' }]
        ]
      }"""

old_button_2 = """      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Оплатить доступ', callback_data: 'pay' }]
        ]
      }"""

new_buttons_2 = """      reply_markup: {
        inline_keyboard: [
          [{ text: '💵 Оплатить рублями (2000 ₽)', callback_data: 'pay_rub' }],
          [{ text: '💴 Оплатить гривнами (1050 ₴)', callback_data: 'pay_uah' }]
        ]
      }"""

# Replace both occurrences
content = content.replace(old_button_1, new_buttons_1)
content = content.replace(old_button_2, new_buttons_2)

# Also need to change the action handler from 'pay' to 'pay_rub'
content = content.replace("bot.action('pay',", "bot.action('pay_rub',")
content = content.replace("// Обработка кнопки оплаты", "// Обработка нажатия кнопки \"Оплатить рублями\"")

# Write back
with open('src/index.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Buttons updated to show both RUB and UAH options!")
