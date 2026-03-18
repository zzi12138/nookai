import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Payload = {
  image?: string;
  theme?: string;
  constraints?: string[];
  requirements?: string[];
};

const NEGATIVE_MAP: Record<string, string> = {
  不替换家具: 'do not change furniture',
  不动墙面: 'do not modify walls',
  不改动布局: 'do not alter room layout',
  不改门窗: 'do not change doors or windows',
  不改吊顶: 'do not change ceiling',
  自然光优先: 'avoid unnatural lighting',
};

function stripDataUrl(value: string) {
  return value.includes(',') ? value.split(',')[1] : value;
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

function buildPrompt(theme: string, constraints: string[], requirements: string[]) {
  const negativeDynamic = constraints
    .map((item) => NEGATIVE_MAP[item] || `avoid: ${item}`)
    .join(', ');

  const requirementSection =
    requirements.length > 0
      ? `User requirements:\n- ${requirements.join('\n- ')}`
      : 'User requirements: keep the setup simple, cozy, renter-friendly.';

  const constraintSection =
    constraints.length > 0
      ? `Constraints to follow:\n- ${constraints.join('\n- ')}`
      : 'Constraints to follow: do not perform permanent renovation.';

  return `
Create a premium interior redesign based on the provided room photo.
Keep the exact room geometry, camera angle, perspective, and composition.

Target style: ${theme}
Audience: young renters, cozy and social-media-ready.

${constraintSection}
${requirementSection}

Only use renter-friendly, non-permanent solutions:
- textiles, rugs, curtains, lamps, plants, small decor, removable art
- compact movable furniture and lightweight storage
- layered warm lighting with realistic physical behavior
- clean, aesthetic, uncluttered composition

Negative prompt (must avoid):
ugly, blurry, deformed, distorted, low resolution, watermark, bad proportions, chaotic layout${
  negativeDynamic ? `, ${negativeDynamic}` : ''
}

Output should feel like a low-cost but high-end transformation for renters.
`.trim();
}

function buildEvaluation(theme: string, requirements: string[]) {
  const reqLine =
    requirements.length > 0
      ? `你提出的重点（${requirements.slice(0, 3).join('、')}）已纳入改造思路。`
      : '本次方案默认按“低预算、高质感、可移动软装”执行。';
  return `原空间具备良好的改造基础，当前痛点主要是氛围层次偏弱与视觉重心不够聚焦。新方案围绕「${theme}」建立统一色温和材质语言，优先提升照明层次、织物触感与生活感细节。${reqLine}`;
}

function buildSuggestions(theme: string) {
  return `建议先完成三件事：1) 以 ${theme} 为主线统一软装色系；2) 增加“主灯 + 辅助灯 + 情绪灯”三层光源；3) 用地毯、抱枕、绿植和可移动收纳形成空间分区。这样在不动硬装的前提下，也能得到更温暖、完整、可持续优化的出租屋体验。`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;
    const image = body.image || '';
    const theme = body.theme || '日式原木风';
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

    const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image-preview';
    const prompt = buildPrompt(theme, constraints, requirements);
    const base64Image = stripDataUrl(image);

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
                { text: prompt },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64Image,
                  },
                },
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

    return NextResponse.json({
      imageUrl: `data:${mimeType};base64,${data}`,
      evaluation: buildEvaluation(theme, requirements),
      suggestions: buildSuggestions(theme),
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
