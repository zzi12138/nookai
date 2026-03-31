import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { estimateCost } from '../../lib/server/cost-ledger';
import { buildPrompt } from './design-rules';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Payload = {
  image?: string;
  composedPrompt?: string;
  referenceImages?: string[];
  evaluation?: string;
  suggestions?: string;
  // Legacy fields (used when composedPrompt is not provided)
  theme?: string;
  constraints?: string[];
  requirements?: string[];
};

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

function detectMimeType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function resolveImagePart(value: string, req: Request) {
  if (!value) throw new Error('Empty image input');

  if (isDataUrl(value)) {
    const parsed = parseDataUrl(value);
    if (!parsed) throw new Error('Invalid data URL');
    return parsed;
  }

  if (isHttpUrl(value)) {
    const response = await fetch(value, { method: 'GET' });
    if (!response.ok) throw new Error(`Failed to fetch remote image: ${response.status}`);
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    const data = Buffer.from(await response.arrayBuffer()).toString('base64');
    return { mimeType, data };
  }

  if (value.startsWith('/')) {
    // Treat root-relative paths as /public assets.
    const publicRoot = path.resolve(process.cwd(), 'public');
    const resolved = path.resolve(publicRoot, value.replace(/^\/+/, ''));
    if (!resolved.startsWith(publicRoot)) {
      throw new Error('Invalid reference image path');
    }
    const fileBuffer = await readFile(resolved);
    return {
      mimeType: detectMimeType(resolved),
      data: fileBuffer.toString('base64'),
    };
  }

  if (isProbablyBase64(value)) {
    return { mimeType: 'image/jpeg', data: stripDataUrl(value) };
  }

  // Try same-origin URL fallback for unusual relative paths.
  const url = new URL(value, req.url).toString();
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) throw new Error(`Failed to fetch relative image: ${response.status}`);
  const mimeType = response.headers.get('content-type') || 'image/jpeg';
  const data = Buffer.from(await response.arrayBuffer()).toString('base64');
  return { mimeType, data };
}

function uniqueList(input: string[] = []) {
  return Array.from(
    new Set(
      input
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function buildEvaluation(theme: string, requirements: string[]) {
  const reqLine =
    requirements.length > 0
      ? `你提出的重点（${requirements.slice(0, 3).join('、')}）已纳入改造思路。`
      : '本次方案默认按"低预算、高质感、可移动软装"执行。';
  return `原空间具备良好的改造基础，当前痛点主要是氛围层次偏弱与视觉重心不够聚焦。新方案围绕「${theme}」建立统一色温和材质语言，优先提升照明层次、织物触感与生活感细节。${reqLine}`;
}

function buildSuggestions(theme: string) {
  return `建议先完成三件事：1) 以 ${theme} 为主线统一软装色系；2) 增加"主灯 + 辅助灯 + 情绪灯"三层光源；3) 用抱枕、绿植和可移动收纳形成空间分区。这样在不动硬装的前提下，也能得到更温暖、完整、可持续优化的出租屋体验。`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;
    const image = body.image || '';
    const referenceImages = Array.isArray(body.referenceImages) ? body.referenceImages.slice(0, 6) : [];
    const theme = body.theme || '小红书爆款风';
    const constraints = uniqueList(body.constraints || []);
    const requirements = uniqueList(body.requirements || []);

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

    const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
    // Use pre-composed prompt if available, otherwise fall back to legacy buildPrompt
    const prompt = body.composedPrompt || buildPrompt(theme, constraints, requirements);
    let sourceImage: { mimeType: string; data: string };
    try {
      sourceImage = await resolveImagePart(image, req);
    } catch {
      const fallbackBase64 = stripDataUrl(image || '');
      if (!fallbackBase64) {
        return NextResponse.json(
          { error: 'Invalid source image payload' },
          { status: 400 }
        );
      }
      sourceImage = { mimeType: 'image/jpeg', data: fallbackBase64 };
    }
    const referenceParts: Array<{ inline_data: { mime_type: string; data: string } }> = [];

    for (const ref of referenceImages) {
      try {
        const resolved = await resolveImagePart(ref, req);
        referenceParts.push({
          inline_data: {
            mime_type: resolved.mimeType,
            data: resolved.data,
          },
        });
      } catch {
        // Skip a broken reference silently; main generation should still run.
      }
    }

    const promptWithReferenceGuard =
      referenceParts.length > 0
        ? `${prompt}

[REFERENCE_STYLE_GUARD]
- Attached reference images are style anchors only.
- Borrow mood, color rhythm, material feel, and light hierarchy.
- Keep the source room structure, perspective, and major furniture layout unchanged.`
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
                { text: promptWithReferenceGuard },
                {
                  inline_data: {
                    mime_type: sourceImage.mimeType,
                    data: sourceImage.data,
                  },
                },
                ...referenceParts,
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
      return NextResponse.json(
        { error: result?.error?.message || result?.error || 'Generation failed' },
        { status: 500 }
      );
    }

    const parts = result?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part: any) => part?.inline_data || part?.inlineData);
    const inline = imagePart?.inline_data || imagePart?.inlineData;
    const mimeType = inline?.mime_type || inline?.mimeType || 'image/png';
    const data = inline?.data;

    if (!data) {
      return NextResponse.json(
        { error: 'No image data returned from Gemini' },
        { status: 500 }
      );
    }

    const cost = estimateCost({
      api: 'generate',
      model,
      inputImages: 1 + referenceParts.length,
      inputImageAvgSize: 1000,
      promptLength: prompt.length,
      outputImages: 1,
    });

    return NextResponse.json({
      imageUrl: `data:${mimeType};base64,${data}`,
      provider: 'gemini',
      referenceImagesUsed: referenceParts.length,
      evaluation: body.evaluation || buildEvaluation(theme, requirements),
      suggestions: body.suggestions || buildSuggestions(theme),
      cost,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
