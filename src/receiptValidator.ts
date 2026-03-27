import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { logWithTimestamp } from './utils';

// Интерфейс результата проверки
export interface ReceiptValidationResult {
  isValid: boolean;
  confidence: number;
  extractedAmount?: number;
  extractedCardNumber?: string;
  imageDescription?: string;
  reason?: string;
  isReceipt?: boolean;
  isFraud?: boolean;
}
/**
 * Проверяет платежную квитанцию с использованием Gemini Vision API
 * @param photoUrl - URL фото квитанции
 * @param expectedAmount - ожидаемая сумма платежа
 * @param expectedCardNumber - ожидаемый номер карты
 * @returns результат проверки
 */
export async function validateReceiptWithGemini(
  photoUrl: string,
  expectedAmount: number,
  expectedCardNumber: string,
  currency: 'RUB' | 'UAH' = 'RUB'
): Promise<ReceiptValidationResult> {
  try {
    logWithTimestamp('Starting receipt validation with Gemini', { photoUrl });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Скачиваем изображение
    const imageBuffer = await downloadImage(photoUrl);

    // Конвертируем в base64
    const base64Image = imageBuffer.toString('base64');

    // Формируем промпт для анализа квитанции
    const currencySymbol = currency === 'UAH' ? '₴' : '₽';
    const prompt = `
Проверь платежную квитанцию:

Ожидаю: ${expectedAmount}${currencySymbol} на карту *${expectedCardNumber.slice(-4)}

ВАЖНО - ЭТО НОРМАЛЬНО (НЕ мошенничество):
- Скриншот из банка
- Любая дата (даже старая или будущая)
- Разные валюты в одной квитанции (например: перевод в рублях, но валюта зачисления USD - это норма для мультивалютных карт!)
- Любые часовые пояса

МОШЕННИЧЕСТВО только если есть ВИЗУАЛЬНЫЕ признаки:
- Следы фотошопа (артефакты, размытия, нечеткие края)
- Нестандартные шрифты
- Видимые следы редактирования

Верни JSON (ТОЛЬКО JSON, без текста):
{
  "imageDescription": "краткое описание",
  "isReceipt": true/false,
  "amount": число или null,
  "cardNumber": "последние 4 цифры" или null,
  "isFraud": true/false,
  "confidence": 0-100,
  "reason": "детальное описание ВИЗУАЛЬНЫХ признаков подделки" или null
}
`;

    // Отправляем прямой HTTP запрос к Gemini API v1
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        topP: 0.8,
        topK: 40,
      }
    };

    logWithTimestamp('Sending request to Gemini API v1', { apiUrl: apiUrl.replace(apiKey, '***') });

    // Retry механизм с exponential backoff для 503 ошибок
    let response;
    let lastError;
    const maxRetries = 3;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        response = await axios.post(apiUrl, requestBody, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        });
        break; // Успешный запрос - выходим из цикла
      } catch (error: any) {
        lastError = error;
        
        // Логируем детали ошибки
        if (error.response) {
          logWithTimestamp('Gemini API error response', { 
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data 
          });
        }
        
        if (error.response?.status === 503 && attempt < maxRetries - 1) {
          const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          logWithTimestamp(`Gemini API 503 error, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`, {});
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          throw error; // Другая ошибка или последняя попытка
        }
      }
    }
    
    if (!response) {
      throw lastError;
    }

    // Проверяем наличие ответа
    const finishReason = response.data?.candidates?.[0]?.finishReason;
    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      logWithTimestamp('Invalid Gemini API response', { 
        finishReason, 
        fullResponse: JSON.stringify(response.data, null, 2) 
      });
      
      if (finishReason === 'MAX_TOKENS') {
        throw new Error('Gemini response was cut off due to token limit. Try with a smaller image or simpler prompt.');
      }
      
      throw new Error('Invalid response format from Gemini API');
    }
    logWithTimestamp('Gemini response received', { textLength: text.length, fullText: text });

    // Парсим JSON ответ - ищем JSON объект в тексте
    let analysis;
    try {
      // Сначала пробуем найти JSON с помощью регулярки
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
        logWithTimestamp('Parsed JSON from Gemini', analysis);
      } else {
        // Если не нашли, пробуем распарсить весь текст
        analysis = JSON.parse(text);
        logWithTimestamp('Parsed JSON directly', analysis);
      }
    } catch (parseError) {
      logWithTimestamp('Failed to parse JSON from Gemini', { text, parseError });
      
      // Если не удалось распарсить - возвращаем дефолтный ответ с описанием проблемы
      return {
        isValid: false,
        confidence: 0,
        reason: `⚠️ Не удалось обработать ответ AI.\n\nОтвет AI: ${text.substring(0, 300)}...\n\nПопробуйте отправить более четкое фото квитанции.`,
      };
    }

    // Проверяем результаты
    const validationResult = validateAnalysis(
      analysis,
      expectedAmount,
      expectedCardNumber,
      currency
    );

    logWithTimestamp('Validation completed', validationResult);

    return validationResult;
  } catch (error) {
    logWithTimestamp('Error validating receipt', error);
    
    // В случае ошибки API возвращаем отрицательный результат
    return {
      isValid: false,
      confidence: 0,
      reason: `Ошибка при проверке квитанции: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Скачивает изображение по URL
 * @param url - URL изображения
 * @returns буфер с изображением
 */
async function downloadImage(url: string): Promise<Buffer> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });

    return Buffer.from(response.data);
  } catch (error) {
    throw new Error(`Failed to download image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Проверяет результаты анализа от Gemini
 * @param analysis - результат анализа от Gemini
 * @param expectedAmount - ожидаемая сумма
 * @param expectedCardNumber - ожидаемый номер карты
 * @returns результат валидации
 */
function validateAnalysis(
  analysis: any,
  expectedAmount: number,
  expectedCardNumber: string,
  currency: 'RUB' | 'UAH'
): ReceiptValidationResult {
  // Проверяем, является ли это вообще квитанцией
  if (analysis.isReceipt === false) {
    const description = analysis.imageDescription || 'изображение не является квитанцией';
    return {
      isReceipt: false,
      isValid: false,
      confidence: 0,
      reason: `❌ Это не платежная квитанция.\n\n🔍 Что я вижу на фото:\n${description}`,
    };
  }

  // Проверяем на мошенничество
  if (analysis.isFraud === true) {
    const fraudDetails = analysis.reason || 'Обнаружены визуальные признаки подделки';
    return {
      isReceipt: true,
      isFraud: true,
      isValid: false,
      confidence: analysis.confidence || 0,
      imageDescription: analysis.imageDescription,
      reason: `⚠️ Обнаружены признаки мошенничества или подделки квитанции!\n\n🔍 Детали:\n${fraudDetails}`,
    };
  }

  // Проверяем сумму
  const extractedAmount = analysis.amount;
  if (extractedAmount === null || extractedAmount === undefined) {
    const description = analysis.imageDescription || 'квитанция';
    return {
      isReceipt: true,
      isValid: false,
      confidence: analysis.confidence || 0,
      reason: `❌ Не удалось распознать сумму платежа.\n\n🔍 Что я вижу:\n${description}\n\nПожалуйста, убедитесь, что сумма перевода четко видна на квитанции.`,
    };
  }

  if (Math.abs(extractedAmount - expectedAmount) > 10) {
    return {
      isReceipt: true,
      isValid: false,
      confidence: analysis.confidence || 0,
      extractedAmount,
      imageDescription: analysis.imageDescription,
      reason: `❌ Неверная сумма платежа.

💰 Ожидается: ${expectedAmount} ${currency === 'UAH' ? '₴' : '₽'}
💳 Найдено на квитанции: ${extractedAmount} ${currency === 'UAH' ? '₴' : '₽'}`,
    };
  }

  // Проверяем номер карты (последние 4 цифры)
  const extractedCardNumber = analysis.cardNumber;
  const expectedLast4 = expectedCardNumber.replace(/\s/g, '').slice(-4);

  if (extractedCardNumber === null || extractedCardNumber === undefined) {
    return {
      isReceipt: true,
      isValid: false,
      confidence: analysis.confidence || 0,
      imageDescription: analysis.imageDescription,
      reason: `❌ Не удалось распознать номер карты получателя.\n\nПожалуйста, убедитесь, что номер карты четко виден на квитанции.`,
    };
  }

  const extractedLast4 = String(extractedCardNumber).replace(/\s/g, '').slice(-4);

  if (extractedLast4 !== expectedLast4) {
    return {
      isReceipt: true,
      isValid: false,
      confidence: analysis.confidence || 0,
      extractedCardNumber,
      imageDescription: analysis.imageDescription,
      reason: `❌ Неверный номер карты получателя.\n\n🎯 Ожидается карта: *${expectedLast4}\n📱 Найдено на квитанции: *${extractedLast4}`,
    };
  }

  // Проверяем уровень уверенности
  const confidence = analysis.confidence || 0;
  if (confidence < 60) {
    return {
      isReceipt: true,
      isValid: false,
      confidence,
      imageDescription: analysis.imageDescription,
      reason: 'Низкое качество квитанции или данные плохо читаются',
    };
  }

  // Все проверки пройдены
  return {
    isReceipt: true,
    isFraud: false,
    isValid: true,
    confidence,
    extractedAmount,
    extractedCardNumber,
    imageDescription: analysis.imageDescription,
  };
}

/**
 * Альтернативная упрощенная проверка (fallback)
 * Используется если Gemini API недоступен
 */
export async function validateReceiptSimple(
  photoUrl: string,
  expectedAmount: number,
  expectedCardNumber: string
): Promise<ReceiptValidationResult> {
  logWithTimestamp('Using simple validation (fallback)', { photoUrl });

  // Простая проверка - всегда возвращает true
  // В реальности здесь можно добавить базовую OCR проверку
  return {
    isValid: true,
    confidence: 50,
    reason: 'Используется упрощенная проверка. Для полной проверки требуется Gemini API.',
  };
}
