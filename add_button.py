#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re

# Read the file
with open('src/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the payment message to include the button
old_pattern = r"(const formattedCard = config\.cardNumber\.replace.*?\n\n)(  await ctx\.reply\(\n    '💳 \*\*Реквизиты для оплаты:\*\*.*?{ parse_mode: 'Markdown' }\s*\);)"

new_code = r"""\1\2

  // Добавляем кнопку для связи с ассистентом
  await ctx.reply(
    '💬 Если у вас возникли вопросы или трудности с оплатой:',
    Markup.inlineKeyboard([
      [Markup.button.url('📨 Связаться с ассистентом', 'https://t.me/ADA_gii')]
    ])
  );"""

content = re.sub(old_pattern, new_code, content, flags=re.DOTALL)

# Write back
with open('src/index.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Button added successfully!")
