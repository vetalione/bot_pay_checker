# ❓ Часто задаваемые вопросы (FAQ)

## Общие вопросы

### Как получить токен бота?

Токен уже предоставлен в задании: `<токен бота в .env>`

Если нужно создать нового бота:
1. Найдите [@BotFather](https://t.me/BotFather)
2. Отправьте `/newbot`
3. Следуйте инструкциям
4. Скопируйте токен

### Как получить ID канала?

Текущий ID: `-1002493863348`

Для своего канала:
1. Добавьте бота [@userinfobot](https://t.me/userinfobot) в канал
2. Перешлите любое сообщение из канала боту
3. Он покажет ID канала

### Бот не может создавать invite-ссылки

Убедитесь что:
1. Бот добавлен в канал
2. Бот имеет права администратора
3. У бота есть право "Invite users via link"

Как дать права:
1. Откройте канал
2. Настройки → Администраторы
3. Найдите бота
4. Включите "Invite users via link"

## Технические вопросы

### Ошибка "Cannot find module 'telegraf'"

Запустите:
```bash
npm install
```

### Ошибка компиляции TypeScript

```bash
npm run build
```

Если не помогло:
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Видео не отправляются

**Проверьте формат URL:**

✅ Правильно:
```env
# Telegram file_id
VIDEO_URL_1=BAACAgIAAxkBAAIC...

# Прямая ссылка
VIDEO_URL_1=https://example.com/video.mp4
```

❌ Неправильно:
```env
VIDEO_URL_1=file:///local/path/video.mp4
VIDEO_URL_1=C:\Users\videos\video.mp4
```

**Видео должно быть:**
- Доступно по HTTPS
- Формат: MP4, AVI, MOV
- Размер: до 50 МБ

### Бот не отвечает в продакшене

1. Проверьте логи в Railway:
   - Откройте проект
   - Deployments → View Logs

2. Убедитесь что все переменные окружения установлены

3. Проверьте статус деплоя

### Как проверить что бот запущен?

**Локально:**
```bash
npm run dev
```
Должно появиться: "Bot is running..."

**На Railway:**
1. Откройте проект
2. Deployments → Active
3. Логи должны показывать "Bot is running..."

## Вопросы про функционал

### Можно ли изменить сумму платежа?

Да! В `.env` измените:
```env
PAYMENT_AMOUNT=3000
```

### Как изменить номер карты?

В `.env`:
```env
CARD_NUMBER=1234567890123456
```

### Можно ли добавить больше видео?

Да! Измените код в `src/index.ts`:

1. Добавьте URL в `.env`:
```env
VIDEO_URL_4=https://...
VIDEO_URL_5=https://...
```

2. Обновите массив в `config`:
```typescript
videos: [
  process.env.VIDEO_URL_1!,
  process.env.VIDEO_URL_2!,
  process.env.VIDEO_URL_3!,
  process.env.VIDEO_URL_4!,
  process.env.VIDEO_URL_5!,
]
```

3. Измените условие в функции `sendVideo`:
```typescript
if (videoIndex < 4) { // было 2
  await sendVideo(ctx, videoIndex + 1);
```

### Как изменить время действия ссылки?

В `src/index.ts` в функции `generateInviteLink`:

```typescript
expire_date: Math.floor(Date.now() / 1000) + 86400 // 24 часа

// Для 12 часов:
expire_date: Math.floor(Date.now() / 1000) + 43200

// Для 48 часов:
expire_date: Math.floor(Date.now() / 1000) + 172800
```

### Можно ли разрешить несколько использований ссылки?

Да! В функции `generateInviteLink`:

```typescript
member_limit: 5, // вместо 1
```

### Как добавить проверку квитанции?

См. файл [IMPROVEMENTS.md](./IMPROVEMENTS.md), раздел "Проверка платежных квитанций (OCR)"

## Вопросы про деплой

### Railway выдает ошибку при деплое

**Проверьте:**
1. `package.json` содержит все зависимости
2. `railway.json` настроен правильно
3. Все переменные окружения добавлены
4. Node.js версия совместима (требуется >= 18)

### Как посмотреть логи на Railway?

1. Откройте проект на railway.app
2. Выберите деплой
3. Вкладка "Logs"

### Бот работает локально, но не на Railway

**Причины:**
1. Не добавлены переменные окружения
2. Порт не настроен (Railway устанавливает автоматически)
3. Webhook не настроен (можно пока использовать polling)

**Решение:**
Убедитесь в `src/index.ts`:
```typescript
const PORT = process.env.PORT || 3000;
```

### Можно ли использовать бесплатный план Railway?

Да! Бот потребляет минимум ресурсов.

Лимиты бесплатного плана:
- $5 в месяц (обычно хватает)
- 500 часов работы

## Безопасность

### Случайно закоммитил .env файл

**Срочно:**
1. Удалите коммит:
```bash
git reset HEAD~1
git push --force
```

2. **Смените токен бота** через [@BotFather](https://t.me/BotFather)

3. Обновите `.env` с новым токеном

### Как защитить токен бота?

1. **НЕ** коммитьте `.env`
2. Проверьте `.gitignore` содержит `.env`
3. Используйте переменные окружения на Railway
4. Периодически меняйте токен

### Кто-то спамит бота

Добавьте rate limiting (см. [IMPROVEMENTS.md](./IMPROVEMENTS.md))

## Развитие бота

### Как добавить текстовые сообщения между видео?

В функции `sendVideo` добавьте:
```typescript
await ctx.reply('📺 Сейчас будет следующее видео...');
await delay(2000);
await ctx.replyWithVideo(videoUrl, {...});
```

### Можно ли сохранять данные пользователей?

Да! Рекомендуется использовать базу данных. См. [IMPROVEMENTS.md](./IMPROVEMENTS.md), раздел "База данных"

### Как добавить статистику?

Пример команды для админов:
```typescript
bot.command('stats', async (ctx) => {
  const stats = {
    total: userStates.size,
    // другие метрики
  };
  await ctx.reply(`Статистика:\nВсего: ${stats.total}`);
});
```

### Можно ли принимать другие способы оплаты?

Да! Можно интегрировать:
- Telegram Payments (Stripe, ЮKassa)
- Криптовалюту
- Другие платежные системы

## Контакты и поддержка

Нашли баг? [Создайте issue](https://github.com/vetalione/bot_pay_checker/issues)

Хотите улучшить бота? [Создайте pull request](https://github.com/vetalione/bot_pay_checker/pulls)
