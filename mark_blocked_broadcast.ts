import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './src/entities/User';
import { UserAction } from './src/entities/UserAction';
import { PaymentStats } from './src/entities/PaymentStats';
import { CurrentSteps } from './src/entities/CurrentSteps';
import * as fs from 'fs';

const ds = new DataSource({
  type: 'postgres',
  host: 'nozomi.proxy.rlwy.net',
  port: 35365,
  username: 'postgres',
  password: 'tbswlvQbgFmiOdcJPKyAckRuSmvrYxxw',
  database: 'railway',
  synchronize: false,
  logging: false,
  entities: [User, UserAction, PaymentStats, CurrentSteps],
});

async function main() {
  await ds.initialize();
  console.log('✅ БД подключена');

  const idsRaw = fs.readFileSync('/tmp/blocked_ids.txt', 'utf-8').trim();
  const ids = idsRaw.split('\n').map(Number).filter(Boolean);
  console.log(`📋 Загружено ${ids.length} ID для маркировки`);

  const result = await ds.query(
    `UPDATE users SET "blockedBot" = true, "blockedAt" = NOW() WHERE "userId" = ANY($1)`,
    [ids]
  );

  console.log(`✅ Помечено как blocked: ${result[1]} из ${ids.length}`);

  // Проверяем
  const check = await ds.query(
    `SELECT COUNT(*) as blocked FROM users WHERE "userId" = ANY($1) AND "blockedBot" = true`,
    [ids]
  );
  console.log(`📊 Всего blocked в этом списке: ${check[0].blocked}`);

  await ds.destroy();
}

main().catch(e => { console.error(e); process.exit(1); });
