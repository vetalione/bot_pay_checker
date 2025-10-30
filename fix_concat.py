#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Read the file
with open('src/receiptValidator.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the concatenation properly
old_error = """      reason: `❌ Неверная сумма платежа.\\n\\n💰 Ожидается: ` + expectedAmount + ` ${currency === 'UAH' ? '₴' : '₽'}\\n💳 Найдено на квитанции: ` + extractedAmount + ` ${currency === 'UAH' ? '₴' : '₽'}`,"""

new_error = """      reason: `❌ Неверная сумма платежа.\\n\\n💰 Ожидается: ${expectedAmount} ` + (currency === 'UAH' ? '₴' : '₽') + `\\n💳 Найдено на квитанции: ${extractedAmount} ` + (currency === 'UAH' ? '₴' : '₽'),"""

content = content.replace(old_error, new_error)

# Write back
with open('src/receiptValidator.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Fixed currency concatenation!")
