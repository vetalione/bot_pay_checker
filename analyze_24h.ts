
import * as dotenv from 'dotenv';
dotenv.config();

import { AppDataSource } from './src/database';
import { UserAction } from './src/entities/UserAction';
import { BroadcastHistory } from './src/entities/BroadcastHistory';
import { User } from './src/entities/User';

async function analyzeLast24Hours() {
    try {
        await AppDataSource.initialize();
        console.log("✅ Connected to Database");

        const now = new Date();
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        console.log(`\n📊 АНАЛИЗ ЗА ПОСЛЕДНИЕ 24 ЧАСА (с ${last24Hours.toLocaleString()} по ${now.toLocaleString()})\n`);

        // 1. Новые пользователи за 24 часа
        const newUsers = await AppDataSource.query(`
            SELECT COUNT(*) as count FROM users
            WHERE "createdAt" >= $1
        `, [last24Hours]);

        console.log(`👥 Новых пользователей: ${newUsers[0].count}`);

        // 2. Действия пользователей за 24 часа
        const actions24h = await AppDataSource.query(`
            SELECT action, COUNT(*) as count
            FROM user_actions
            WHERE timestamp >= $1
            GROUP BY action
            ORDER BY count DESC
        `, [last24Hours]);

        console.log(`\n📋 Действия пользователей за 24ч:`);
        actions24h.forEach((row: any) => {
            console.log(`  ${row.action}: ${row.count}`);
        });

        // 3. Распределение по этапам (текущие)
        const currentSteps = await AppDataSource.query(`
            SELECT "currentStep", COUNT(*) as count
            FROM users
            GROUP BY "currentStep"
            ORDER BY count DESC
        `);

        console.log(`\n📊 Текущее распределение пользователей по этапам:`);
        currentSteps.forEach((row: any) => {
            console.log(`  ${row.currentStep}: ${row.count}`);
        });

        // 4. Оплаты за 24 часа
        const payments24h = await AppDataSource.query(`
            SELECT COUNT(*) as count FROM users
            WHERE "hasPaid" = true AND "paidAt" >= $1
        `, [last24Hours]);

        console.log(`\n💰 Оплат за 24ч: ${payments24h[0].count}`);

        // 5. Заблокированные пользователи за 24 часа
        const blocked24h = await AppDataSource.query(`
            SELECT COUNT(*) as count FROM users
            WHERE "blockedBot" = true AND "blockedAt" >= $1
        `, [last24Hours]);

        console.log(`🚫 Заблокировали бота за 24ч: ${blocked24h[0].count}`);

        // 6. Напоминания отправленные за 24 часа
        const reminders24h = await AppDataSource.query(`
            SELECT
                COUNT(*) FILTER (WHERE "reminderLevel1StartSentAt" >= $1) as level1_start,
                COUNT(*) FILTER (WHERE "reminderLevel2StartSentAt" >= $1) as level2_start,
                COUNT(*) FILTER (WHERE "reminderLevel3StartSentAt" >= $1) as level3_start,
                COUNT(*) FILTER (WHERE "reminderLevel1Video1SentAt" >= $1) as level1_video1,
                COUNT(*) FILTER (WHERE "reminderLevel2Video1SentAt" >= $1) as level2_video1,
                COUNT(*) FILTER (WHERE "reminderLevel3Video1SentAt" >= $1) as level3_video1,
                COUNT(*) FILTER (WHERE "reminderLevel1Video2SentAt" >= $1) as level1_video2,
                COUNT(*) FILTER (WHERE "reminderLevel2Video2SentAt" >= $1) as level2_video2,
                COUNT(*) FILTER (WHERE "reminderLevel3Video2SentAt" >= $1) as level3_video2,
                COUNT(*) FILTER (WHERE "reminderLevel1Video3SentAt" >= $1) as level1_video3,
                COUNT(*) FILTER (WHERE "reminderLevel2Video3SentAt" >= $1) as level2_video3,
                COUNT(*) FILTER (WHERE "reminderLevel3Video3SentAt" >= $1) as level3_video3
            FROM users
        `, [last24Hours]);

        console.log(`\n🔔 Напоминания отправленные за 24ч:`);
        const reminders = reminders24h[0];
        console.log(`  START: L1=${reminders.level1_start}, L2=${reminders.level2_start}, L3=${reminders.level3_start}`);
        console.log(`  VIDEO1: L1=${reminders.level1_video1}, L2=${reminders.level2_video1}, L3=${reminders.level3_video1}`);
        console.log(`  VIDEO2: L1=${reminders.level1_video2}, L2=${reminders.level2_video2}, L3=${reminders.level3_video2}`);
        console.log(`  VIDEO3: L1=${reminders.level1_video3}, L2=${reminders.level2_video3}, L3=${reminders.level3_video3}`);

        // 7. Рассылки за 24 часа
        const broadcasts24h = await AppDataSource.query(`
            SELECT COUNT(*) as count FROM broadcast_history
            WHERE "createdAt" >= $1
        `, [last24Hours]);

        console.log(`\n📢 Рассылок за 24ч: ${broadcasts24h[0].count}`);

        // 8. Детали последних рассылок
        const lastBroadcasts = await AppDataSource.query(`
            SELECT "broadcastType", "totalSent", "totalFailed", "createdAt"
            FROM broadcast_history
            WHERE "createdAt" >= $1
            ORDER BY "createdAt" DESC
            LIMIT 5
        `, [last24Hours]);

        if (lastBroadcasts.length > 0) {
            console.log(`\n📋 Детали последних рассылок:`);
            lastBroadcasts.forEach((b: any) => {
                console.log(`  ${b.broadcastType}: ✅${b.totalSent} ❌${b.totalFailed} (${b.createdAt.toLocaleString()})`);
            });
        }

        // 9. Ошибки валидации чеков за 24 часа
        const validationErrors24h = await AppDataSource.query(`
            SELECT COUNT(*) as count FROM user_actions
            WHERE action = 'photo_rejected' AND timestamp >= $1
        `, [last24Hours]);

        console.log(`\n❌ Отклоненных чеков за 24ч: ${validationErrors24h[0].count}`);

        // 10. Конверсия по этапам
        const conversionData = await AppDataSource.query(`
            SELECT
                COUNT(*) FILTER (WHERE "currentStep" = 'start') as at_start,
                COUNT(*) FILTER (WHERE "currentStep" = 'video1') as at_video1,
                COUNT(*) FILTER (WHERE "currentStep" = 'video2') as at_video2,
                COUNT(*) FILTER (WHERE "currentStep" = 'video3') as at_video3,
                COUNT(*) FILTER (WHERE "currentStep" = 'payment_choice') as at_payment,
                COUNT(*) FILTER (WHERE "currentStep" = 'waiting_receipt') as waiting_receipt,
                COUNT(*) FILTER (WHERE "currentStep" = 'completed') as completed,
                COUNT(*) FILTER (WHERE "hasPaid" = true) as paid_total
            FROM users
        `);

        const conv = conversionData[0];
        console.log(`\n📈 КОНВЕРСИЯ ПО ЭТАПАМ:`);
        console.log(`  Start: ${conv.at_start}`);
        console.log(`  Video1: ${conv.at_video1}`);
        console.log(`  Video2: ${conv.at_video2}`);
        console.log(`  Video3: ${conv.at_video3}`);
        console.log(`  Payment Choice: ${conv.at_payment}`);
        console.log(`  Waiting Receipt: ${conv.waiting_receipt}`);
        console.log(`  ✅ Completed: ${conv.completed}`);
        console.log(`  💰 Total Paid: ${conv.paid_total}`);

        // 11. Среднее время прохождения этапов
        const avgTimeData = await AppDataSource.query(`
            SELECT
                AVG(EXTRACT(EPOCH FROM ("currentStepChangedAt" - "createdAt")) / 3600) as avg_hours_to_current
            FROM users
            WHERE "currentStepChangedAt" IS NOT NULL
        `);

        console.log(`\n⏱️ Среднее время до текущего этапа: ${Math.round(avgTimeData[0].avg_hours_to_current || 0)} часов`);

        await AppDataSource.destroy();
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

analyzeLast24Hours();
