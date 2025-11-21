
import * as dotenv from 'dotenv';
dotenv.config();

import { AppDataSource } from './src/database';
import { UserAction } from './src/entities/UserAction';
import { BroadcastHistory } from './src/entities/BroadcastHistory';

async function checkLogs() {
    try {
        // Override logging to avoid noise
        AppDataSource.setOptions({ logging: false });
        
        await AppDataSource.initialize();
        console.log("✅ Connected to Database");

        console.log("\n🔍 --- ПОСЛЕДНИЕ ДЕЙСТВИЯ ПОЛЬЗОВАТЕЛЕЙ (User Actions) ---");
        const actions = await AppDataSource.getRepository(UserAction).find({
            order: { timestamp: 'DESC' },
            take: 20
        });
        
        if (actions.length === 0) {
            console.log("Нет записей.");
        } else {
            actions.forEach(a => {
                const meta = a.metadata ? JSON.stringify(a.metadata).substring(0, 100) : '';
                console.log(`[${a.timestamp.toLocaleString()}] User: ${a.userId} | Action: ${a.action} | Step: ${a.step} ${meta ? `| Meta: ${meta}...` : ''}`);
            });
        }

        console.log("\n📢 --- ИСТОРИЯ РАССЫЛОК (Broadcast History) ---");
        const broadcasts = await AppDataSource.getRepository(BroadcastHistory).find({
            order: { createdAt: 'DESC' },
            take: 5
        });
        
        if (broadcasts.length === 0) {
            console.log("Нет записей.");
        } else {
            broadcasts.forEach(b => {
                console.log(`[${b.createdAt.toLocaleString()}] Type: ${b.broadcastType} | ✅ Sent: ${b.totalSent} | ❌ Failed: ${b.totalFailed} | Total: ${b.totalAttempted}`);
            });
        }

        await AppDataSource.destroy();
    } catch (error) {
        console.error("❌ Error connecting to DB:", error);
    }
}

checkLogs();
