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
你是租房改造购物助手。请仔细观察效果图，列出图中所有可以购买的软装物件（目标 12-18 个）。${hasBefore ? '\n原图仅供参考背景，不要用来排除物件。' : ''}

【核心原则】效果图里看得见的软装物件，全部都要输出。不得遗漏，不得虚构。

识别规则：
1) 只输出效果图中实际可见的物件，不得凭空添加。
2) 所有软装类别都要覆盖，逐一检查：
   - 灯具：落地灯、台灯、床头灯、灯串，每一盏都要单独输出
   - 地毯：地面有织物就输出，注意实际形状（方形/长方形/圆形）
   - 床品：床单、被套、枕套作为一组”床品套装”输出；毯子、抱枕分别单独输出
   - 绿植：无论大小，效果图中出现的每株植物都要输出（小盆栽、多肉、大叶植物分别列出）
   - 挂画/装饰画：墙上有画就输出
   - 桌面小摆件：蜡烛、香薰、花瓶、小雕塑、托盘等，逐一输出
   - 窗帘：如果和原图明显不同则输出
3) 同一类型有多个，分别输出（例如两盏台灯各输出一条）。
4) 每个物件必须有 anchor：centerX/centerY（中心点百分比）、left/top/width/height（0-100）、confidence（0-1）。
5) confidence：效果图中清晰可见填 0.8+，部分遮挡填 0.55-0.75。
6) 价格符合中国电商区间，不要虚高。
7) 名称用中文，简洁具体（如”暖光落地灯”而非”灯”）。

风格：${theme || '日式原木风'}

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
