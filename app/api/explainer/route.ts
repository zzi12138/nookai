import { NextResponse } from 'next/server';
import { assignItemsToBoardCells } from '../../lib/itemsBoard';
import {
  type Necessity,
  type RawItem,
  normalizeGuideRawItems,
  dedupeByObject,
  makeDefaultValidation,
  makeDefaultBoardDebug,
} from './board-state';
import { toInlineImagePart } from '../../lib/server/gemini-image';

export const runtime = 'nodejs';
export const maxDuration = 90;

type Payload = {
  image?: string;
  beforeImage?: string;
  afterImage?: string;
  theme?: string;
  provider?: 'nanobanana' | 'gemini';
};

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
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

function getPrompt(theme: string, hasBefore: boolean) {
  return `
你是租房改造购物助手。请基于${hasBefore ? '原图 + 效果图对照' : '效果图'}，识别可购买、可摆放的具体物件（目标 12-18 个）。

硬性规则：
1) 只能输出具体物品，不要抽象概念。
2) 只基于图中可见物件，不得臆造。
3) 如果提供了原图：只保留“效果图中新增或明显增强”的物件；原图里本来就有且无明显变化的物件必须排除。
4) 每个物件必须有 anchor 坐标与尺寸：centerX/centerY（中心点）、left/top（左上角）、width/height（0-100）和 confidence（0-1）。
5) centerX/centerY 必须基于物体几何中心；width/height 贴合物体轮廓，不要固定模板尺寸。
6) 如果不确定，把 confidence 降低到 0.55 以下；不确定项宁可不输出。
7) 需要尽量覆盖：所有可见灯具、地毯/地面织物、床品/抱枕/毯子、装饰摆件、挂画、绿植。
8) 同类型可重复输出（例如两个灯），不要只保留一个。
9) 价格区间要收窄，符合中国电商常见区间。
10) 所有字段优先用中文，名称要简洁完整，禁止省略号。
11) 不要输出未在图中明确出现的收纳篮、托盘、篮筐、盒子等功能收纳类物件，除非图中清晰可见。
12) 如果地毯是方形/长方形，请明确写成“方形地毯”或“长方形地毯”，不要默认写成圆形。

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

async function analyzeItems(beforeImage: string | undefined, afterImage: string, theme: string, apiKey: string) {
  const beforePart = await toInlineImagePart(beforeImage).catch(() => null);
  const afterPart = await toInlineImagePart(afterImage);

  if (!afterPart) {
    throw new Error('Unsupported image format');
  }

  const model = process.env.GEMINI_VISION_MODEL || 'gemini-2.0-flash';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55000);

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
      const apiErr = result?.error?.message || result?.error || `Analysis failed (${response.status})`;
      console.error('[explainer] Gemini API error:', apiErr, '| model:', model);
      throw new Error(apiErr);
    }

    const parts = result?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p: any) => p?.text || '').join('\n').trim();
    console.log('[explainer] raw Gemini text (first 500):', text.slice(0, 500));

    const parsed = safeParseJson<{ summary?: string; items?: RawItem[] }>(text);
    console.log('[explainer] parsed items count:', parsed?.items?.length ?? 0);

    if (!parsed?.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      throw new Error('No items detected from image');
    }

    return {
      summary: (parsed.summary || '').trim(),
      items: dedupeByObject(parsed.items),
    };
  } finally {
    clearTimeout(timer);
  }
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
    let analyzed: { summary: string; items: RawItem[] } = { summary: '', items: [] };
    let analysisError: string | null = null;

    if (apiKey) {
      try {
        analyzed = await withTimeout(
          analyzeItems(beforeImage || undefined, afterImage, theme, apiKey),
          60000,
          'analysis timeout'
        );
        console.log('[explainer] analysis succeeded, items:', analyzed.items.length);
      } catch (error) {
        analysisError = error instanceof Error ? error.message : String(error);
        console.error('[explainer] analysis failed:', analysisError);
      }
    } else {
      analysisError = 'Missing GEMINI_API_KEY';
      console.error('[explainer]', analysisError);
    }

    const normalizedAll = normalizeGuideRawItems(analyzed.items);
    const normalized = normalizedAll;

    let reduced = normalized
      .sort((a, b) => {
        const score = (n: Necessity) => (n === 'Must-have' ? 0 : n === 'Recommended' ? 1 : 2);
        if (score(a.necessity) !== score(b.necessity)) {
          return score(a.necessity) - score(b.necessity);
        }
        return b.imageTarget.confidence - a.imageTarget.confidence;
      })
      .slice(0, 12);

    if (reduced.length < 10) {
      const picked = new Set(reduced.map((item) => item.id));
      const topUp = normalizedAll
        .filter((item) => !picked.has(item.id))
        .sort((a, b) => b.imageTarget.confidence - a.imageTarget.confidence)
        .slice(0, 12 - reduced.length);
      reduced = [...reduced, ...topUp];
    }

    const previewItems = assignItemsToBoardCells(reduced);
    const itemsBoardImageUrl = '';
    const finalItems = previewItems;
    const boardDebug = makeDefaultBoardDebug();

    if (previewItems.length > 0) {
      boardDebug.generationAttempted = true;
      boardDebug.generationSucceeded = true;
      boardDebug.thumbnailSource = 'main_image_fallback';
      boardDebug.status = 'generated_unchecked';
      boardDebug.failureCode = null;
      boardDebug.failureReason = null;
      boardDebug.validation = makeDefaultValidation();
    } else {
      boardDebug.generationAttempted = true;
      boardDebug.generationSucceeded = false;
      boardDebug.thumbnailSource = 'main_image_fallback';
      boardDebug.status = 'extracted_board_invalid';
      boardDebug.failureCode = 'analysis_empty';
      boardDebug.failureReason = 'analysis returned no valid purchasable items';
      boardDebug.fallbackReason = 'analysis_empty';
      boardDebug.validation = makeDefaultValidation();
    }

    return NextResponse.json({
      summary:
        analyzed.summary ||
        '已从当前效果图识别关键可购买物件，可按优先级逐步添置。',
      items: finalItems,
      itemsBoardImageUrl,
      explainerImageUrl: afterImage || itemsBoardImageUrl,
      extractedBoardStatus: boardDebug.status,
      extractedBoardDebug: boardDebug,
      fallbackReason: boardDebug.fallbackReason,
      analysisError,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
