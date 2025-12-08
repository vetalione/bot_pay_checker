#!/usr/bin/env node

/**
 * Быстрая статистика: пользователи за последний час и оплаты за последние 24 часа
 */

import { AppDataSource } from './src/database';

async function getRecentStats() {
  try {
    console.log('🔄 Подключение к базе данных...');
    await AppDataSource.initialize();
    console.log('✅ База данных подключена\n');

    // 1. Пользователи за последний час
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const usersLastHour = await AppDataSource.query(`
      SELECT COUNT(*) as count
      FROM users
      WHERE "createdAt" >= $1
    `, [oneHourAgo]);

    // 2. Оплаты за последние 24 часа
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const paymentsLast24Hours = await AppDataSource.query(`
      SELECT COUNT(*) as count
      FROM user_actions
      WHERE action = 'payment_success'
      AND timestamp >= $1
    `, [twentyFourHoursAgo]);

    // 3. Детализация оплат по валютам за последние 24 часа
    const paymentsByCurrency = await AppDataSource.query(`
      SELECT
        u.currency,
        COUNT(*) as count
      FROM user_actions ua
      JOIN users u ON ua."userId" = u."userId"
      WHERE ua.action = 'payment_success'
      AND ua.timestamp >= $1
      GROUP BY u.currency
    `, [twentyFourHoursAgo]);

    // 4. Общая статистика за все время
    const totalStats = await AppDataSource.query(`
      SELECT
        COUNT(*) as total_users,
        COUNT(CASE WHEN "hasPaid" = true THEN 1 END) as paid_users,
        COUNT(CASE WHEN currency = 'RUB' THEN 1 END) as rub_payments,
        COUNT(CASE WHEN currency = 'UAH' THEN 1 END) as uah_payments
      FROM users
    `);

    console.log('📊 БЫСТРАЯ СТАТИСТИКА:');
    console.log('═'.repeat(50));

    console.log(`\n🕐 ЗА ПОСЛЕДНИЙ ЧАС:`);
    console.log(`   👥 Новых пользователей: ${usersLastHour[0].count}`);

    console.log(`\n📅 ЗА ПОСЛЕДНИЕ 24 ЧАСА:`);
    console.log(`   💰 Успешных оплат: ${paymentsLast24Hours[0].count}`);

    if (paymentsByCurrency.length > 0) {
      console.log(`   └─ По валютам:`);
      paymentsByCurrency.forEach((row: any) => {
        const currencyName = row.currency === 'RUB' ? 'рублей' : row.currency === 'UAH' ? 'гривен' : row.currency;
        console.log(`      • ${row.count} в ${currencyName}`);
      });
    }

    console.log(`\n📈 ЗА ВСЕ ВРЕМЯ:`);
    const total = totalStats[0];
    console.log(`   👥 Всего пользователей: ${total.total_users}`);
    console.log(`   ✅ Оплативших: ${total.paid_users} (${total.total_users > 0 ? Math.round(total.paid_users / total.total_users * 100) : 0}%)`);
    console.log(`   💵 В рублях: ${total.rub_payments}`);
    console.log(`   💴 В гривнах: ${total.uah_payments}`);

    // 5. Активность за последний час по действиям
    const actionsLastHour = await AppDataSource.query(`
      SELECT action, COUNT(*) as count
      FROM user_actions
      WHERE timestamp >= $1
      GROUP BY action
      ORDER BY count DESC
      LIMIT 10
    `, [oneHourAgo]);

    if (actionsLastHour.length > 0) {
      console.log(`\n🎯 ТОП ДЕЙСТВИЙ ЗА ЧАС:`);
      actionsLastHour.forEach((row: any, i: number) => {
        console.log(`   ${i + 1}. ${row.action}: ${row.count}`);
      });
    }

    await AppDataSource.destroy();
    console.log('\n✅ Готово!');

  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

getRecentStats();