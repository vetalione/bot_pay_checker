#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Read the file
with open('src/receiptValidator.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and replace lines 257-261
new_lines = []
for i, line in enumerate(lines, 1):
    if i == 260:
        # Replace this line with correct template literal
        new_lines.append('      reason: `❌ Неверная сумма платежа.\\n\\n💰 Ожидается: ${expectedAmount} ${currency === \\'UAH\\' ? \\'₴\\' : \\'₽\\'}\\n💳 Найдено на квитанции: ${extractedAmount} ${currency === \\'UAH\\' ? \\'₴\\' : \\'₽\\'}`,\n')
    elif i == 261:
        # Skip this line as it's part of the old multi-line
        continue
    else:
        new_lines.append(line)

# Write back
with open('src/receiptValidator.ts', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("✅ Error message fixed with proper template literal!")
