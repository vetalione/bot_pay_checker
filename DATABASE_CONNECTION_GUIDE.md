# 🔧 Руководство по подключению к базе данных Railway

## ⚠️ ВАЖНО: Проблема с локальной БД vs Railway БД

При запуске скриптов аналитики часто возникает проблема: **TypeORM подключается к локальной БД вместо Railway**.

---

## 🎯 Быстрое решение

### 1. Всегда проверяйте реальное подключение ПЕРЕД запуском скриптов:

```bash
# Проверка количества пользователей в Railway БД
psql "postgresql://postgres:tbswlvQbgFmiOdcJPKyAckRuSmvrYxxw@nozomi.proxy.rlwy.net:35365/railway" -c "SELECT COUNT(*) FROM users;"
```

**Ожидаемый результат:** ~1000+ пользователей  
**Если видите 1-10 пользователей:** скрипт подключается к локальной БД ❌

---

## 📊 Готовые SQL запросы для Railway

### Статистика за последний час:
```bash
psql "$DATABASE_URL" -c "
SELECT COUNT(*) as users_last_hour 
FROM users 
WHERE \"createdAt\" >= NOW() - INTERVAL '1 hour';
"
```

### Оплаты за последние 24 часа:
```bash
psql "$DATABASE_URL" -c "
SELECT COUNT(*) as payments_last_24h 
FROM user_actions 
WHERE action = 'payment_success' 
AND timestamp >= NOW() - INTERVAL '24 hours';
"
```

### Полная статистика:
```bash
psql "$DATABASE_URL" -c "
SELECT 
  (SELECT COUNT(*) FROM users WHERE \"createdAt\" >= NOW() - INTERVAL '1 hour') as users_1h,
  (SELECT COUNT(*) FROM users WHERE \"createdAt\" >= NOW() - INTERVAL '24 hours') as users_24h,
  (SELECT COUNT(*) FROM user_actions WHERE action = 'payment_success' AND timestamp >= NOW() - INTERVAL '1 hour') as payments_1h,
  (SELECT COUNT(*) FROM user_actions WHERE action = 'payment_success' AND timestamp >= NOW() - INTERVAL '24 hours') as payments_24h,
  (SELECT COUNT(*) FROM users WHERE \"hasPaid\" = true) as total_paid,
  (SELECT COUNT(*) FROM users) as total_users;
"
```

---

## 🔍 Диагностика проблем

### Проблема: Скрипт показывает 1 пользователя вместо 1000+

**Причина:** TypeORM кеширует подключение или использует локальную БД

**Решение:**
1. Проверьте `.env` файл:
   ```bash
   grep DATABASE_URL .env
   ```
   
2. Должно быть:
   ```
   DATABASE_URL=postgresql://postgres:tbswlvQbgFmiOdcJPKyAckRuSmvrYxxw@nozomi.proxy.rlwy.net:35365/railway
   ```

3. Используйте прямые SQL запросы через `psql` вместо TypeORM скриптов

---

## ✅ Рекомендуемый подход для AI помощника

### ВСЕГДА сначала проверяй реальное подключение:

```bash
# Шаг 1: Проверка DATABASE_URL
echo "Проверка DATABASE_URL:" && grep DATABASE_URL .env

# Шаг 2: Тест подключения
psql "$(grep DATABASE_URL .env | cut -d'=' -f2)" -c "SELECT COUNT(*) as total FROM users;"

# Шаг 3: Если видишь ~1000 пользователей - используй прямые SQL запросы
# Если видишь 1-10 - значит локальная БД, нужно исправить подключение
```

---

## 📝 Переменные окружения

### Railway Production DB (ИСПОЛЬЗУЕМ ЭТУ):
```env
DATABASE_URL=postgresql://postgres:tbswlvQbgFmiOdcJPKyAckRuSmvrYxxw@nozomi.proxy.rlwy.net:35365/railway
```

### Локальная DB (НЕ ИСПОЛЬЗУЕМ для статистики):
```env
DATABASE_URL=postgresql://localhost:5432/telegram_bot
```

---

## 🚀 Быстрые команды

### Алиасы для .zshrc или .bashrc:

```bash
# Добавьте в ~/.zshrc:
alias railway-stats='psql "postgresql://postgres:tbswlvQbgFmiOdcJPKyAckRuSmvrYxxw@nozomi.proxy.rlwy.net:35365/railway" -c "SELECT COUNT(*) as total_users, COUNT(CASE WHEN \"hasPaid\"=true THEN 1 END) as paid FROM users;"'

alias railway-24h='psql "postgresql://postgres:tbswlvQbgFmiOdcJPKyAckRuSmvrYxxw@nozomi.proxy.rlwy.net:35365/railway" -c "SELECT (SELECT COUNT(*) FROM users WHERE \"createdAt\" >= NOW() - INTERVAL '\''24 hours'\'') as new_users, (SELECT COUNT(*) FROM user_actions WHERE action = '\''payment_success'\'' AND timestamp >= NOW() - INTERVAL '\''24 hours'\'') as payments;"'

alias railway-1h='psql "postgresql://postgres:tbswlvQbgFmiOdcJPKyAckRuSmvrYxxw@nozomi.proxy.rlwy.net:35365/railway" -c "SELECT (SELECT COUNT(*) FROM users WHERE \"createdAt\" >= NOW() - INTERVAL '\''1 hour'\'') as new_users, (SELECT COUNT(*) FROM user_actions WHERE action = '\''payment_success'\'' AND timestamp >= NOW() - INTERVAL '\''1 hour'\'') as payments;"'
```

После добавления:
```bash
source ~/.zshrc
railway-stats  # Общая статистика
railway-24h    # За 24 часа
railway-1h     # За 1 час
```

---

## 🔒 Безопасность

⚠️ **НЕ КОММИТЬТЕ** этот файл с паролями в Git!  
⚠️ Пароль БД уже в `.env` который в `.gitignore`

---

## 📞 Быстрая справка

| Команда | Описание |
|---------|----------|
| `railway-stats` | Общее количество пользователей и оплат |
| `railway-24h` | Новые пользователи и оплаты за 24 часа |
| `railway-1h` | Новые пользователи и оплаты за 1 час |
| `npm run quick-stats` | ⚠️ Может подключаться к локальной БД |
| `npm run analytics` | ⚠️ Может подключаться к локальной БД |

---

## 🎓 Для AI помощника

### Чек-лист перед запуском статистики:

- [ ] Проверить `DATABASE_URL` в `.env`
- [ ] Протестировать подключение через `psql`
- [ ] Убедиться что видно ~1000+ пользователей
- [ ] Использовать прямые SQL запросы вместо TypeORM
- [ ] НЕ доверять npm скриптам без проверки подключения

### Если пользователь спрашивает про статистику БД:

1. **СНАЧАЛА** проверь реальное подключение
2. **ПОТОМ** делай SQL запросы
3. **НЕ** запускай TypeORM скрипты без проверки
4. **ВСЕГДА** показывай результаты из Railway, не из локальной БД

---

✅ **Этот гайд решает проблему раз и навсегда!**
