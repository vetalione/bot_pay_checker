#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Read the file
with open('src/receiptValidator.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Update the validateAnalysis call to include currency
old_call = """    const validationResult = validateAnalysis(
      analysis,
      expectedAmount,
      expectedCardNumber
    );"""

new_call = """    const validationResult = validateAnalysis(
      analysis,
      expectedAmount,
      expectedCardNumber,
      currency
    );"""

content = content.replace(old_call, new_call)

# Write back
with open('src/receiptValidator.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Currency parameter added to validateAnalysis call!")
