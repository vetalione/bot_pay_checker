#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Read the file
with open('src/receiptValidator.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update function signature to include currency parameter
old_signature = """export async function validateReceiptWithGemini(
  photoUrl: string,
  expectedAmount: number,
  expectedCardNumber: string
): Promise<ReceiptValidationResult> {"""

new_signature = """export async function validateReceiptWithGemini(
  photoUrl: string,
  expectedAmount: number,
  expectedCardNumber: string,
  currency: 'RUB' | 'UAH' = 'RUB'
): Promise<ReceiptValidationResult> {"""

content = content.replace(old_signature, new_signature)

# 2. Update error messages to use correct currency symbol
# Amount mismatch error
old_amount_error = """reason: `❌ Неверная сумма платежа.\\n\\n💰 Ожидается: ${expectedAmount} руб\\n💳 Найдено на квитанции: ${extractedAmount} руб`,"""

new_amount_error = """reason: `❌ Неверная сумма платежа.\\n\\n💰 Ожидается: ${expectedAmount} ${currency === 'UAH' ? '₴' : '₽'}\\n💳 Найдено на квитанции: ${extractedAmount} ${currency === 'UAH' ? '₴' : '₽'}`,"""

content = content.replace(old_amount_error, new_amount_error)

# 3. Find and update card number error message
old_card_error = """reason: `❌ Неверный номер карты получателя.\\n\\n🏦 Ожидается карта: ...${expectedLast4}\\n💳 Найдено на квитанции: ...${extractedCardLast4}`,"""

if old_card_error in content:
    # If exists, no change needed (no currency here)
    pass

# Write back
with open('src/receiptValidator.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Currency parameter added to validateReceiptWithGemini!")
print("✅ Error messages updated to show correct currency symbol!")
