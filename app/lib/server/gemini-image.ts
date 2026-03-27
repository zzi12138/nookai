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

function extractMimeType(dataUrl: string) {
  const m = dataUrl.match(/^data:([^;]+);base64,/i);
  return m?.[1] || 'image/jpeg';
}

function stripDataUrl(value: string) {
  return value.includes(',') ? value.split(',')[1] : value;
}

type InlineImagePart = { mimeType: string; data: string };

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

export async function toInlineImagePart(image?: string): Promise<InlineImagePart | null> {
  if (!image) return null;
  const inline = resolveInlineImagePart(image);
  if (inline) return inline;
  if (isHttpUrl(image)) return fetchRemoteImageAsInlinePart(image);
  return null;
}

export async function generateGeminiImageFromReference(
  image: string,
  prompt: string,
  negativePrompt?: string
) {
  return generateGeminiImageFromReferences([image], prompt, negativePrompt);
}

export async function generateGeminiImageFromReferences(
  images: string[],
  prompt: string,
  negativePrompt?: string
) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY (or GOOGLE_API_KEY)');
  }

  const imageParts = await Promise.all(images.map((image) => toInlineImagePart(image)));
  const validImageParts = imageParts.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof toInlineImagePart>> >[];
  if (validImageParts.length === 0) {
    throw new Error('Unsupported image format');
  }

  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image-preview';
  const finalPrompt = negativePrompt
    ? `${prompt}\n\nNegative prompt (must avoid):\n${negativePrompt}`
    : prompt;

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
              { text: finalPrompt },
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
