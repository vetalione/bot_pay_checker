#!/bin/bash

echo "📡 Анализ сетевого трафика Telegram бота"
echo "========================================"

# Проверяем, установлен ли tcpdump
if ! command -v tcpdump &> /dev/null; then
    echo "❌ tcpdump не установлен. Устанавливаем..."
    brew install tcpdump
fi

# Проверяем, установлен ли tshark
if ! command -v tshark &> /dev/null; then
    echo "❌ tshark не установлен. Он должен быть установлен вместе с Wireshark."
fi

echo ""
echo "🔍 Выберите действие:"
echo "1. Захват трафика Telegram API (tcpdump)"
echo "2. Захват трафика Telegram API (tshark)"
echo "3. Анализ существующего файла в Wireshark"
echo "4. Запуск Wireshark для захвата в реальном времени"
echo ""

read -p "Ваш выбор (1-4): " choice

case $choice in
    1)
        echo "🚀 Захват трафика с помощью tcpdump..."
        echo "Нажмите Ctrl+C для остановки захвата"
        sudo tcpdump -i en0 -w telegram_traffic_$(date +%Y%m%d_%H%M%S).pcap host api.telegram.org
        ;;
    2)
        echo "🚀 Захват трафика с помощью tshark..."
        echo "Нажмите Ctrl+C для остановки захвата"
        sudo tshark -i en0 -w telegram_traffic_$(date +%Y%m%d_%H%M%S).pcap -f "host api.telegram.org"
        ;;
    3)
        echo "📁 Доступные файлы захвата:"
        ls -la *.pcap 2>/dev/null || echo "Файлы .pcap не найдены"
        echo ""
        read -p "Введите имя файла для анализа: " filename
        if [ -f "$filename" ]; then
            wireshark "$filename"
        else
            echo "❌ Файл не найден"
        fi
        ;;
    4)
        echo "🚀 Запуск Wireshark..."
        sudo wireshark
        ;;
    *)
        echo "❌ Неверный выбор"
        ;;
esac