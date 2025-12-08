#!/bin/bash

# 🎯 Скрипт для получения статистики из Railway БД
# Всегда использует правильное подключение к production БД

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# DATABASE_URL из .env файла
DATABASE_URL="postgresql://postgres:tbswlvQbgFmiOdcJPKyAckRuSmvrYxxw@nozomi.proxy.rlwy.net:35365/railway"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   📊 СТАТИСТИКА RAILWAY БД${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Проверка подключения
echo -e "${YELLOW}🔍 Проверка подключения к БД...${NC}"
TOTAL_USERS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM users;")

if [ -z "$TOTAL_USERS" ]; then
    echo -e "${RED}❌ Ошибка подключения к БД${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Подключение успешно${NC}"
echo -e "${GREEN}   Всего пользователей в БД: $TOTAL_USERS${NC}\n"

if [ $TOTAL_USERS -lt 100 ]; then
    echo -e "${RED}⚠️  ВНИМАНИЕ: Похоже это локальная БД, а не Railway!${NC}"
    echo -e "${RED}   Railway БД должна содержать ~1000+ пользователей${NC}\n"
fi

# Получаем статистику
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

psql "$DATABASE_URL" -c "
SELECT 
  '🕐 ЗА ПОСЛЕДНИЙ ЧАС:' as period,
  (SELECT COUNT(*) FROM users WHERE \"createdAt\" >= NOW() - INTERVAL '1 hour') as \"👥 Новых пользователей\",
  (SELECT COUNT(*) FROM user_actions WHERE action = 'payment_success' AND timestamp >= NOW() - INTERVAL '1 hour') as \"💰 Оплат\"
UNION ALL
SELECT 
  '📅 ЗА ПОСЛЕДНИЕ 24 ЧАСА:' as period,
  (SELECT COUNT(*) FROM users WHERE \"createdAt\" >= NOW() - INTERVAL '24 hours') as users,
  (SELECT COUNT(*) FROM user_actions WHERE action = 'payment_success' AND timestamp >= NOW() - INTERVAL '24 hours') as payments
UNION ALL
SELECT 
  '📈 ЗА ВСЕ ВРЕМЯ:' as period,
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM users WHERE \"hasPaid\" = true) as payments;
"

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}💡 Разбивка оплат по валютам (24 часа):${NC}\n"

psql "$DATABASE_URL" -c "
SELECT 
  COALESCE(u.currency, 'Не указано') as \"Валюта\",
  COUNT(*) as \"Количество\"
FROM user_actions ua
JOIN users u ON ua.\"userId\" = u.\"userId\"
WHERE ua.action = 'payment_success'
AND ua.timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY u.currency;
"

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Статистика получена из Railway БД${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
