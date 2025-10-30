#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re

# Read the file
with open('src/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the closing of the payment reply and add button after it
old_text = """    { parse_mode: 'Markdown' }
  );
});"""

new_text = """    { parse_mode: 'Markdown' }
  );

  // Добавляем кнопку для связи с ассистентом
  await ctx.reply(
    '💬 Если у вас возникли вопросы или трудности с оплатой:',
    Markup.inlineKeyboard([
      [Markup.button.url('📨 Связаться с ассистентом', 'https://t.me/ADA_gii')]
    ])
  );
});"""

# Replace
content = content.replace(old_text, new_text)

# Write back
with open('src/index.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Button code added successfully!")
