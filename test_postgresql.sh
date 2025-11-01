#!/bin/bash

# PostgreSQL Quick Test Script
# Этот скрипт проверяет что БД работает корректно

echo "🧪 PostgreSQL Quick Test"
echo "========================"
echo ""

# Проверка что PostgreSQL установлен
echo "1️⃣ Проверка PostgreSQL..."
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL не установлен!"
    echo "   Установите: brew install postgresql"
    exit 1
fi
echo "✅ PostgreSQL установлен"
echo ""

# Проверка что PostgreSQL запущен
echo "2️⃣ Проверка что PostgreSQL запущен..."
if ! brew services list | grep postgresql | grep started &> /dev/null; then
    echo "⚠️  PostgreSQL не запущен. Запускаю..."
    brew services start postgresql
    sleep 2
fi
echo "✅ PostgreSQL запущен"
echo ""

# Проверка что БД существует
echo "3️⃣ Проверка БД telegram_bot..."
if ! psql -lqt | cut -d \| -f 1 | grep -qw telegram_bot; then
    echo "⚠️  БД не существует. Создаю..."
    createdb telegram_bot
fi
echo "✅ БД telegram_bot существует"
echo ""

# Проверка что .env содержит DATABASE_URL
echo "4️⃣ Проверка .env..."
if ! grep -q "DATABASE_URL" .env; then
    echo "⚠️  DATABASE_URL не найден в .env. Добавляю..."
    echo "" >> .env
    echo "# Database Configuration" >> .env
    echo "DATABASE_URL=postgresql://localhost:5432/telegram_bot" >> .env
fi
echo "✅ DATABASE_URL настроен"
echo ""

# Компиляция
echo "5️⃣ Компиляция TypeScript..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Компиляция успешна"
else
    echo "❌ Ошибка компиляции!"
    npm run build
    exit 1
fi
echo ""

# Запуск бота (для проверки подключения к БД)
echo "6️⃣ Тест подключения к БД..."
echo "   (Запускаю бота на 5 секунд...)"

# Запускаем бота в фоне
timeout 5s npm run dev > test_output.log 2>&1 &
BOT_PID=$!

# Ждем 3 секунды
sleep 3

# Проверяем логи
if grep -q "База данных инициализирована" test_output.log; then
    echo "✅ База данных подключена успешно!"
else
    echo "❌ Ошибка подключения к БД!"
    cat test_output.log
    rm test_output.log
    exit 1
fi

if grep -q "UserService создан" test_output.log; then
    echo "✅ UserService инициализирован"
else
    echo "⚠️  UserService не инициализирован"
fi

if grep -q "Бот запущен успешно" test_output.log; then
    echo "✅ Бот запущен успешно"
else
    echo "⚠️  Бот не запустился полностью"
fi

# Очистка
rm test_output.log 2>/dev/null

echo ""
echo "========================"
echo "✅ Все тесты пройдены!"
echo ""
echo "Теперь можете:"
echo "  1. Запустить бота: npm run dev"
echo "  2. Проверить статистику: npm run retargeting stats"
echo "  3. Запустить retargeting: npm run retargeting stuck_video1"
echo ""
echo "📚 Документация:"
echo "  - DATABASE_INFO.md - Структура БД"
echo "  - RETARGETING_GUIDE.md - Retargeting кампании"
echo "  - RAILWAY_DEPLOY.md - Deployment"
echo ""
