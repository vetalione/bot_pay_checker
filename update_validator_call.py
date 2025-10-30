#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Read the file
with open('src/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Update the validateReceiptWithGemini call to include currency parameter
old_call = """    // Проверяем квитанцию через Gemini
    const validationResult = await validateReceiptWithGemini(
      photoUrl,
      paymentAmount,
      cardNumber
    );"""

new_call = """    // Проверяем квитанцию через Gemini
    const validationResult = await validateReceiptWithGemini(
      photoUrl,
      paymentAmount,
      cardNumber,
      currency
    );"""

content = content.replace(old_call, new_call)

# Write back
with open('src/index.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Currency parameter added to validateReceiptWithGemini call!")
