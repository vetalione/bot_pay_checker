# 🚀 Быстрый старт

## 1️⃣ Установка зависимостей

```bash
npm install
```

## 2️⃣ Настройка переменных окружения

Создайте файл `.env` на основе `.env.example`:

```bash
cp .env.example .env
```

**⚠️ ВАЖНО: Добавьте URL ваших видео!**

Откройте `.env` и замените:
```env
VIDEO_URL_1=https://example.com/video1.mp4
VIDEO_URL_2=https://example.com/video2.mp4
VIDEO_URL_3=https://example.com/video3.mp4
```

На реальные URL или Telegram file_id.

### Где взять URL видео?

**Вариант 1: Telegram file_id**
1. Отправьте видео боту [@userinfobot](https://t.me/userinfobot)
2. Скопируйте `file_id`
3. Используйте его в `.env`

**Вариант 2: Прямая ссылка**
Загрузите видео на:
- Google Drive (получите публичную ссылку)
- Dropbox
- Cloudinary
- YouTube (используйте embed URL)

## 3️⃣ Запуск локально

```bash
npm run dev
```

Бот запустится в режиме разработки!

## 4️⃣ Тестирование

1. Откройте Telegram
2. Найдите бота: [@Reels_sale_bot](https://t.me/Reels_sale_bot)
3. Отправьте `/start`
4. Следуйте инструкциям бота

## 5️⃣ Деплой на Railway

Подробные инструкции в файле [DEPLOYMENT.md](./DEPLOYMENT.md)

Кратко:
1. Отправьте код на GitHub:
   ```bash
   git push -u origin main
   ```

2. Зайдите на [railway.app](https://railway.app)

3. Подключите репозиторий `vetalione/bot_pay_checker`

4. Добавьте переменные окружения из `.env`

5. Railway автоматически задеплоит бот! 🎉

## 📝 Структура проекта

```
бот приема платежей/
├── src/
│   ├── index.ts              # Основной файл бота
│   ├── constants.ts          # Константы и сообщения
│   ├── utils.ts              # Вспомогательные функции
│   └── index.webhook.example.ts  # Пример с webhook
├── .env                      # Переменные окружения (НЕ коммитить!)
├── .env.example             # Пример переменных
├── package.json             # Зависимости
├── tsconfig.json            # Конфигурация TypeScript
├── railway.json             # Конфигурация Railway
├── DEPLOYMENT.md            # Инструкции по деплою
├── IMPROVEMENTS.md          # Рекомендации по улучшению
└── README.md                # Общая документация
```

## 🔧 Доступные команды

- `npm run dev` - Запуск в режиме разработки
- `npm run build` - Компиляция TypeScript
- `npm start` - Запуск скомпилированного бота
- `npm run watch` - Компиляция в режиме watch

## 📚 Дополнительно

- **Полная документация**: [README.md](./README.md)
- **Инструкции по деплою**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Улучшения**: [IMPROVEMENTS.md](./IMPROVEMENTS.md)

## ❓ Проблемы?

1. Убедитесь, что все зависимости установлены: `npm install`
2. Проверьте `.env` файл
3. Убедитесь, что URL видео корректные
4. Проверьте, что бот добавлен в канал как админ

## 🎯 Готово!

Теперь ваш бот готов к работе! 🚀
