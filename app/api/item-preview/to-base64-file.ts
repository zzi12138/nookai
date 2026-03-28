import { toFile } from 'openai';

/**
 * Convert a raw base64 string (no data URL prefix) into an Uploadable
 * that the OpenAI SDK accepts for images.edit().
 */
export function toBase64File(base64: string, filename = 'image.png') {
  const buffer = Buffer.from(base64, 'base64');
  return toFile(buffer, filename, { type: 'image/png' });
}
