import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Payload = {
  image?: string;
  theme?: string;
};

type Category =
  | 'Ambient lighting'
  | 'Bedding & soft textiles'
  | 'Floor soft furnishings'
  | 'Wall decor'
  | 'Plants'
  | 'Functional accessories';

type Necessity = 'Must-have' | 'Recommended' | 'Optional';

type RawItem = {
  name?: string;
  quantity?: number;
  priceMin?: number;
  priceMax?: number;
  placement?: string;
  necessity?: string;
  reason?: string;
  anchor?: {
    x?: number;
    y?: number;
    confidence?: number;
  };
};

type NormalizedItem = {
  id: number;
  name: string;
  category: Category;
  quantity: number;
  priceMin: number;
  priceMax: number;
  priceRange: string;
  placement: string;
  necessity: Necessity;
  reason: string;
  imageTarget: {
    x: number;
    y: number;
    confidence: number;
    hasAnchor: boolean;
    hasPoint: boolean;
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function safeParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

function normalizeNecessity(raw?: string): Necessity {
  const v = (raw || '').toLowerCase();
  if (v.includes('must') || v.includes('必')) return 'Must-have';
  if (v.includes('optional') || v.includes('可选')) return 'Optional';
  return 'Recommended';
}

function inferCategory(name: string): Category {
  const n = name.toLowerCase();
  if (
    n.includes('floor lamp') ||
    n.includes('table lamp') ||
    n.includes('desk lamp') ||
    n.includes('灯') ||
    n.includes('light strip') ||
    n.includes('string light')
  ) {
    return 'Ambient lighting';
  }
  if (
    n.includes('bedding') ||
    n.includes('duvet') ||
    n.includes('pillow') ||
    n.includes('blanket') ||
    n.includes('床品') ||
    n.includes('抱枕') ||
    n.includes('毯')
  ) {
    return 'Bedding & soft textiles';
  }
  if (n.includes('rug') || n.includes('carpet') || n.includes('地毯')) {
    return 'Floor soft furnishings';
  }
  if (n.includes('wall art') || n.includes('poster') || n.includes('挂画') || n.includes('装饰画')) {
    return 'Wall decor';
  }
  if (n.includes('plant') || n.includes('greenery') || n.includes('绿植')) {
    return 'Plants';
  }
  return 'Functional accessories';
}

function compactName(raw?: string) {
  const name = (raw || '').trim();
  if (!name) return '';
  if (name.length <= 28) return name;
  return `${name.slice(0, 28)}...`;
}

function normalizePlacement(raw?: string) {
  const value = (raw || '').trim();
  return value || 'Place in a visible but unobstructed area';
}

function normalizeReason(raw?: string) {
  const value = (raw || '').trim();
  return value || 'Improves visual quality quickly';
}

function narrowRangeByName(name: string) {
  const n = name.toLowerCase();

  if (n.includes('floor lamp') || n.includes('落地灯')) return { min: 159, max: 239 };
  if (n.includes('desk lamp') || n.includes('table lamp') || n.includes('台灯')) return { min: 69, max: 119 };
  if (n.includes('light strip') || n.includes('string light') || n.includes('灯带')) return { min: 49, max: 99 };

  if (n.includes('rug') || n.includes('carpet') || n.includes('地毯')) return { min: 199, max: 299 };

  if (n.includes('bedding') || n.includes('duvet') || n.includes('床品')) return { min: 179, max: 259 };
  if (n.includes('pillow') || n.includes('抱枕')) return { min: 49, max: 99 };
  if (n.includes('blanket') || n.includes('throw') || n.includes('毯')) return { min: 79, max: 149 };

  if (n.includes('wall art') || n.includes('poster') || n.includes('挂画')) return { min: 79, max: 129 };

  if (n.includes('plant') || n.includes('绿植')) return { min: 89, max: 169 };

  if (n.includes('projector') || n.includes('投影')) return { min: 499, max: 899 };
  if (n.includes('stand') || n.includes('支架')) return { min: 79, max: 169 };
  if (n.includes('side table') || n.includes('边几')) return { min: 129, max: 229 };
  if (n.includes('tray') || n.includes('收纳')) return { min: 39, max: 89 };

  return { min: 99, max: 179 };
}

function normalizePrice(name: string, minRaw?: number, maxRaw?: number) {
  const preset = narrowRangeByName(name);

  if (!Number.isFinite(minRaw) || !Number.isFinite(maxRaw) || (maxRaw as number) <= (minRaw as number)) {
    return preset;
  }

  let min = Math.round(clamp(Number(minRaw), 39, 4999));
  let max = Math.round(clamp(Number(maxRaw), min + 20, min + 180));

  const span = max - min;
  if (span > 120) {
    max = min + 120;
  }

  if (min < preset.min - 40 || max > preset.max + 120) {
    return preset;
  }

  return { min, max };
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

function getPrompt(theme: string) {
  return `
You are a visual purchase planner for renters.

Analyze the CURRENT generated room image and output only 4-6 concrete purchasable items that are clearly visible and actionable.

Strict rules:
1) Output concrete objects only. No abstract concepts.
2) Items must come from what is visible in this exact image.
3) Do not hallucinate missing objects.
4) For each item, provide anchor x/y (0-100) and confidence (0-1).
5) If uncertain, lower confidence below 0.55.
6) Keep price ranges narrow and realistic.

Preferred categories:
- Ambient lighting
- Bedding & soft textiles
- Floor soft furnishings
- Wall decor
- Plants
- Functional accessories

Style context: ${theme || 'Japandi'}

Return JSON only with this shape:
{
  "summary": "one short sentence",
  "items": [
    {
      "name": "warm floor lamp",
      "quantity": 1,
      "priceMin": 159,
      "priceMax": 239,
      "placement": "right side of sofa",
      "necessity": "Must-have|Recommended|Optional",
      "reason": "short sentence",
      "anchor": { "x": 72, "y": 58, "confidence": 0.82 }
    }
  ]
}
`.trim();
}

function dedupeByName(items: RawItem[]) {
  const seen = new Set<string>();
  const out: RawItem[] = [];

  for (const item of items) {
    const key = compactName(item.name).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '').slice(0, 16);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

async function analyzeItems(image: string, theme: string, apiKey: string) {
  const inline = resolveInlineImagePart(image);
  const imagePart = inline
    ? inline
    : isHttpUrl(image)
      ? await fetchRemoteImageAsInlinePart(image)
      : null;

  if (!imagePart) {
    throw new Error('Unsupported image format');
  }

  const models = [process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash', 'gemini-2.5-flash-lite']
    .filter((m, i, arr) => arr.indexOf(m) === i);

  let lastError = 'Guide analysis failed';

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 90000);

      try {
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
                    { text: getPrompt(theme) },
                    {
                      inline_data: {
                        mime_type: imagePart.mimeType,
                        data: imagePart.data,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.15,
                responseMimeType: 'application/json',
              },
            }),
            signal: controller.signal,
          }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          lastError = result?.error?.message || result?.error || `Analysis failed (${response.status})`;
          if ((response.status === 429 || response.status >= 500) && attempt < 2) {
            await sleep(900 * attempt);
            continue;
          }
          throw new Error(lastError);
        }

        const parts = result?.candidates?.[0]?.content?.parts ?? [];
        const text = parts.map((p: any) => p?.text || '').join('\n').trim();
        const parsed = safeParseJson<{ summary?: string; items?: RawItem[] }>(text);

        if (!parsed?.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
          lastError = 'No items detected from image';
          if (attempt < 2) {
            await sleep(900 * attempt);
            continue;
          }
          throw new Error(lastError);
        }

        return {
          summary: (parsed.summary || '').trim(),
          items: dedupeByName(parsed.items),
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        if (attempt < 2) {
          await sleep(900 * attempt);
          continue;
        }
      } finally {
        clearTimeout(timer);
      }
    }
  }

  throw new Error(lastError);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;
    const image = body.image || '';
    const theme = body.theme || 'Japandi';

    if (!image) {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing GEMINI_API_KEY (or GOOGLE_API_KEY)' },
        { status: 500 }
      );
    }

    const analyzed = await analyzeItems(image, theme, apiKey);

    const normalized: NormalizedItem[] = analyzed.items
      .slice(0, 8)
      .map((item, index) => {
        const id = index + 1;
        const name = compactName(item.name);
        if (!name) return null;

        const category = inferCategory(name);
        const necessity = normalizeNecessity(item.necessity);
        const quantity = Math.round(clamp(Number(item.quantity || 1), 1, 3));
        const price = normalizePrice(name, item.priceMin, item.priceMax);

        const rawX = Number(item.anchor?.x);
        const rawY = Number(item.anchor?.y);
        const hasAnchor = Number.isFinite(rawX) && Number.isFinite(rawY);
        const confidence = Number.isFinite(item.anchor?.confidence as number)
          ? clamp(Number(item.anchor?.confidence), 0, 1)
          : 0;

        const x = hasAnchor ? clamp(rawX, 4, 96) : 50;
        const y = hasAnchor ? clamp(rawY, 6, 94) : 50;
        const hasPoint = hasAnchor && confidence >= 0.63;

        const placement = normalizePlacement(item.placement);
        const reason = normalizeReason(item.reason);

        return {
          id,
          name,
          category,
          quantity,
          priceMin: price.min,
          priceMax: price.max,
          priceRange: `¥${price.min}-${price.max}`,
          placement,
          necessity,
          reason,
          imageTarget: {
            x,
            y,
            confidence,
            hasAnchor,
            hasPoint,
          },
        };
      })
      .filter((item): item is NormalizedItem => Boolean(item));

    const reduced = normalized
      .sort((a, b) => {
        const score = (n: Necessity) => (n === 'Must-have' ? 0 : n === 'Recommended' ? 1 : 2);
        return score(a.necessity) - score(b.necessity);
      })
      .slice(0, 6);

    if (reduced.length < 4) {
      return NextResponse.json(
        { error: 'Could not confidently detect enough purchasable items from this image' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      summary:
        analyzed.summary ||
        'Recognized from the current generated image. Focus on these key purchasable items first.',
      items: reduced,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
