#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Read the file
with open('src/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix UAH action state initialization
old_uah_state = """bot.action('pay_uah', async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId) || { step: 'start' };

  await ctx.answerCbQuery();

  state.step = 'waiting_receipt';
  state.currency = 'UAH';
  userStates.set(userId, state);"""

new_uah_state = """bot.action('pay_uah', async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username;
  const state: UserState = userStates.get(userId) || { 
    step: 'start',
    userId,
    username
  };

  await ctx.answerCbQuery();

  state.step = 'waiting_receipt';
  state.currency = 'UAH';
  userStates.set(userId, state);"""

content = content.replace(old_uah_state, new_uah_state)

# Also fix RUB action if needed - check if it has the same issue
# First, let's make sure pay_rub also properly initializes state
old_rub_init = "const state = userStates.get(userId) || { step: 'start' };"
new_rub_init = """const username = ctx.from.username;
  const state: UserState = userStates.get(userId) || { 
    step: 'start',
    userId,
    username
  };"""

# Only replace first occurrence (in pay_rub action)
parts = content.split(old_rub_init, 1)
if len(parts) == 2:
    content = parts[0] + new_rub_init + parts[1]

# Write back
with open('src/index.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ State initialization fixed for both RUB and UAH!")
