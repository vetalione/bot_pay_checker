# 📹 Инструкция по загрузке видео на Railway

## Проблема

Видео файлы слишком большие для Git:
- IMG_0539.MOV - 305 MB
- IMG_0562.MOV - 219 MB  
- IMG_0565.MOV - 405 MB

**Итого: ~930 MB** - это превышает лимиты GitHub!

## Решение

Видео файлы НЕ загружаются в Git. Вместо этого их нужно загрузить напрямую на Railway.

## Способ 1: Использовать Telegram file_id (РЕКОМЕНДУЕТСЯ)

### Преимущества:
- ✅ Не нужно загружать файлы на Railway
- ✅ Telegram хранит файлы бесплатно
- ✅ Быстрая отправка (файлы уже на серверах Telegram)

### Как получить file_id:

1. **Отправьте видео боту [@userinfobot](https://t.me/userinfobot)**
   - Найдите бота в Telegram
   - Отправьте первое видео
   - Бот покажет file_id

2. **Скопируйте file_id**
   ```
   Пример: BAACAgIAAxkBAAIC...очень_длинная_строка...
   ```

3. **Повторите для всех 3 видео**

4. **Добавьте в Railway Variables:**
   ```
   VIDEO_URL_1=BAACAgIAAxkBAAIC...
   VIDEO_URL_2=BAACAgIAAxkBAAIC...
   VIDEO_URL_3=BAACAgIAAxkBAAIC...
   ```

✅ **Готово!** Бот будет отправлять видео напрямую из Telegram.

---

## Способ 2: Загрузить файлы на Railway

### Шаг 1: Создайте папку для видео

В Railway создайте Volume (постоянное хранилище):

1. Откройте проект на railway.app
2. Settings → Volumes
3. Create Volume: `/app/videos`

### Шаг 2: Загрузите видео

#### Вариант A: Через Railway CLI

```bash
# Установите Railway CLI
npm install -g @railway/cli

# Войдите
railway login

# Подключитесь к проекту
railway link

# Загрузите видео
railway run -- cp IMG_0539.MOV /app/videos/video1.MOV
railway run -- cp IMG_0562.MOV /app/videos/video2.MOV
railway run -- cp IMG_0565.MOV /app/videos/video3.MOV
```

#### Вариант B: Через SSH

```bash
# Подключитесь к контейнеру Railway
railway shell

# Скачайте видео (например, с Dropbox/Drive)
wget -O /app/videos/video1.MOV "your_video_url_here"
```

### Шаг 3: Обновите переменные окружения

В Railway Variables:
```
VIDEO_URL_1=/app/videos/video1.MOV
VIDEO_URL_2=/app/videos/video2.MOV
VIDEO_URL_3=/app/videos/video3.MOV
```

---

## Способ 3: Загрузить на облачное хранилище

### Google Drive

1. Загрузите видео на Google Drive
2. Сделайте файлы публичными
3. Получите прямые ссылки
4. Добавьте в Railway Variables

### Cloudinary (рекомендуется для видео)

1. Зарегистрируйтесь на [cloudinary.com](https://cloudinary.com) (бесплатно)
2. Upload → Video
3. Загрузите 3 видео
4. Скопируйте URL каждого
5. Добавьте в Railway Variables:
   ```
   VIDEO_URL_1=https://res.cloudinary.com/your_cloud/video/upload/v1/video1.mp4
   VIDEO_URL_2=https://res.cloudinary.com/your_cloud/video/upload/v1/video2.mp4
   VIDEO_URL_3=https://res.cloudinary.com/your_cloud/video/upload/v1/video3.mp4
   ```

---

## Локальное тестирование

Для тестирования на вашем компьютере в `.env` уже настроено:

```env
VIDEO_URL_1=./IMG_0539.MOV
VIDEO_URL_2=./IMG_0562.MOV
VIDEO_URL_3=./IMG_0565.MOV
```

Запустите:
```bash
npm run dev
```

Бот будет отправлять видео с вашего компьютера!

---

## Что выбрать?

| Способ | Простота | Скорость | Надежность | Цена |
|--------|----------|----------|------------|------|
| **Telegram file_id** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | FREE |
| Railway Volumes | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Платно |
| Cloudinary | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | FREE (лимиты) |
| Google Drive | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | FREE |

### Рекомендация: 
**Используйте Telegram file_id** - это самый простой и быстрый способ!

---

## Проверка

После настройки:

1. Зайдите в Telegram
2. Найдите [@Reels_sale_bot](https://t.me/Reels_sale_bot)
3. Отправьте `/start`
4. Проверьте что все 3 видео приходят

✅ Если видео отправляются - всё работает!
❌ Если ошибка - проверьте логи Railway

---

## Важно!

- ⚠️ **НЕ** загружайте видео файлы в Git
- ⚠️ Файлы `.MOV` уже добавлены в `.gitignore`
- ⚠️ Локально файлы останутся на вашем компьютере
- ⚠️ На Railway нужно настроить отдельно

---

## Помощь

Проблемы? Проверьте:
- ✅ Переменные окружения установлены в Railway
- ✅ URL/file_id корректные
- ✅ Файлы доступны (если URL)
- ✅ Бот перезапущен после изменений

Логи Railway покажут ошибки!
