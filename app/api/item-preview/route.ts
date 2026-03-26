import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 45;

type Payload = {
  beforeImage?: string;
  afterImage?: string;
  theme?: string;
  item?: {
    name?: string;
    category?: string;
    placement?: string;
    reason?: string;
  };
};

function stripDataUrl(value: string) {
  return value.includes(',') ? value.split(',')[1] : value;
}

function extractMimeType(dataUrl: string) {
  const m = dataUrl.match(/^data:([^;]+);base64,/i);
  return m?.[1] || 'image/jpeg';
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isDataUrl(value: string) {
  return /^data:[^;]+;base64,/i.test(value);
}

function isProbablyBase64(value: string) {
  if (!value) return false;
  return /^[A-Za-z0-9+/=\r\n]+$/.test(value) && value.length > 64;
}

function resolveInlineImagePart(image: string) {
  if (isDataUrl(image)) {
    return {
      mimeType: extractMimeType(image),
      data: stripDataUrl(image),
    };
  }

  if (isProbablyBase64(image)) {
    return {
      mimeType: 'image/jpeg',
      data: stripDataUrl(image),
    };
  }

  return null;
}

async function fetchRemoteImageAsInlinePart(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch source image: ${response.status}`);
    }
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      mimeType,
      data: buffer.toString('base64'),
    };
  } finally {
    clearTimeout(timer);
  }
}

type InlineImagePart = { mimeType: string; data: string };

async function toInlineImagePart(image?: string): Promise<InlineImagePart | null> {
  if (!image) return null;
  const inline = resolveInlineImagePart(image);
  if (inline) return inline;
  if (isHttpUrl(image)) return fetchRemoteImageAsInlinePart(image);
  return null;
}

function buildItemPrompt(theme: string, item: Payload['item']) {
  return `
Use the provided room image as the ONLY visual reference.
Generate ONE isolated product photo for the exact object below.

Goal:
The image must look like a clean product shot of the exact object that appears in the room.
Do not create a similar substitute. Do not create a room scene. Do not create a collage.

Rules:
1) Preserve silhouette, proportions, materials, texture, and color cues from the room.
2) Keep the object centered, complete, and clearly recognizable.
3) Use a pure white or very light warm-neutral studio background.
4) Soft studio lighting only.
5) No text, no labels, no numbers, no arrows, no borders, no boxes, no frames.
6) No walls, no floor, no furniture, no windows, no architecture.
7) Only one item in the image.

Theme context: ${theme || '日式原木风'}

Shopping item:
- name: ${item?.name || '商品'}
- category: ${item?.category || 'Functional accessories'}
- placement: ${item?.placement || '放在合适位置'}
- reason: ${item?.reason || '提升空间完成度'}
`.trim();
}

async function generatePreviewImage(images: string[], prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY (or GOOGLE_API_KEY)');
  }

  const imageParts = await Promise.all(images.map((image) => toInlineImagePart(image)));
  const validImageParts = imageParts.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof toInlineImagePart>>>[];
  if (validImageParts.length === 0) {
    throw new Error('Unsupported image format');
  }

  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image-preview';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              ...validImageParts.map((imagePart) => ({
                inline_data: {
                  mime_type: imagePart.mimeType,
                  data: imagePart.data,
                },
              })),
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['IMAGE'],
        },
      }),
    }
  );

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error?.message || result?.error || `Gemini ${response.status}`);
  }

  const parts = result?.candidates?.[0]?.content?.parts ?? [];
  const imageResultPart = parts.find((part: any) => part?.inline_data || part?.inlineData);
  const inline = imageResultPart?.inline_data || imageResultPart?.inlineData;
  const mimeType = inline?.mime_type || inline?.mimeType || 'image/png';
  const data = inline?.data;

  if (!data) {
    throw new Error('No image data returned from Gemini');
  }

  return `data:${mimeType};base64,${data}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;
    const theme = body.theme || '日式原木风';
    const item = body.item;
    const beforeImage = body.beforeImage || '';
    const afterImage = body.afterImage || '';

    if (!item?.name || !afterImage) {
      return NextResponse.json({ error: 'Missing item or afterImage' }, { status: 400 });
    }

    const references = beforeImage ? [beforeImage, afterImage] : [afterImage];
    const previewImage = await generatePreviewImage(references, buildItemPrompt(theme, item));

    return NextResponse.json({ previewImage });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
