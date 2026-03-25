import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

function resolveThemeStyle(theme: string) {
  const map: Record<string, string> = {
    日式原木风: [
      'Japanese natural wood style',
      'Style description: A calm Japanese-inspired interior with natural wood tones, minimal decoration, and a peaceful atmosphere.',
      'Color palette: light wood, beige, cream, warm neutrals.',
      'Decor elements: linen curtains, beige cushions, wooden trays, ceramic vases, simple wooden decor, paper lampshades.',
      'Plants: monstera, ficus, olive tree.',
      'Lighting: soft warm lighting with a relaxing and natural feeling.',
      'Mood: calm, minimal, natural, warm, peaceful.',
    ].join(' '),
    奶油温柔风: [
      'soft creamy minimal style',
      'Style description: A soft creamy interior with warm neutral tones and cozy textures. The atmosphere should feel comfortable, gentle, and slightly elegant.',
      'Color palette: cream, soft beige, warm white, light neutral tones.',
      'Decor elements: boucle cushions, fluffy pillows, soft blankets, round mirrors, neutral art prints.',
      'Plants: pampas grass, small decorative plants.',
      'Lighting: warm ambient lighting from table lamps and soft lampshades.',
      'Mood: soft, cozy, warm, elegant, gentle.',
    ].join(' '),
    奶油治愈风: [
      'soft creamy minimal style',
      'Style description: A soft creamy interior with warm neutral tones and cozy textures. The atmosphere should feel comfortable, gentle, and slightly elegant.',
      'Color palette: cream, soft beige, warm white, light neutral tones.',
      'Decor elements: boucle cushions, fluffy pillows, soft blankets, round mirrors, neutral art prints.',
      'Plants: pampas grass, small decorative plants.',
      'Lighting: warm ambient lighting from table lamps and soft lampshades.',
      'Mood: soft, cozy, warm, elegant, gentle.',
    ].join(' '),
    现代极简风: [
      'modern minimalist style',
      'Style description: A clean modern minimalist interior with simple lines, neutral colors, and uncluttered surfaces.',
      'Color palette: black, white, gray, neutral tones.',
      'Decor elements: minimal wall art, monochrome cushions, geometric rugs, simple desk accessories.',
      'Lighting: modern floor lamps or minimal table lamps.',
      'Decor should remain minimal and organized.',
      'Mood: clean, modern, structured, balanced, minimal.',
    ].join(' '),
    文艺复古风: [
      'vintage artistic style',
      'Style description: A cozy vintage-inspired interior filled with artistic details and warm lighting. The space should feel creative, expressive, and slightly nostalgic.',
      'Color palette: warm browns, muted colors, soft vintage tones.',
      'Decor elements: vintage posters, stacked books, retro table lamps, textured blankets, artistic objects.',
      'Optional decor props: film camera, record player, classic books.',
      'Lighting: warm yellow lighting creating a cozy artistic mood.',
      'Mood: artistic, nostalgic, warm, creative, cozy.',
    ].join(' '),
    绿植自然风: [
      'urban nature style',
      'Style description: A nature-inspired interior filled with greenery, fresh textures, and natural materials.',
      'Color palette: natural greens, beige, light wood, neutral colors.',
      'Decor elements: woven baskets, cotton textiles, natural fiber rugs, botanical prints.',
      'Plants: multiple indoor plants such as monstera, snake plant, ficus, and pothos.',
      'Lighting: bright natural light with a fresh atmosphere.',
      'Mood: fresh, natural, airy, relaxing, organic.',
    ].join(' '),
  };

  return map[theme] || `${theme} interior style`;
}

function buildPrompt(theme: string, constraints: string[], requirements: string[]) {
  const themeStyle = resolveThemeStyle(theme);
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
Use the provided photo as the exact base image.
Keep identical layout, geometry, camera angle, and composition.

Perform a realistic interior refresh of a rental apartment based on the provided photo.
Step 1 — Declutter the room first:
Remove all clutter, trash, messy belongings, and random small objects.
The room should appear clean, tidy, and organized before adding any decorations.

Step 2 — Apply a soft furnishing makeover in ${themeStyle}.

${constraintSection}
${requirementSection}

Important constraints (must follow strictly):
- DO NOT repaint or modify the walls. Wall color and material must remain exactly the same.
- DO NOT replace or modify the floor.
- DO NOT change the ceiling.
- DO NOT modify doors or windows.
- DO NOT change built-in fixtures or architectural structures.
- DO NOT move large furniture or change the layout.
- Only removable decorations and small movable objects are allowed.
- Allowed elements include: textiles, lamps, plants, small decor objects, books, removable wall art, posters, rugs, blankets, pillows.
- Lighting must look natural and physically realistic.
- The final image must keep the same camera angle, perspective, composition, and geometry as the original photo.
- The result should look like the same room after decluttering and soft decoration only.
- same room, same architecture, same perspective, only decluttered and softly decorated.

Negative prompt (must avoid):
changed room structure, moved furniture, altered layout, rearranged furniture,
camera moved, perspective shift, different camera angle, different lens, focal length change,
zoomed in, zoomed out, cropped, rotated, tilted,
added windows, missing walls, new door, removed door, structural modifications, new room, different room,
changed wall color, repainted walls, changed flooring, changed ceiling,
ugly, blurry, deformed, distorted, low resolution, watermark, bad proportions, chaotic layout, messy, mutated, unnatural lighting${
    negativeDynamic ? `, ${negativeDynamic}` : ''
  }
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
