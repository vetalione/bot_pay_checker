import { GoogleGenerativeAI } from '@google/generative-ai';
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
  reason?: string;
}

// Конфигурация Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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
  expectedCardNumber: string
): Promise<ReceiptValidationResult> {
  try {
    logWithTimestamp('Starting receipt validation with Gemini', { photoUrl });

    // Скачиваем изображение
    const imageBuffer = await downloadImage(photoUrl);

    // Конвертируем в base64
    const base64Image = imageBuffer.toString('base64');

    // Инициализируем модель Gemini Vision
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Формируем промпт для анализа квитанции
    const prompt = `
Проанализируй эту платежную квитанцию и извлеки следующую информацию:

1. Сумма перевода (в рублях)
2. Номер карты получателя (последние 4 цифры или полный номер)
3. Есть ли на квитанции явные признаки мошенничества или фальсификации

Ожидаемые значения:
- Сумма: ${expectedAmount} рублей
- Номер карты получателя: ${expectedCardNumber.slice(-4)} (последние 4 цифры)

Верни ответ СТРОГО в формате JSON:
{
  "amount": <число>,
  "cardNumber": "<строка с последними 4 цифрами>",
  "isFraud": <true/false>,
  "confidence": <число от 0 до 100>
}

Если не можешь распознать какое-то поле, используй null.
Важно: квитанция должна быть РЕАЛЬНОЙ банковской квитанцией с четко видимыми данными.
`;

    // Отправляем запрос к Gemini
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();

    logWithTimestamp('Gemini response received', { textLength: text.length });

    // Парсим JSON ответ
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON from Gemini response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Проверяем результаты
    const validationResult = validateAnalysis(
      analysis,
      expectedAmount,
      expectedCardNumber
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
  expectedCardNumber: string
): ReceiptValidationResult {
  // Проверяем на мошенничество
  if (analysis.isFraud === true) {
    return {
      isValid: false,
      confidence: analysis.confidence || 0,
      reason: 'Обнаружены признаки мошенничества или подделки',
    };
  }

  // Проверяем сумму
  const extractedAmount = analysis.amount;
  if (extractedAmount === null || extractedAmount === undefined) {
    return {
      isValid: false,
      confidence: analysis.confidence || 0,
      reason: 'Не удалось распознать сумму платежа',
    };
  }

  if (Math.abs(extractedAmount - expectedAmount) > 10) {
    return {
      isValid: false,
      confidence: analysis.confidence || 0,
      extractedAmount,
      reason: `Неверная сумма платежа. Ожидается: ${expectedAmount} руб, Найдено: ${extractedAmount} руб`,
    };
  }

  // Проверяем номер карты (последние 4 цифры)
  const extractedCardNumber = analysis.cardNumber;
  const expectedLast4 = expectedCardNumber.replace(/\s/g, '').slice(-4);

  if (extractedCardNumber === null || extractedCardNumber === undefined) {
    return {
      isValid: false,
      confidence: analysis.confidence || 0,
      reason: 'Не удалось распознать номер карты получателя',
    };
  }

  const extractedLast4 = String(extractedCardNumber).replace(/\s/g, '').slice(-4);

  if (extractedLast4 !== expectedLast4) {
    return {
      isValid: false,
      confidence: analysis.confidence || 0,
      extractedCardNumber,
      reason: `Неверный номер карты получателя. Ожидается: *${expectedLast4}, Найдено: *${extractedLast4}`,
    };
  }

  // Проверяем уровень уверенности
  const confidence = analysis.confidence || 0;
  if (confidence < 60) {
    return {
      isValid: false,
      confidence,
      reason: 'Низкое качество квитанции или данные плохо читаются',
    };
  }

  // Все проверки пройдены
  return {
    isValid: true,
    confidence,
    extractedAmount,
    extractedCardNumber,
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
