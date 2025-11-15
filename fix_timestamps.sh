#!/bin/bash
# Добавляем timestamp после каждого флага напоминания

sed -i '' 's/user\.reminderLevel3Start = true;/user.reminderLevel3Start = true;\n      user.reminderLevel3StartSentAt = new Date();/' src/reminderService.ts
sed -i '' 's/user\.reminderLevel1Video1 = true;/user.reminderLevel1Video1 = true;\n      user.reminderLevel1Video1SentAt = new Date();/' src/reminderService.ts  
sed -i '' 's/user\.reminderLevel2Video1 = true;/user.reminderLevel2Video1 = true;\n      user.reminderLevel2Video1SentAt = new Date();/' src/reminderService.ts
sed -i '' 's/user\.reminderLevel3Video1 = true;/user.reminderLevel3Video1 = true;\n      user.reminderLevel3Video1SentAt = new Date();/' src/reminderService.ts
sed -i '' 's/user\.reminderLevel1Video2 = true;/user.reminderLevel1Video2 = true;\n      user.reminderLevel1Video2SentAt = new Date();/' src/reminderService.ts
sed -i '' 's/user\.reminderLevel2Video2 = true;/user.reminderLevel2Video2 = true;\n      user.reminderLevel2Video2SentAt = new Date();/' src/reminderService.ts
sed -i '' 's/user\.reminderLevel3Video2 = true;/user.reminderLevel3Video2 = true;\n      user.reminderLevel3Video2SentAt = new Date();/' src/reminderService.ts

echo "✅ Timestamps added!"
