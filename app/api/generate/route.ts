import { NextResponse } from 'next/server';
import { estimateCost } from '../../lib/server/cost-ledger';

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
      'Decor elements: linen curtains, beige cushions, wooden trays, ceramic vases, simple wooden decor, washi paper lampshades.',
      'Plants: monstera, ficus, olive tree.',
      'Lighting design: Create a 3-layer lighting scheme — (1) a warm-toned paper or linen pendant/floor lamp as ambient base (~2700K golden glow), (2) a sculptural table lamp or wooden desk lamp as task accent, (3) LED candles, fairy string lights, or a backlit shelf as mood layer. Light should cast soft, warm pools with gentle shadows on wood surfaces, creating depth and tranquility. Golden hour warmth throughout.',
      'Mood: calm, minimal, natural, warm, peaceful, meditative.',
    ].join(' '),
    奶油温柔风: [
      'soft creamy minimal style',
      'Style description: A soft creamy interior with warm neutral tones and cozy textures. The atmosphere should feel comfortable, gentle, and slightly elegant.',
      'Color palette: cream, soft beige, warm white, light neutral tones.',
      'Decor elements: boucle cushions, fluffy pillows, soft blankets, round mirrors, neutral art prints.',
      'Plants: pampas grass, small decorative plants.',
      'Lighting design: Create a dreamy, enveloping glow — (1) a fabric-shade floor lamp or arc lamp casting diffused warm light as the main ambient source, (2) a bedside or side-table lamp with a frosted/cream shade for soft accent pools, (3) warm fairy lights draped behind sheer curtains or along a shelf, or a small cluster of LED candles for intimate sparkle. Light should feel like a soft golden haze wrapping the room, with gentle luminous highlights on boucle and cream textures.',
      'Mood: soft, cozy, warm, elegant, gentle, dreamy.',
    ].join(' '),
    奶油治愈风: [
      'soft creamy healing style',
      'Style description: A soft creamy interior with warm neutral tones and cozy textures. The atmosphere should feel healing, comforting, and gently uplifting.',
      'Color palette: cream, soft beige, warm white, light neutral tones.',
      'Decor elements: boucle cushions, fluffy pillows, soft blankets, round mirrors, neutral art prints.',
      'Plants: pampas grass, small decorative plants, dried flower arrangements.',
      'Lighting design: Design lighting that feels like a warm embrace — (1) a soft globe or mushroom lamp as the main warm ambient source (~2700K), (2) a small ceramic or glass table lamp with warm glow as accent, (3) a string of micro fairy lights or a Himalayan salt lamp for healing ambiance. The overall effect should be a gentle, golden cocoon of light with no harsh shadows — every surface softly illuminated.',
      'Mood: healing, soft, cozy, warm, comforting, sanctuary-like.',
    ].join(' '),
    现代极简风: [
      'modern minimalist style',
      'Style description: A clean modern minimalist interior with simple lines, neutral colors, and uncluttered surfaces.',
      'Color palette: black, white, gray, neutral tones.',
      'Decor elements: minimal wall art, monochrome cushions, simple desk accessories.',
      'Lighting design: Design precise, architectural lighting — (1) a sleek linear or geometric floor lamp with warm-white output as the statement ambient piece, (2) a minimal task lamp (e.g., Anglepoise-style or thin LED bar) for focused accent, (3) subtle indirect LED strip along a shelf edge or behind furniture for depth and drama. Light and shadow should create clean graphic contrasts — sharp but not harsh. The lighting itself should feel like a design object.',
      'Mood: clean, modern, structured, balanced, minimal, gallery-like.',
    ].join(' '),
    文艺复古风: [
      'vintage artistic style',
      'Style description: A cozy vintage-inspired interior filled with artistic details and warm lighting. The space should feel creative, expressive, and slightly nostalgic.',
      'Color palette: warm browns, muted colors, soft vintage tones.',
      'Decor elements: vintage posters, stacked books, retro table lamps, textured blankets, artistic objects.',
      'Optional decor props: film camera, record player, classic books.',
      'Lighting design: Create cinematic, nostalgic lighting — (1) a vintage brass or Edison-bulb floor/table lamp casting warm amber pools as the anchor, (2) a retro desk lamp or banker\'s lamp for dramatic directional accent, (3) string lights with exposed warm bulbs, candles in vintage holders, or a neon sign for artistic mood. The room should feel like a cozy late-night bookshop or artist\'s studio — warm amber tones, dramatic light-and-shadow interplay, rich depth in every corner.',
      'Mood: artistic, nostalgic, warm, creative, cozy, cinematic.',
    ].join(' '),
    绿植自然风: [
      'urban nature style',
      'Style description: A nature-inspired interior filled with greenery, fresh textures, and natural materials.',
      'Color palette: natural greens, beige, light wood, neutral colors.',
      'Decor elements: woven baskets, cotton textiles, botanical prints.',
      'Plants: multiple indoor plants such as monstera, snake plant, ficus, and pothos.',
      'Lighting design: Create light that mimics golden-hour sunlight filtering through foliage — (1) a rattan or woven pendant/floor lamp casting intricate shadow patterns as ambient base, (2) a ceramic or wood-base table lamp near plants to create backlit leaf silhouettes, (3) warm micro fairy lights woven through trailing plants or in glass terrariums for magical sparkle. Dappled light and botanical shadows should dance across walls and surfaces.',
      'Mood: fresh, natural, airy, relaxing, organic, botanical-garden.',
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
=== USER INTENT (HIGHEST PRIORITY) ===

Style:
${themeStyle}

${requirementBlock}

Constraints:
${dynamicRulesBlock}

Rules:
- Follow user constraints strictly
- If conflict happens, user constraints override everything

---

We are NOT just decorating a room.

We are creating an emotional, lifestyle-driven scene that feels real, warm, and highly shareable (Xiaohongshu / Pinterest level).

Your goal is NOT "clean and nice".
Your goal is: "make people want to live here".

---

PRIORITY 1 — LIGHTING (CRITICAL)
Lighting must create atmosphere and visual focus.

- Use warm lighting (~2700K)
- Build contrast: bright focal areas + soft shadow zones
- At least ONE clear visible light source (lamp / floor lamp / ambient light)
- Light must interact with surfaces (fabric, wood, wall) — soft glow, natural falloff
- Avoid flat lighting, avoid evenly lit room

Think: cinematic, cozy, golden-hour indoor lighting

---

PRIORITY 2 — FOCAL POINT (VERY IMPORTANT)
The image must have ONE clear visual focus.

- Example: sofa corner / bed / table setup
- This area should be slightly brighter, richer, and more detailed
- Other areas should be quieter to support it

---

PRIORITY 3 — "DESIGNED BUT LIVED-IN"
Avoid showroom look.

- Add subtle lived-in feeling:
  - slightly draped blanket
  - natural pillow placement
  - small asymmetry
- BUT keep it clean and intentional (not messy)

---

PRIORITY 4 — LESS BUT BETTER
Do NOT add too many small objects.

- Fewer items, higher quality
- Each object must contribute to atmosphere
- Avoid clutter

---

PRIORITY 5 — DECLUTTER MUST BE COMPLETE
Remove ALL trash, plastic bags, random objects completely.
The room must look clean before styling.

---

KEEP STRICTLY:
- Same room
- Same layout
- Same camera angle
- Same perspective

---

RESULT REQUIREMENT:
The final image should feel like:
"someone just walked into a warm, aesthetic, carefully styled home and took a photo"

NOT:
"AI generated decoration"

---

NEGATIVE:
flat lighting, evenly lit room, no shadows, showroom, over-clean, messy clutter, plastic bags,
different room, layout change, camera change,
blurry, distorted, low quality${dynamicNegatives ? `, ${dynamicNegatives}` : ''}
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
  return `建议先完成三件事：1) 以 ${theme} 为主线统一软装色系；2) 增加”主灯 + 辅助灯 + 情绪灯”三层光源；3) 用抱枕、绿植和可移动收纳形成空间分区。这样在不动硬装的前提下，也能得到更温暖、完整、可持续优化的出租屋体验。`;
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

    const cost = estimateCost({
      api: 'generate',
      model,
      inputImages: 1,
      inputImageAvgSize: 1000,
      promptLength: prompt.length,
      outputImages: 1,
    });

    return NextResponse.json({
      imageUrl: `data:${mimeType};base64,${data}`,
      provider: 'gemini',
      evaluation: buildEvaluation(theme, requirements),
      suggestions: buildSuggestions(theme),
      cost,
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
