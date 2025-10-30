#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Read the file
with open('src/receiptValidator.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Use raw string for replacement
import re

# Find the problematic line and replace it
pattern = r"reason: `❌ Неверная сумма платежа[^`]+`[^,]*,"

replacement = r"""reason: `❌ Неверная сумма платежа.\n\n💰 Ожидается: ${expectedAmount} ${currency === 'UAH' ? '₴' : '₽'}\n💳 Найдено на квитанции: ${extractedAmount} ${currency === 'UAH' ? '₴' : '₽'}`,"""

content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Write back
with open('src/receiptValidator.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Error message fixed!")
