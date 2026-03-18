export type GenerateImageParams = {
  image: string;
  prompt: string;
  negativePrompt?: string;
  strength?: number;
  nanobananaModel?: string;
  geminiModel?: string;
};

export type GenerateImageResult = {
  imageUrl: string;
  provider: 'nanobanana' | 'gemini';
};

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

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/i);
  if (!match) return null;
  return {
    mimeType: match[1] || 'image/jpeg',
    data: match[2] || '',
  };
}

function stripDataUrl(value: string) {
  return value.includes(',') ? value.split(',')[1] : value;
}

function bufferToBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString('base64');
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function resolveImageForGemini(image: string) {
  if (isDataUrl(image)) {
    const parsed = parseDataUrl(image);
    if (!parsed) throw new Error('Invalid image data url');
    return parsed;
  }

  if (isHttpUrl(image)) {
    const response = await fetchWithTimeout(image, { method: 'GET' }, 30000);
    if (!response.ok) {
      throw new Error(`Failed to fetch source image: ${response.status}`);
    }

    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    const data = bufferToBase64(await response.arrayBuffer());
    return { mimeType, data };
  }

  if (isProbablyBase64(image)) {
    return { mimeType: 'image/jpeg', data: stripDataUrl(image) };
  }

  throw new Error('Unsupported image input for Gemini');
}

function pickNanobananaUrl(result: any) {
  return (
    result?.url ||
    result?.imageUrl ||
    result?.data?.url ||
    result?.data?.imageUrl ||
    result?.data?.[0]?.url ||
    result?.result?.url ||
    result?.result?.imageUrl ||
    result?.output?.url ||
    result?.output?.imageUrl ||
    result?.output?.[0]?.url ||
    ''
  );
}

function pickProviders() {
  const hasNano = Boolean(process.env.NANOBANANA_API_KEY);
  const hasGemini = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  const forced = (process.env.IMAGE_PROVIDER || '').toLowerCase().trim();

  if (forced === 'nanobanana') {
    if (!hasNano) throw new Error('IMAGE_PROVIDER=nanobanana but NANOBANANA_API_KEY is missing');
    return ['nanobanana'] as const;
  }

  if (forced === 'gemini') {
    if (!hasGemini) throw new Error('IMAGE_PROVIDER=gemini but GEMINI_API_KEY/GOOGLE_API_KEY is missing');
    return ['gemini'] as const;
  }

  if (hasNano && hasGemini) {
    return ['nanobanana', 'gemini'] as const;
  }

  if (hasNano) return ['nanobanana'] as const;
  if (hasGemini) return ['gemini'] as const;

  throw new Error(
    'No image provider key found. Set NANOBANANA_API_KEY or GEMINI_API_KEY/GOOGLE_API_KEY.'
  );
}

async function callNanobanana(params: GenerateImageParams): Promise<GenerateImageResult> {
  const apiKey = process.env.NANOBANANA_API_KEY;
  if (!apiKey) {
    throw new Error('Missing NANOBANANA_API_KEY');
  }

  const endpoint = process.env.NANOBANANA_BASE_URL || 'https://api.nanobanana.ai/v1/generate';
  const imagePayload = isDataUrl(params.image) ? stripDataUrl(params.image) : params.image;

  const response = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: params.nanobananaModel || process.env.NANOBANANA_MODEL || 'nb2-interior-pro',
        image: imagePayload,
        prompt: params.prompt,
        negative_prompt: params.negativePrompt || '',
        strength: typeof params.strength === 'number' ? params.strength : 0.65,
      }),
    },
    45000
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const reason = result?.error || result?.message || `Nanobanana ${response.status}`;
    throw new Error(String(reason));
  }

  const imageUrl = pickNanobananaUrl(result);
  if (!imageUrl) throw new Error('Nanobanana returned no imageUrl');

  return { imageUrl, provider: 'nanobanana' };
}

async function callGemini(params: GenerateImageParams): Promise<GenerateImageResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY (or GOOGLE_API_KEY)');
  }

  const model = params.geminiModel || process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image-preview';
  const image = await resolveImageForGemini(params.image);

  const response = await fetchWithTimeout(
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
              { text: params.prompt },
              {
                inline_data: {
                  mime_type: image.mimeType,
                  data: image.data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['IMAGE'],
        },
      }),
    },
    45000
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const reason = result?.error?.message || result?.error || `Gemini ${response.status}`;
    throw new Error(String(reason));
  }

  const parts = result?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part: any) => part?.inline_data || part?.inlineData);
  const inline = imagePart?.inline_data || imagePart?.inlineData;
  const mimeType = inline?.mime_type || inline?.mimeType || 'image/png';
  const data = inline?.data;

  if (!data) throw new Error('Gemini returned no image data');

  return { imageUrl: `data:${mimeType};base64,${data}`, provider: 'gemini' };
}

export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
  const providers = pickProviders();
  const errors: string[] = [];

  for (const provider of providers) {
    try {
      if (provider === 'nanobanana') return await callNanobanana(params);
      return await callGemini(params);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${provider}: ${message}`);
    }
  }

  throw new Error(errors.join(' | ') || 'Image generation failed');
}
