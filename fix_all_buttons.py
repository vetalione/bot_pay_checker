#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Read the file
with open('src/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the first button with broken emoji
import re

# Pattern to find any single "Оплатить доступ" button (with any text before it)
pattern1 = r"inline_keyboard: \[\s*\[\{ text: '[^']*Оплатить доступ', callback_data: 'pay' \}\]\s*\]"

replacement1 = """inline_keyboard: [
          [{ text: '💵 Оплатить рублями (2000 ₽)', callback_data: 'pay_rub' }],
          [{ text: '💴 Оплатить гривнами (1050 ₴)', callback_data: 'pay_uah' }]
        ]"""

content = re.sub(pattern1, replacement1, content)

# Also replace the action handler if it still uses 'pay'
content = re.sub(r"bot\.action\('pay',", "bot.action('pay_rub',", content)

# Write back
with open('src/index.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ All payment buttons updated to dual currency!")
