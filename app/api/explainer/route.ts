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
Analyze the AFTER image${hasBefore ? ' and compare with BEFORE' : ''}.

Task:
List ONLY newly added major visual items that significantly affect the room atmosphere.

Focus ONLY on:
- lighting (floor lamp, table lamp, wall lamp, string lights)
- rugs
- wall decor (painting, poster, mirror)
- small movable furniture (chair, side table, shelf)
- visual devices (projector, screen)

Ignore:
- cushions, bedding, curtains
- small plants
- small decorative objects

Rules:
- Only include clearly visible items
- No guessing or hallucination
- Each item must exist in AFTER${hasBefore ? ' but not BEFORE' : ''}
- If multiple of the same type (e.g. two table lamps), list each separately
- Names in Chinese (e.g. “暖光落地灯”)
- Price ranges based on Chinese e-commerce

Output per item:
- name (Chinese)
- category: 灯具 | 地毯 | 墙面装饰 | 功能家具
- quantity
- necessity: Must-have / Recommended
- priceMin, priceMax
- placement (Chinese, e.g. “沙发右侧”)
- reason (one short Chinese sentence)
- anchor: { centerX, centerY, left, top, width, height, confidence } (all 0-100 percentage)

Style: ${theme || '小红书爆款风'}

Return JSON:
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
