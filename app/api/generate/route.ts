import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Payload = {
  image?: string;
  theme?: string;
  constraints?: string[];
  requirements?: string[];
};

// ─── Constraint → prompt rule mapping ────────────────────────────────────────
// Each user-selected constraint generates a positive rule AND a negative-prompt fragment.

type ConstraintRule = { rule: string; negative: string };

const CONSTRAINT_RULES: Record<string, ConstraintRule> = {
  不动墙面: {
    rule: 'DO NOT repaint, retexture, or modify the walls in any way. Wall color, material, and finish must remain exactly as in the original photo.',
    negative: 'changed wall color, repainted walls, new wallpaper, modified wall texture',
  },
  不替换家具: {
    rule: 'DO NOT replace, remove, or swap any existing large furniture (beds, sofas, desks, wardrobes, shelving units). Their shape, color, and position must remain identical.',
    negative: 'replaced furniture, new sofa, new bed frame, swapped desk, missing furniture',
  },
  不改动布局: {
    rule: 'DO NOT move furniture or change the spatial layout. Every piece must stay in its original position.',
    negative: 'moved furniture, altered layout, rearranged furniture, different room arrangement',
  },
  不改门窗: {
    rule: 'DO NOT modify, add, or remove doors or windows. Frame style, color, and position must remain unchanged.',
    negative: 'added windows, missing walls, new door, removed door, changed window frame',
  },
  不改吊顶: {
    rule: 'DO NOT change the ceiling — no new moldings, panels, paint, or fixtures attached to the ceiling.',
    negative: 'changed ceiling, new ceiling light fixture, ceiling panels, repainted ceiling',
  },
  不增加人工光源: {
    rule: 'DO NOT add any new artificial light sources (floor lamps, table lamps, light strips, pendant lights). Rely only on existing lighting in the room.',
    negative: 'new lamp, added light, light strips, pendant light, new floor lamp, new table lamp',
  },
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

  // ── Dynamic constraint rules (only what the user selected) ──
  const activeRules = constraints
    .map((c) => CONSTRAINT_RULES[c])
    .filter(Boolean);

  const dynamicRulesBlock =
    activeRules.length > 0
      ? activeRules.map((r) => `- ${r.rule}`).join('\n')
      : '- No specific hard-furnishing restrictions — feel free to make broader changes as long as the room structure stays the same.';

  const dynamicNegatives = activeRules.map((r) => r.negative).join(', ');

  // ── User requirements ──
  const requirementBlock =
    requirements.length > 0
      ? `Additional user requests:\n- ${requirements.join('\n- ')}`
      : 'Additional user requests: keep the setup simple, cozy, and renter-friendly.';

  return `
You are an expert interior stylist. Use the provided photo as the EXACT base image.

=== STEP 1 — DECLUTTER ===
Remove all visible clutter, trash, plastic bags, messy belongings, piled-up random objects, and visual noise.
The room should look clean, tidy, and move-in-ready before any decoration begins.

=== STEP 2 — SOFT FURNISHING MAKEOVER ===
Apply a cohesive interior styling makeover in: ${themeStyle}.

Design goals (aim for all):
- Create a space that feels intentionally designed — not just "decorated" but truly styled.
- Build layered atmosphere: lighting warmth, textile textures, organic accents, and visual rhythm.
- The result should evoke an aspirational lifestyle — the kind of room people save on Pinterest or Xiaohongshu.
- Every added element must serve the overall composition; avoid cluttering with too many small objects.
- Prioritize: warm lighting layers, quality textiles (throws, cushions, rugs), greenery, and one or two statement pieces.
- Make the room feel cozy, lived-in, and inviting — not sterile or showroom-like.

=== USER CONSTRAINTS (follow strictly) ===
${dynamicRulesBlock}

=== FIXED RULES (always apply) ===
- DO NOT change the room's architectural structure (walls, floor plan, ceiling shape).
- The final image MUST keep the exact same camera angle, perspective, lens, composition, and geometry as the original photo.
- Lighting must look natural and physically realistic — no glowing halos or flat studio lighting.
- All added soft furnishings must be realistic, purchasable items — no fantasy or AI-artifact objects.
- The result must look like the same room, only decluttered and beautifully styled.

${requirementBlock}

=== NEGATIVE PROMPT (must avoid) ===
changed room structure, structural modifications, new room, different room,
camera moved, perspective shift, different camera angle, different lens, focal length change,
zoomed in, zoomed out, cropped, rotated, tilted,
clutter, trash, plastic bags, cardboard boxes, messy cables, piled belongings,
ugly, blurry, deformed, distorted, low resolution, watermark, bad proportions,
dull lighting, flat lighting, overexposed, underexposed, unnatural lighting,
chaotic layout, mutated, extra limbs, text overlay${dynamicNegatives ? `, ${dynamicNegatives}` : ''}
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

    const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
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
      provider: 'gemini',
      evaluation: buildEvaluation(theme, requirements),
      suggestions: buildSuggestions(theme),
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
