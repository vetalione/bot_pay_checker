#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Read the file
with open('src/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update UserState interface to include currency
old_interface = """interface UserState {
  step: 'start' | 'video1' | 'video2' | 'video3' | 'payment_info' | 'waiting_receipt';
  userId: number;
  username?: string;
}"""

new_interface = """interface UserState {
  step: 'start' | 'video1' | 'video2' | 'video3' | 'payment_info' | 'waiting_receipt';
  userId: number;
  username?: string;
  currency?: 'RUB' | 'UAH';
}"""

content = content.replace(old_interface, new_interface)

# 2. Update config to include UAH settings
old_config = """  paymentAmount: parseInt(process.env.PAYMENT_AMOUNT || '2000'),
  cardNumber: process.env.CARD_NUMBER!,"""

new_config = """  paymentAmount: parseInt(process.env.PAYMENT_AMOUNT || '2000'),
  cardNumber: process.env.CARD_NUMBER!,
  paymentAmountUAH: parseInt(process.env.PAYMENT_AMOUNT_UAH || '1050'),
  cardNumberUAH: process.env.CARD_NUMBER_UAH || '5169155124283993',"""

content = content.replace(old_config, new_config)

# Write back
with open('src/index.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ UserState and config updated!")
