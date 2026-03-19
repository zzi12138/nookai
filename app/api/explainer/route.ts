import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Payload = {
  image?: string;
  beforeImage?: string;
  afterImage?: string;
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
    centerX?: number;
    centerY?: number;
    cx?: number;
    cy?: number;
    left?: number;
    top?: number;
    right?: number;
    bottom?: number;
    width?: number;
    height?: number;
    w?: number;
    h?: number;
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
    left: number;
    top: number;
    width: number;
    height: number;
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
  return name;
}

function normalizePlacement(raw?: string) {
  const value = (raw || '').trim();
  return value || '放在不影响动线的位置';
}

function normalizeReason(raw?: string) {
  const value = (raw || '').trim();
  return value || '提升空间氛围最直接';
}

function hasChinese(text: string) {
  return /[\u4e00-\u9fff]/.test(text);
}

function toChineseName(raw: string) {
  const name = compactName(raw);
  if (!name) return '';
  if (hasChinese(name)) return name;

  const n = name.toLowerCase();
  if (n.includes('floor lamp')) return '暖光落地灯';
  if (n.includes('desk lamp') || n.includes('table lamp')) return '桌面台灯';
  if (n.includes('light strip') || n.includes('string light')) return '窗帘灯串';
  if (n.includes('rug') || n.includes('carpet')) return '圆形地毯';
  if (n.includes('bedding') || n.includes('duvet')) return '亚麻床品';
  if (n.includes('pillow')) return '装饰抱枕';
  if (n.includes('blanket') || n.includes('throw')) return '针织披毯';
  if (n.includes('wall art') || n.includes('poster') || n.includes('painting')) return '免打孔挂画';
  if (n.includes('plant') || n.includes('greenery')) return '中型绿植';
  if (n.includes('projector')) return '投影仪';
  if (n.includes('stand')) return '投影支架';
  if (n.includes('side table')) return '小边几';
  if (n.includes('tray') || n.includes('storage')) return '桌面收纳盘';
  return name;
}

function toChinesePlacement(raw: string) {
  const value = normalizePlacement(raw);
  if (hasChinese(value)) return value;

  const n = value.toLowerCase();
  if (n.includes('sofa') && n.includes('right')) return '沙发右侧';
  if (n.includes('sofa')) return '沙发附近';
  if (n.includes('bedside') || n.includes('bed side')) return '床边';
  if (n.includes('desk')) return '书桌一角';
  if (n.includes('wall')) return '床头或沙发背墙';
  if (n.includes('window')) return '窗边';
  if (n.includes('corner')) return '房间角落';
  if (n.includes('center')) return '空间中部';
  return value;
}

function toChineseReason(raw: string) {
  const value = normalizeReason(raw);
  if (hasChinese(value)) return value;

  const n = value.toLowerCase();
  if (n.includes('warm') || n.includes('light')) return '补充暖光后，空间更有层次';
  if (n.includes('cozy')) return '让房间更放松舒适';
  if (n.includes('focus')) return '快速形成视觉焦点';
  if (n.includes('texture')) return '提升软装质感';
  return '提升空间完成度';
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

function fallbackSizeByName(name: string) {
  const n = name.toLowerCase();
  if (n.includes('floor lamp') || n.includes('落地灯')) return { width: 12, height: 26 };
  if (n.includes('desk lamp') || n.includes('table lamp') || n.includes('台灯')) return { width: 9, height: 13 };
  if (n.includes('light strip') || n.includes('string light') || n.includes('灯带')) return { width: 24, height: 10 };
  if (n.includes('rug') || n.includes('carpet') || n.includes('地毯')) return { width: 34, height: 22 };
  if (n.includes('bedding') || n.includes('床品')) return { width: 30, height: 24 };
  if (n.includes('pillow') || n.includes('抱枕')) return { width: 12, height: 10 };
  if (n.includes('blanket') || n.includes('throw') || n.includes('毯')) return { width: 18, height: 14 };
  if (n.includes('wall art') || n.includes('poster') || n.includes('挂画')) return { width: 20, height: 16 };
  if (n.includes('plant') || n.includes('绿植')) return { width: 14, height: 24 };
  if (n.includes('projector') || n.includes('投影')) return { width: 12, height: 10 };
  if (n.includes('side table') || n.includes('边几')) return { width: 13, height: 14 };
  return { width: 16, height: 16 };
}

function shouldExcludeItem(name: string) {
  const n = name.toLowerCase();
  const blocked = [
    '床架',
    '床垫',
    '沙发',
    '书桌',
    '桌子',
    '椅子',
    '餐椅',
    '餐桌',
    '电视',
    '柜',
    '衣柜',
    '空调',
    '硬装墙',
    '地板',
    '天花板',
    '吊顶',
    '门框',
    '窗框',
    '电视柜',
    '原有床',
    '原有沙发',
    '原有书桌',
    'built-in',
    'wall',
    'floor',
    'ceiling',
    'door',
    'window',
    'cabinet',
    'sofa',
    'bed',
    'desk',
    'chair',
    'air conditioner',
  ];

  return blocked.some((kw) => n.includes(kw));
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

function getPrompt(theme: string, hasBefore: boolean) {
  return `
你是租房改造购物助手。请基于${hasBefore ? '原图 + 效果图对照' : '效果图'}，识别可购买、可摆放的具体物件（目标 8-14 个）。

硬性规则：
1) 只能输出具体物品，不要抽象概念。
2) 只基于图中可见物件，不得臆造。
3) 如果提供了原图：只保留“效果图中新增或明显增强”的物件；原图里本来就有且无明显变化的物件必须排除。
4) 每个物件必须有 anchor 坐标与尺寸：centerX/centerY（中心点）、left/top（左上角）、width/height（0-100）和 confidence（0-1）。
5) centerX/centerY 必须基于物体几何中心；width/height 贴合物体轮廓，不要固定模板尺寸。
6) 如果不确定，把 confidence 降低到 0.55 以下；不确定项宁可不输出。
7) 价格区间要收窄，符合中国电商常见区间。
8) 所有字段优先用中文，名称要简洁完整，禁止省略号。

风格上下文：${theme || '日式原木风'}

推荐识别对象：
落地灯、台灯、灯串、地毯、床品、抱枕、披毯、挂画、绿植、投影仪、小边几、收纳托盘。

返回 JSON，格式严格如下：
{
  "summary": "一句简短中文总结",
  "items": [
    {
      "name": "暖光落地灯",
      "quantity": 1,
      "priceMin": 159,
      "priceMax": 239,
      "placement": "沙发右侧",
      "necessity": "Must-have|Recommended|Optional",
      "reason": "一句中文短句",
      "anchor": { "centerX": 72, "centerY": 58, "left": 66, "top": 45, "width": 12, "height": 26, "confidence": 0.82 }
    }
  ]
}
`.trim();
}

function dedupeByName(items: RawItem[]) {
  const seen = new Set<string>();
  const out: RawItem[] = [];

  for (const item of items) {
    const key = compactName(item.name).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '').slice(0, 36);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

async function analyzeItems(beforeImage: string | undefined, afterImage: string, theme: string, apiKey: string) {
  const beforePart = await toInlineImagePart(beforeImage).catch(() => null);
  const afterPart = await toInlineImagePart(afterImage);

  if (!afterPart) {
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
                    { text: getPrompt(theme, Boolean(beforePart)) },
                    ...(beforePart
                      ? [
                          { text: '[原图 BEFORE]' },
                          {
                            inline_data: {
                              mime_type: beforePart.mimeType,
                              data: beforePart.data,
                            },
                          },
                        ]
                      : []),
                    { text: '[效果图 AFTER]' },
                    {
                      inline_data: {
                        mime_type: afterPart.mimeType,
                        data: afterPart.data,
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
    const beforeImage = body.beforeImage || '';
    const afterImage = body.afterImage || body.image || '';
    const theme = body.theme || 'Japandi';

    if (!afterImage) {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing GEMINI_API_KEY (or GOOGLE_API_KEY)' },
        { status: 500 }
      );
    }

    const analyzed = await analyzeItems(beforeImage || undefined, afterImage, theme, apiKey);

    const normalized: NormalizedItem[] = analyzed.items
      .slice(0, 18)
      .map((item, index) => {
        const id = index + 1;
        const name = toChineseName(item.name || '');
        if (!name || shouldExcludeItem(name)) return null;

        const category = inferCategory(name);
        const necessity = normalizeNecessity(item.necessity);
        const quantity = Math.round(clamp(Number(item.quantity || 1), 1, 3));
        const price = normalizePrice(name, item.priceMin, item.priceMax);

        const rawCenterX = Number(item.anchor?.centerX ?? item.anchor?.cx);
        const rawCenterY = Number(item.anchor?.centerY ?? item.anchor?.cy);
        const rawX = Number(item.anchor?.x);
        const rawY = Number(item.anchor?.y);
        const rawLeft = Number(item.anchor?.left);
        const rawTop = Number(item.anchor?.top);
        const rawRight = Number(item.anchor?.right);
        const rawBottom = Number(item.anchor?.bottom);
        const rawW = Number(item.anchor?.width ?? item.anchor?.w);
        const rawH = Number(item.anchor?.height ?? item.anchor?.h);
        const hasRightBottom = Number.isFinite(rawRight) && Number.isFinite(rawBottom);
        const hasBoxFromSide = hasRightBottom && Number.isFinite(rawLeft) && Number.isFinite(rawTop);
        const hasBox = Number.isFinite(rawW) && Number.isFinite(rawH);
        const hasCenter = Number.isFinite(rawCenterX) && Number.isFinite(rawCenterY);
        const hasXY = Number.isFinite(rawX) && Number.isFinite(rawY);
        const hasLeftTop = Number.isFinite(rawLeft) && Number.isFinite(rawTop);
        const hasAnchor = hasCenter || hasXY || hasLeftTop || hasRightBottom;
        const confidence = Number.isFinite(item.anchor?.confidence as number)
          ? clamp(Number(item.anchor?.confidence), 0, 1)
          : 0;

        const fallbackSize = fallbackSizeByName(name);
        const width = hasBox
          ? clamp(rawW, 6, 56)
          : hasBoxFromSide
            ? clamp(rawRight - rawLeft, 6, 56)
            : fallbackSize.width;
        const height = hasBox
          ? clamp(rawH, 6, 56)
          : hasBoxFromSide
            ? clamp(rawBottom - rawTop, 6, 56)
            : fallbackSize.height;

        let left = Number.NaN;
        let top = Number.NaN;

        if (hasLeftTop) {
          left = rawLeft;
          top = rawTop;
        } else if (hasCenter) {
          left = rawCenterX - width / 2;
          top = rawCenterY - height / 2;
        } else if (hasXY) {
          const centerCandidateLeft = rawX - width / 2;
          const centerCandidateTop = rawY - height / 2;
          const centerCandidateValid =
            centerCandidateLeft >= -5 &&
            centerCandidateTop >= -5 &&
            centerCandidateLeft + width <= 105 &&
            centerCandidateTop + height <= 105;

          if (centerCandidateValid) {
            left = centerCandidateLeft;
            top = centerCandidateTop;
          } else {
            left = rawX;
            top = rawY;
          }
        } else if (hasRightBottom) {
          left = rawRight - width;
          top = rawBottom - height;
        }

        const safeLeft = Number.isFinite(left) ? clamp(left, 0, 100 - width) : 50 - width / 2;
        const safeTop = Number.isFinite(top) ? clamp(top, 0, 100 - height) : 50 - height / 2;
        const x = clamp(safeLeft + width / 2, width / 2 + 1, 100 - width / 2 - 1);
        const y = clamp(safeTop + height / 2, height / 2 + 1, 100 - height / 2 - 1);
        const hasPoint = hasAnchor && confidence >= 0.63;

        const placement = toChinesePlacement(item.placement || '');
        const reason = toChineseReason(item.reason || '');

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
            left: safeLeft,
            top: safeTop,
            width,
            height,
            confidence,
            hasAnchor,
            hasPoint,
          },
        };
      })
      .filter((item): item is NormalizedItem => Boolean(item))
      .filter((item) => item.imageTarget.confidence >= 0.45);

    const reduced = normalized
      .sort((a, b) => {
        const score = (n: Necessity) => (n === 'Must-have' ? 0 : n === 'Recommended' ? 1 : 2);
        if (score(a.necessity) !== score(b.necessity)) {
          return score(a.necessity) - score(b.necessity);
        }
        return b.imageTarget.confidence - a.imageTarget.confidence;
      })
      .slice(0, 16);

    if (reduced.length < 1) {
      return NextResponse.json(
        { error: '当前效果图未识别到可购买物件' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      summary:
        analyzed.summary ||
        '已从当前效果图识别关键可购买物件，可按优先级逐步添置。',
      items: reduced,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
