#!/usr/bin/env python3
"""
Парсер Railway логов для извлечения результатов рассылок.

USAGE:
1. Зайди в Railway Dashboard → твой проект → Deployments
2. Выбери деплои за 2-6 ноября 2025
3. Скопируй логи в файл railway_logs.txt
4. Запусти: python3 scripts/parse_railway_logs.py

Ищет паттерны:
- "РЕЗУЛЬТАТЫ WARMUP РАССЫЛКИ"
- "Всего пользователей"
- "Отправлено"
- "Ошибок"
- Timestamps
"""

import re
from datetime import datetime
from typing import List, Dict, Optional
import os

def parse_broadcast_result(text: str) -> Optional[Dict]:
    """
    Парсит блок с результатами рассылки
    """
    # Ищем заголовок или ключевые паттерны
    has_broadcast_marker = (
        "РЕЗУЛЬТАТЫ WARMUP РАССЫЛКИ" in text or
        "Broadcast completed" in text or
        "Total attempted" in text or
        ("start:" in text and "video1:" in text and ("sent" in text.lower() or "отправлено" in text.lower()))
    )
    
    if not has_broadcast_marker:
        return None
    
    result = {
        'type': 'unknown',
        'timestamp': None,
        'total': None,
        'sent': None,
        'failed': None,
        'segments': {}
    }
    
    # Определяем тип рассылки
    if "WARMUP" in text or "warmup" in text.lower():
        result['type'] = 'warmup'
    elif "bot restored" in text.lower() or "бот снова работает" in text.lower():
        result['type'] = 'bot_restored'
    elif "waiting_receipt" in text.lower():
        result['type'] = 'waiting_receipt'
    elif "payment_choice" in text.lower():
        result['type'] = 'payment_choice'
    elif "stuck" in text.lower():
        result['type'] = 'stuck_users'
    
    # Ищем timestamp в формате Railway: 2025-11-06T10:23:45.123Z
    timestamp_match = re.search(r'(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})', text)
    if timestamp_match:
        try:
            result['timestamp'] = datetime.fromisoformat(timestamp_match.group(1).replace('T', ' '))
        except:
            pass
    
    # Ищем числа
    total_match = re.search(r'(?:Всего|Total)[^\d]+(\d+)', text, re.IGNORECASE)
    if total_match:
        # Проверяем что это не год (больше 2000 и меньше 3000)
        num = int(total_match.group(1))
        if num < 2000 or num > 3000:
            result['total'] = num
    
    sent_match = re.search(r'(?:Отправлено|Sent)[^\d]+(\d+)', text, re.IGNORECASE)
    if sent_match:
        result['sent'] = int(sent_match.group(1))
    
    failed_match = re.search(r'(?:Ошибок|Failed)[^\d]+(\d+)', text, re.IGNORECASE)
    if failed_match:
        result['failed'] = int(failed_match.group(1))
    
    # Альтернативный паттерн: "Total attempted: 171, sent: 157, failed: 14"
    if not result['total']:
        alt_match = re.search(r'attempted[^\d]+(\d+).*?sent[^\d]+(\d+).*?failed[^\d]+(\d+)', text, re.IGNORECASE)
        if alt_match:
            result['total'] = int(alt_match.group(1))
            result['sent'] = int(alt_match.group(2))
            result['failed'] = int(alt_match.group(3))
    
    # Ищем сегменты (start: X/Y, video1: X/Y)
    segment_matches = re.finditer(r'(start|video1|video2|video3|payment_choice|waiting_receipt):\s*(\d+)/(\d+)', text, re.IGNORECASE)
    for match in segment_matches:
        segment = match.group(1).lower()
        sent = int(match.group(2))
        total = int(match.group(3))
        result['segments'][segment] = {'sent': sent, 'total': total}
    
    # Если нашли хоть что-то полезное
    if result['total'] or result['sent'] or result['segments']:
        return result
    
    return None

def parse_log_file(filepath: str) -> List[Dict]:
    """
    Читает файл с логами и извлекает все результаты рассылок
    """
    if not os.path.exists(filepath):
        print(f"❌ Файл {filepath} не найден!")
        print("\n📝 Инструкция:")
        print("1. Зайди в Railway Dashboard")
        print("2. Выбери деплои за 2-6 ноября 2025")
        print("3. Скопируй логи и сохрани в railway_logs.txt")
        return []
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    results = []
    seen = set()  # Для дедупликации
    
    # Разбиваем на блоки по разделителю ---
    sections = content.split('---')
    
    for section in sections:
        # Берем больше контекста
        result = parse_broadcast_result(section)
        if result:
            # Создаем уникальный ключ для дедупликации
            key = f"{result.get('timestamp')}_{result.get('total')}_{result.get('sent')}"
            if key not in seen:
                seen.add(key)
                results.append(result)
    
    return results

def format_broadcast_for_db(results: List[Dict]) -> str:
    """
    Форматирует результаты для внесения в БД
    """
    if not results:
        return "❌ Результаты рассылок не найдены в логах"
    
    output = []
    output.append("📊 НАЙДЕННЫЕ РАССЫЛКИ:\n")
    output.append("=" * 60)
    
    for idx, r in enumerate(results, 1):
        output.append(f"\n{idx}. {r['type'].upper()}")
        
        if r['timestamp']:
            output.append(f"   Дата: {r['timestamp'].strftime('%d.%m.%Y %H:%M:%S')}")
        else:
            output.append(f"   Дата: неизвестна")
        
        if r['segments']:
            output.append(f"   Сегменты:")
            for segment, data in r['segments'].items():
                output.append(f"      - {segment}: {data['sent']}/{data['total']}")
        
        if r['total']:
            output.append(f"   Всего пользователей: {r['total']}")
        if r['sent']:
            output.append(f"   Отправлено: {r['sent']}")
        if r['failed']:
            output.append(f"   Ошибок: {r['failed']}")
        
        output.append("")
    
    output.append("=" * 60)
    output.append("\n💾 SQL для вставки в БД:\n")
    
    for r in results:
        if not r['total'] and not r['sent']:
            continue
        
        timestamp = r['timestamp'].strftime('%Y-%m-%d %H:%M:%S') if r['timestamp'] else 'NOW()'
        if timestamp != 'NOW()':
            timestamp = f"'{timestamp}'"
        
        # Формируем данные о сегментах
        segment_start = r['segments'].get('start', {}).get('sent', 0)
        segment_video1 = r['segments'].get('video1', {}).get('sent', 0)
        
        total = r['total'] or (r['sent'] + r['failed']) if r['sent'] and r['failed'] else r['sent']
        sent = r['sent'] or (segment_start + segment_video1)
        failed = r['failed'] or 0
        
        sql = f"""INSERT INTO broadcast_history (created_at, broadcast_type, segment_start, segment_video1, total_attempted, total_sent, total_failed)
VALUES ({timestamp}, '{r['type']}', {segment_start}, {segment_video1}, {total or 0}, {sent or 0}, {failed});"""
        
        output.append(sql)
        output.append("")
    
    return "\n".join(output)

def main():
    print("🔍 Парсер Railway логов для рассылок\n")
    
    # Ищем файл с логами
    log_file = "railway_logs.txt"
    
    results = parse_log_file(log_file)
    
    if results:
        print(f"✅ Найдено рассылок: {len(results)}\n")
        output = format_broadcast_for_db(results)
        print(output)
        
        # Сохраняем в файл
        with open('broadcast_results.txt', 'w', encoding='utf-8') as f:
            f.write(output)
        
        print(f"\n💾 Результаты сохранены в broadcast_results.txt")
    else:
        print("❌ Результаты не найдены")
        print("\n📝 Убедись что в railway_logs.txt есть:")
        print("   - 'РЕЗУЛЬТАТЫ WARMUP РАССЫЛКИ'")
        print("   - 'Всего пользователей: XXX'")
        print("   - 'Отправлено: XXX'")

if __name__ == "__main__":
    main()
