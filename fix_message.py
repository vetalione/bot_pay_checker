#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re

# Read the file
with open('src/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Define the new message
new_message = """  await ctx.reply(
    '💳 **Реквизиты для оплаты:**\\\\n\\\\n' +
    `💰 Сумма: **${config.paymentAmount} ₽**\\\\n` +
    `🏦 Карта: \\\\`${formattedCard}\\\\`\\\\n` +
    '👤 Получатель: **Vitalii Smirnov**\\\\n\\\\n' +
    '─────────────────────\\\\n\\\\n' +
    '📱 **Как оплатить:**\\\\n\\\\n' +
    '**Рекомендуем Т-банк или Сбербанк** — в них есть мгновенный перевод на иностранные карты.\\\\n\\\\n' +
    '**Инструкция:**\\\\n' +
    '1️⃣ Найдите раздел переводов (в Т-банке: "Перевод по номеру карты", в Сбербанке: "Иностранные переводы")\\\\n' +
    '2️⃣ Введите номер карты и сумму\\\\n' +
    '3️⃣ Укажите имя получателя\\\\n' +
    '4️⃣ Подтвердите перевод\\\\n\\\\n' +
    '💡 Другие банки: проверьте наличие функции "перевод на иностранную карту"\\\\n\\\\n' +
    '─────────────────────\\\\n\\\\n' +
    '📸 **После оплаты:**\\\\n\\\\n' +
    '✅ Сделайте скриншот квитанции\\\\n' +
    '✅ Отправьте скриншот в этот чат\\\\n\\\\n' +
    '⚠️ **На скриншоте должно быть видно:**\\\\n' +
    `• Сумму перевода (${config.paymentAmount} ₽)\\\\n` +
    '• Номер карты получателя\\\\n' +
    '• Имя получателя',
    { parse_mode: 'Markdown' }
  );"""

# Find and replace the old message block (from await ctx.reply to the closing );)
pattern = r"await ctx\.reply\(\s*'💳.*?parse_mode: 'Markdown' }\s*\);"
content = re.sub(pattern, new_message, content, flags=re.DOTALL)

# Write the file back
with open('src/index.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Message updated successfully!")
