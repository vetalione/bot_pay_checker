#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Read the file
with open('src/receiptValidator.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update validateAnalysis function signature
old_validate_sig = """function validateAnalysis(
  analysis: any,
  expectedAmount: number,
  expectedCardNumber: string
): ReceiptValidationResult {"""

new_validate_sig = """function validateAnalysis(
  analysis: any,
  expectedAmount: number,
  expectedCardNumber: string,
  currency: 'RUB' | 'UAH'
): ReceiptValidationResult {"""

content = content.replace(old_validate_sig, new_validate_sig)

# 2. Update the call to validateAnalysis - need to find where it's called
old_call = "return validateAnalysis(analysis, expectedAmount, expectedCardNumber);"
new_call = "return validateAnalysis(analysis, expectedAmount, expectedCardNumber, currency);"

content = content.replace(old_call, new_call)

# Write back
with open('src/receiptValidator.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Currency parameter added to validateAnalysis function!")
