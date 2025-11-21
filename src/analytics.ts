/**
 * Analytics Dashboard
 * Подключается к production БД на Railway и показывает подробную статистику
 * 
 * Использование:
 * npm run analytics              - Полный отчет
 * npm run analytics users        - Только пользователи
 * npm run analytics funnel       - Воронка конверсии
 * npm run analytics validation   - Статистика валидаций
 * npm run analytics failures     - Детали отказов
 */

import { AppDataSource } from './database';
import { UserService } from './userService';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function section(title: string) {
  console.log('\n');
  log('═'.repeat(60), colors.bright);
  log(`  ${title}`, colors.bright + colors.cyan);
  log('═'.repeat(60), colors.bright);
}

async function getUsersReport(userService: UserService) {
  section('📊 ПОЛЬЗОВАТЕЛИ');
  
  const query = `
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN "hasPaid" = true THEN 1 END) as paid,
      COUNT(CASE WHEN "hasPaid" = false THEN 1 END) as not_paid,
      COUNT(CASE WHEN currency = 'RUB' THEN 1 END) as chose_rub,
      COUNT(CASE WHEN currency = 'UAH' THEN 1 END) as chose_uah
    FROM users;
  `;
  
  const result = await AppDataSource.query(query);
  const data = result[0];
  
  log(`\nВсего пользователей: ${colors.bright}${data.total}${colors.reset}`);
  log(`├─ Оплатили: ${colors.green}${data.paid}${colors.reset} (${data.total > 0 ? Math.round(data.paid / data.total * 100) : 0}%)`);
  log(`└─ Не оплатили: ${colors.yellow}${data.not_paid}${colors.reset} (${data.total > 0 ? Math.round(data.not_paid / data.total * 100) : 0}%)`);
  
  log(`\nВыбор валюты:`);
  log(`├─ Рубли (RUB): ${colors.blue}${data.chose_rub}${colors.reset}`);
  log(`└─ Гривны (UAH): ${colors.blue}${data.chose_uah}${colors.reset}`);
}

async function getFunnelReport(userService: UserService) {
  section('🔄 ВОРОНКА КОНВЕРСИИ');
  
  const query = `
    SELECT 
      (SELECT COUNT(DISTINCT "userId") FROM user_actions WHERE action = 'start') as started,
      (SELECT COUNT(DISTINCT "userId") FROM user_actions WHERE action = 'click_want_more') as clicked_want_more,
      (SELECT COUNT(DISTINCT "userId") FROM user_actions WHERE action = 'click_continue_watching') as watched_video2,
      (SELECT COUNT(DISTINCT "userId") FROM user_actions WHERE action = 'click_ready_for_more') as watched_video3,
      (SELECT COUNT(DISTINCT "userId") FROM user_actions WHERE action IN ('click_get_advantage', 'skip_video3')) as clicked_advantage_or_skipped,
      (SELECT COUNT(DISTINCT "userId") FROM user_actions WHERE action = 'skip_video3') as skipped_video3,
      (SELECT COUNT(DISTINCT "userId") FROM user_actions WHERE action IN ('choose_rub', 'choose_uah')) as chose_currency,
      (SELECT COUNT(DISTINCT "userId") FROM user_actions WHERE action = 'payment_success') as paid
  `;
  
  const result = await AppDataSource.query(query);
  const funnel = result[0];
  
  const started = parseInt(funnel.started);
  
  function showStep(label: string, count: number, prevCount: number) {
    const percentage = prevCount > 0 ? Math.round(count / prevCount * 100) : 0;
    const conversionFromStart = started > 0 ? Math.round(count / started * 100) : 0;
    const dropoff = prevCount - count;
    const dropoffPercent = prevCount > 0 ? Math.round(dropoff / prevCount * 100) : 0;
    
    log(`\n${label}: ${colors.bright}${count}${colors.reset} пользователей`);
    log(`├─ Конверсия от предыдущего шага: ${colors.green}${percentage}%${colors.reset}`);
    log(`├─ От начала воронки: ${colors.cyan}${conversionFromStart}%${colors.reset}`);
    log(`└─ Отвалилось: ${colors.red}${dropoff}${colors.reset} (${dropoffPercent}%)`);
  }
  
  showStep('1️⃣ Запустили бота (/start)', started, started);
  showStep('2️⃣ Нажали "Хочу больше" (video1)', parseInt(funnel.clicked_want_more), started);
  showStep('3️⃣ Нажали "Смотреть дальше" (video2)', parseInt(funnel.watched_video2), parseInt(funnel.clicked_want_more));
  showStep('4️⃣ Нажали "Готов!" (video3)', parseInt(funnel.watched_video3), parseInt(funnel.watched_video2));
  showStep('5️⃣ Перешли к оплате (Забрать преимущество / Пропустить)', parseInt(funnel.clicked_advantage_or_skipped), parseInt(funnel.watched_video3));
  
  // Детализация пропуска видео3
  const skippedCount = parseInt(funnel.skipped_video3);
  const advantageCount = parseInt(funnel.clicked_advantage_or_skipped) - skippedCount;
  if (skippedCount > 0) {
    log(`\n   📊 Детализация:`);
    log(`   ├─ Посмотрели видео3: ${colors.green}${advantageCount}${colors.reset}`);
    log(`   └─ Пропустили видео3: ${colors.blue}${skippedCount}${colors.reset} (${Math.round(skippedCount / parseInt(funnel.clicked_advantage_or_skipped) * 100)}%)`);
  }
  
  showStep('6️⃣ Выбрали валюту', parseInt(funnel.chose_currency), parseInt(funnel.clicked_advantage_or_skipped));
  showStep('7️⃣ Оплатили', parseInt(funnel.paid), parseInt(funnel.chose_currency));
  
  log(`\n${'─'.repeat(40)}`);
  log(`${colors.bright}ИТОГОВАЯ КОНВЕРСИЯ: ${colors.green}${started > 0 ? Math.round(parseInt(funnel.paid) / started * 100) : 0}%${colors.reset}`);
}

async function getValidationReport(userService: UserService) {
  section('✅ СТАТИСТИКА ВАЛИДАЦИЙ');
  
  const query = `
    SELECT 
      (SELECT COUNT(*) FROM user_actions WHERE action = 'photo_rejected') as photos_rejected,
      (SELECT COUNT(*) FROM user_actions WHERE action = 'receipt_validation_failed') as validations_failed,
      (SELECT COUNT(*) FROM user_actions WHERE action = 'payment_success') as validations_passed
  `;
  
  const result = await AppDataSource.query(query);
  const data = result[0];
  
  const total = parseInt(data.photos_rejected) + parseInt(data.validations_failed) + parseInt(data.validations_passed);
  
  log(`\nВсего попыток загрузки: ${colors.bright}${total}${colors.reset}`);
  log(`├─ Успешно: ${colors.green}${data.validations_passed}${colors.reset} (${total > 0 ? Math.round(data.validations_passed / total * 100) : 0}%)`);
  log(`├─ Не квитанция: ${colors.red}${data.photos_rejected}${colors.reset} (${total > 0 ? Math.round(data.photos_rejected / total * 100) : 0}%)`);
  log(`└─ Квитанция не подходит: ${colors.yellow}${data.validations_failed}${colors.reset} (${total > 0 ? Math.round(data.validations_failed / total * 100) : 0}%)`);
}

async function getFailuresReport(userService: UserService) {
  section('❌ ДЕТАЛИ ОТКАЗОВ');
  
  // Получаем примеры отказов с метаданными
  const photoRejected = await AppDataSource.query(`
    SELECT metadata, timestamp 
    FROM user_actions 
    WHERE action = 'photo_rejected' 
    ORDER BY timestamp DESC 
    LIMIT 5
  `);
  
  const validationFailed = await AppDataSource.query(`
    SELECT metadata, timestamp 
    FROM user_actions 
    WHERE action = 'receipt_validation_failed' 
    ORDER BY timestamp DESC 
    LIMIT 5
  `);
  
  log(`\n${colors.yellow}Последние 5 отказов "НЕ-квитанция":${colors.reset}`);
  if (photoRejected.length === 0) {
    log('  (нет данных)');
  } else {
    photoRejected.forEach((row: any, i: number) => {
      const meta = row.metadata || {};
      log(`\n  ${i + 1}. ${new Date(row.timestamp).toLocaleString('ru-RU')}`);
      log(`     Причина: ${meta.reason || 'не указана'}`);
      log(`     Описание: ${meta.imageDescription || 'нет описания'}`);
    });
  }
  
  log(`\n${colors.red}Последние 5 отказов "Квитанция не подходит":${colors.reset}`);
  if (validationFailed.length === 0) {
    log('  (нет данных)');
  } else {
    validationFailed.forEach((row: any, i: number) => {
      const meta = row.metadata || {};
      log(`\n  ${i + 1}. ${new Date(row.timestamp).toLocaleString('ru-RU')}`);
      log(`     Причина: ${meta.reason ? meta.reason.split('\n')[0] : 'не указана'}`);
      log(`     Сумма найдена: ${meta.extractedAmount || 'н/д'}`);
      log(`     Номер карты: ${meta.extractedCardNumber || 'н/д'}`);
      log(`     Уверенность AI: ${meta.confidence || 'н/д'}%`);
      log(`     Мошенничество: ${meta.isFraud ? 'ДА ⚠️' : 'нет'}`);
    });
  }
}

async function getTopActionsReport(userService: UserService) {
  section('📈 ТОП ДЕЙСТВИЙ');
  
  const query = `
    SELECT action, COUNT(*) as count 
    FROM user_actions 
    GROUP BY action 
    ORDER BY count DESC
  `;
  
  const result = await AppDataSource.query(query);
  
  log('');
  result.forEach((row: any, i: number) => {
    const bar = '█'.repeat(Math.min(Math.round(row.count / 2), 40));
    log(`${(i + 1).toString().padStart(2)}. ${row.action.padEnd(30)} ${colors.blue}${bar}${colors.reset} ${row.count}`);
  });
}

async function getRecentUsersReport(userService: UserService) {
  section('👥 ПОСЛЕДНИЕ ПОЛЬЗОВАТЕЛИ');
  
  const query = `
    SELECT "userId", username, "firstName", "currentStep", currency, "hasPaid", "createdAt"
    FROM users 
    ORDER BY "createdAt" DESC 
    LIMIT 10
  `;
  
  const result = await AppDataSource.query(query);
  
  if (result.length === 0) {
    log('\nПользователей пока нет');
    return;
  }
  
  log('');
  result.forEach((user: any, i: number) => {
    const status = user.hasPaid ? `${colors.green}✓ Оплатил${colors.reset}` : `${colors.yellow}○ Не оплатил${colors.reset}`;
    const name = user.firstName || user.username || `User${user.userId}`;
    const currency = user.currency ? `(${user.currency})` : '';
    const date = new Date(user.createdAt).toLocaleString('ru-RU');
    
    log(`${(i + 1).toString().padStart(2)}. ${status} ${name} ${currency}`);
    log(`    ID: ${user.userId} | Шаг: ${user.currentStep} | ${date}`);
    log('');
  });
}

async function main() {
  const reportType = process.argv[2] || 'all';
  
  try {
    log(`\n${colors.bright}${colors.cyan}Подключение к базе данных...${colors.reset}`);
    await AppDataSource.initialize();
    log(`${colors.green}✅ База данных подключена${colors.reset}`);
    
    const userService = new UserService();
    
    if (reportType === 'all' || reportType === 'users') {
      await getUsersReport(userService);
      await getRecentUsersReport(userService);
    }
    
    if (reportType === 'all' || reportType === 'funnel') {
      await getFunnelReport(userService);
    }
    
    if (reportType === 'all' || reportType === 'validation') {
      await getValidationReport(userService);
    }
    
    if (reportType === 'all' || reportType === 'failures') {
      await getFailuresReport(userService);
    }
    
    if (reportType === 'all' || reportType === 'actions') {
      await getTopActionsReport(userService);
    }
    
    section('✅ ОТЧЕТ ЗАВЕРШЕН');
    
    await AppDataSource.destroy();
    process.exit(0);
    
  } catch (error) {
    log(`\n${colors.red}❌ Ошибка:${colors.reset}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

main();
