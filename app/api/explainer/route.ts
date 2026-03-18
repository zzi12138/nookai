import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Payload = {
  image?: string;
  theme?: string;
};

type Category =
  | '主照明'
  | '氛围照明'
  | '地面软装'
  | '床品布艺'
  | '墙面装饰'
  | '绿植'
  | '功能型小物';

type Necessity = '必买' | '建议买' | '可选';

type RawItem = {
  name?: string;
  category?: string;
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

function normalizeCategory(raw?: string): Category {
  const value = (raw || '').trim();
  if (value.includes('主照明') || value.includes('主灯')) return '主照明';
  if (value.includes('氛围照明') || value.includes('落地灯') || value.includes('台灯')) {
    return '氛围照明';
  }
  if (value.includes('地面')) return '地面软装';
  if (value.includes('床品') || value.includes('布艺')) return '床品布艺';
  if (value.includes('墙面') || value.includes('挂画') || value.includes('装饰画')) return '墙面装饰';
  if (value.includes('绿植') || value.includes('植物')) return '绿植';
  if (value.includes('功能') || value.includes('收纳') || value.includes('投影')) return '功能型小物';
  return '功能型小物';
}

function normalizeNecessity(raw?: string): Necessity {
  const value = (raw || '').trim();
  if (value.includes('必')) return '必买';
  if (value.includes('建议')) return '建议买';
  return '可选';
}

function normalizePrice(minRaw: number | undefined, maxRaw: number | undefined) {
  let min = Number.isFinite(minRaw) ? Number(minRaw) : 0;
  let max = Number.isFinite(maxRaw) ? Number(maxRaw) : 0;

  if (min <= 0 && max <= 0) {
    min = 99;
    max = 169;
  } else if (min <= 0) {
    min = Math.max(39, max - 80);
  } else if (max <= 0) {
    max = min + 80;
  }

  min = Math.round(clamp(min, 39, 2999));
  max = Math.round(clamp(max, min + 20, min + 260));

  return { min, max };
}

function normalizeName(raw?: string) {
  const fallback = '可移动软装单品';
  const name = (raw || '').trim();
  if (!name) return fallback;
  return name.length > 22 ? `${name.slice(0, 22)}...` : name;
}

function normalizePlacement(raw?: string) {
  const v = (raw || '').trim();
  return v || '放在不影响通行的主视觉区域';
}

function normalizeReason(raw?: string) {
  const v = (raw || '').trim();
  return v || '能明显提升空间完成度';
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
你是室内改造执行顾问。请基于“当前效果图”识别 4-6 个最关键、可购买、可摆放的物件。

硬性要求：
1) 只输出具体物件，不要抽象概念。
2) 物件必须来自当前效果图真实可见内容。
3) 不要硬凑不存在的物件。
4) 每个物件都要给出点位坐标 x/y（0-100），坐标需尽量落在物体中心。
5) 如果坐标不确定，confidence 设低于 0.55。
6) 价格区间要窄且真实，不要夸张跨度。

风格上下文：${theme || '日式原木风'}

只返回 JSON，不要 Markdown，不要解释。格式如下：
{
  "summary": "一句简短总结，不超过45字",
  "items": [
    {
      "name": "暖光落地灯",
      "category": "主照明|氛围照明|地面软装|床品布艺|墙面装饰|绿植|功能型小物",
      "quantity": 1,
      "priceMin": 159,
      "priceMax": 239,
      "placement": "沙发右侧",
      "necessity": "必买|建议买|可选",
      "reason": "不超过18字",
      "anchor": { "x": 72, "y": 58, "confidence": 0.82 }
    }
  ]
}
`.trim();
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

  const models = [
    process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash',
    process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image-preview',
  ].filter((m, i, arr) => arr.indexOf(m) === i);

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
                temperature: 0.2,
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
          items: parsed.items,
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
    const theme = body.theme || '日式原木风';

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

    const normalized = analyzed.items
      .slice(0, 6)
      .map((item, index) => {
        const id = index + 1;
        const category = normalizeCategory(item.category);
        const necessity = normalizeNecessity(item.necessity);
        const { min, max } = normalizePrice(item.priceMin, item.priceMax);
        const quantity = Math.round(clamp(Number(item.quantity || 1), 1, 3));

        const rawX = Number(item.anchor?.x);
        const rawY = Number(item.anchor?.y);
        const confidence = Number.isFinite(item.anchor?.confidence as number)
          ? clamp(Number(item.anchor?.confidence), 0, 1)
          : 0;

        const hasCoord = Number.isFinite(rawX) && Number.isFinite(rawY);
        const x = hasCoord ? clamp(rawX, 4, 96) : 50;
        const y = hasCoord ? clamp(rawY, 6, 94) : 50;
        const hasPoint = hasCoord && confidence >= 0.55;

        const name = normalizeName(item.name);
        const placement = normalizePlacement(item.placement);
        const reason = normalizeReason(item.reason);

        return {
          id,
          markerLabel: String(id),
          name,
          category,
          quantity,
          priceMin: min,
          priceMax: max,
          priceRange: `¥${min}-${max}`,
          placement,
          necessity,
          reason,
          imageTarget: {
            x,
            y,
            confidence,
            hasPoint,
          },
          module: reason,
          buy: name,
          value: reason,
        };
      })
      .filter((item) => item.name && item.placement)
      .slice(0, 6);

    if (normalized.length === 0) {
      return NextResponse.json(
        { error: '无法从当前效果图识别可执行物件，请重试' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      summary:
        analyzed.summary || '已识别当前效果图中的关键可执行物件，按优先级逐步购买即可。',
      items: normalized,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
