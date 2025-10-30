#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Read the file
with open('src/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the UAH payment message with correct escaping
old_uah_message = """  await ctx.reply(
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
  );"""

new_uah_message = """  await ctx.reply(
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
  );"""

content = content.replace(old_uah_message, new_uah_message)

# Write back
with open('src/index.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ UAH message escaping fixed!")
