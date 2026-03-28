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
import { estimateCost } from '../../lib/server/cost-ledger';

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
你是一名专业软装购物助手。

任务：仔细观察【效果图 AFTER】，列出图中所有可在电商平台购买的软装单品。
${hasBefore ? '对比【原图 BEFORE】，只列出效果图中新添置的软装；原图中已有的大型固定家具（床架/衣柜/沙发本身）无需列出。' : '不要列出建筑结构（墙/地板/天花板）或大型固定家具本身（床架/衣柜/沙发主体）。'}

识别规则（严格执行）：
1. 只输出效果图中实际可见的物件，绝不虚构，绝不凭空添加。
2. 逐类检查，不要遗漏：
   - 灯具：落地灯、台灯、床头灯、壁灯、灯串——每盏单独列出
   - 布艺：所有抱枕/靠枕合并为一条（名称如”装饰抱枕”，quantity填实际个数，不要拆成多条）；盖毯/披毯单独一条；窗帘单独一条；床单+被套+枕套算一组”床品套装”
   - 地毯：效果图中如有地毯或铺地织物，必须列出（标记为 Must-have 或 Recommended）；若看到地面有纹理/织物感也要标注；注明形状（方形/圆形/长条）
   - 绿植：大叶植物、小盆栽、多肉、花束——各自单独列出
   - 墙面装饰：挂画、海报、装饰镜
   - 摆件：蜡烛、香薰、花瓶、小雕塑、托盘——逐一列出
3. 同类物件若有多件（如两盏台灯），分别输出一条。
4. 每个物件必须有 anchor（均为 0-100 百分比）：centerX/centerY 为中心点，left/top/width/height 为边界框，confidence 为可见度（清晰可见 0.8+，部分遮挡 0.55-0.75）。
5. category 必须从以下枚举中选一个：灯具 | 布艺 | 地毯 | 绿植 | 墙面装饰 | 摆件
6. necessity：Must-have = 效果图核心物件；Recommended = 明显可见但可替代；Optional = 点缀。
7. 价格区间参考中国电商实际，名称用简洁中文（如”暖光落地灯”而非”灯”）。

风格参考：${theme || '日式原木风'}

返回 JSON，格式严格如下：
{
  “summary”: “一句简短中文总结”,
  “items”: [
    {
      “name”: “暖光落地灯”,
      “category”: “灯具”,
      “quantity”: 1,
      “priceMin”: 159,
      “priceMax”: 239,
      “placement”: “沙发右侧”,
      “necessity”: “Must-have”,
      “reason”: “一句中文短句”,
      “anchor”: { “centerX”: 72, “centerY”: 58, “left”: 66, “top”: 45, “width”: 12, “height”: 26, “confidence”: 0.82 }
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

  const model = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';
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

    const cost = estimateCost({
      api: 'explainer',
      model: 'gemini-2.5-flash',
      inputImages: beforeImage ? 2 : 1,
      inputImageAvgSize: 1000,
      promptLength: 2000, // approximate prompt length
      outputTextTokens: 2000,
    });

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
      cost,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
