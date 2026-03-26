type SeedreamProvider = 'operator' | 'ark';

export type SeedreamRequest = {
  prompt: string;
  images: string[];
  maxImages?: number;
  size?: string;
  provider?: SeedreamProvider;
};

export type SeedreamResult = {
  imageUrls: string[];
  provider: SeedreamProvider;
  raw: any;
};

type SeedreamConfig = {
  provider: SeedreamProvider;
  apiKey: string;
  baseUrl: string;
  endpoint: string;
  model: string;
  size: string;
};

function firstDefined(...values: Array<string | undefined | null>) {
  return values.find((value) => Boolean(value)) || '';
}

function normalizeProvider(value?: string | null): SeedreamProvider | undefined {
  const v = String(value || '').toLowerCase().trim();
  if (v === 'ark') return 'ark';
  if (v === 'operator') return 'operator';
  return undefined;
}

function stripDataUrl(value: string) {
  return value.includes(',') ? value.split(',')[1] : value;
}

function isDataUrl(value: string) {
  return /^data:[^;]+;base64,/i.test(value);
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isProbablyBase64(value: string) {
  return /^[A-Za-z0-9+/=\r\n]+$/.test(value) && value.length > 64;
}

function getSeedreamConfig(providerHint?: SeedreamProvider): SeedreamConfig {
  const forced = normalizeProvider(process.env.SEEDREAM_PROVIDER);
  const explicit = providerHint || forced;

  const hasArk = Boolean(process.env.ARK_API_KEY);
  const hasOperator = Boolean(
    process.env.VOLCENGINE_API_KEY || process.env.LAS_API_KEY || process.env.API_KEY
  );

  const provider: SeedreamProvider =
    explicit ||
    (hasArk && !hasOperator ? 'ark' : 'operator');

  const apiKey =
    provider === 'ark'
      ? firstDefined(process.env.ARK_API_KEY, process.env.VOLCENGINE_API_KEY, process.env.LAS_API_KEY, process.env.API_KEY)
      : firstDefined(process.env.VOLCENGINE_API_KEY, process.env.LAS_API_KEY, process.env.API_KEY, process.env.ARK_API_KEY);

  if (!apiKey) {
    throw new Error(
      provider === 'ark'
        ? 'Missing ARK_API_KEY (or VOLCENGINE_API_KEY / LAS_API_KEY)'
        : 'Missing VOLCENGINE_API_KEY (or LAS_API_KEY / ARK_API_KEY)'
    );
  }

  const baseUrl =
    provider === 'ark'
      ? firstDefined(process.env.ARK_BASE_URL, 'https://ark.cn-beijing.volces.com')
      : firstDefined(
          process.env.VOLCENGINE_BASE_URL,
          process.env.LAS_BASE_URL,
          'https://operator.las.cn-shanghai.volces.com'
        );

  const endpoint =
    provider === 'ark'
      ? `${baseUrl.replace(/\/$/, '')}/api/v3/images/generations`
      : `${baseUrl.replace(/\/$/, '')}/api/v1/images/generations`;

  const model =
    process.env.SEEDREAM_MODEL ||
    process.env.VOLCENGINE_MODEL ||
    process.env.ARK_IMAGE_MODEL ||
    'doubao-seedream-4-5-251128';

  const size = process.env.SEEDREAM_SIZE || '2048x2048';

  return { provider, apiKey, baseUrl, endpoint, model, size };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 85000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeImages(images: string[]) {
  return images
    .map((image) => image.trim())
    .filter(Boolean)
    .map((image) => (isDataUrl(image) ? image : isHttpUrl(image) ? image : isProbablyBase64(image) ? `data:image/jpeg;base64,${stripDataUrl(image)}` : image));
}

function extractImageUrls(result: any): string[] {
  const data = result?.data;
  if (Array.isArray(data)) {
    return data
      .map((item) => item?.url || item?.image_url || item?.imageUrl || item?.b64_json || item?.base64)
      .filter(Boolean)
      .map((item) => String(item));
  }

  if (typeof data === 'string') {
    return [data];
  }

  const single =
    result?.url ||
    result?.image_url ||
    result?.imageUrl ||
    result?.output?.url ||
    result?.output?.image_url ||
    result?.output?.imageUrl ||
    result?.result?.url ||
    result?.result?.image_url ||
    result?.result?.imageUrl;

  return single ? [String(single)] : [];
}

export async function generateSeedreamImages(request: SeedreamRequest): Promise<SeedreamResult> {
  const config = getSeedreamConfig(request.provider);
  const images = normalizeImages(request.images).slice(0, 4);

  if (images.length === 0) {
    throw new Error('Seedream requires at least one reference image');
  }

  const maxImages = Math.max(1, Math.min(12, Math.round(request.maxImages || 1)));
  const response = await fetchWithTimeout(
    config.endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        prompt: request.prompt,
        image: images.length === 1 ? images[0] : images,
        size: request.size || config.size,
        response_format: 'url',
        watermark: false,
        sequential_image_generation: maxImages > 1 ? 'auto' : 'disabled',
        sequential_image_generation_options:
          maxImages > 1 ? { max_images: maxImages } : undefined,
      }),
    },
    maxImages > 1 ? 90000 : 75000
  );

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = result?.error?.message || result?.error || result?.message || `Seedream ${response.status}`;
    throw new Error(String(reason));
  }

  const imageUrls = extractImageUrls(result);
  if (imageUrls.length === 0) {
    throw new Error('Seedream returned no image URLs');
  }

  return { imageUrls, provider: config.provider, raw: result };
}

