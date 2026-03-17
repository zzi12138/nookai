import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type ThemeDetails = {
  themeStyle: string;
  description: string;
  palette: string;
  decor: string;
  plants: string;
  lighting: string;
  mood: string;
};

const THEME_DETAILS: Record<string, ThemeDetails> = {
  Japandi: {
    themeStyle: 'Japanese natural wood style',
    description:
      'A calm Japanese-inspired interior with natural wood tones, minimal decoration, and a peaceful atmosphere.',
    palette: 'light wood, beige, cream, warm neutrals',
    decor: 'linen curtains, beige cushions, wooden trays, ceramic vases, simple wooden decor, paper lampshades',
    plants: 'monstera, ficus, olive tree',
    lighting: 'soft warm lighting with a relaxing and natural feeling',
    mood: 'calm, minimal, natural, warm, peaceful',
  },
  '日式原木风': {
    themeStyle: 'Japanese natural wood style',
    description:
      'A calm Japanese-inspired interior with natural wood tones, minimal decoration, and a peaceful atmosphere.',
    palette: 'light wood, beige, cream, warm neutrals',
    decor: 'linen curtains, beige cushions, wooden trays, ceramic vases, simple wooden decor, paper lampshades',
    plants: 'monstera, ficus, olive tree',
    lighting: 'soft warm lighting with a relaxing and natural feeling',
    mood: 'calm, minimal, natural, warm, peaceful',
  },
  'Cream Minimal': {
    themeStyle: 'soft creamy minimal style',
    description:
      'A soft creamy interior with warm neutral tones and cozy textures. The atmosphere should feel comfortable, gentle, and slightly elegant.',
    palette: 'cream, soft beige, warm white, light neutral tones',
    decor: 'boucle cushions, fluffy pillows, soft blankets, round mirrors, neutral art prints',
    plants: 'pampas grass, small decorative plants',
    lighting: 'warm ambient lighting from table lamps and soft lampshades',
    mood: 'soft, cozy, warm, elegant, gentle',
  },
  '奶油温柔风': {
    themeStyle: 'soft creamy minimal style',
    description:
      'A soft creamy interior with warm neutral tones and cozy textures. The atmosphere should feel comfortable, gentle, and slightly elegant.',
    palette: 'cream, soft beige, warm white, light neutral tones',
    decor: 'boucle cushions, fluffy pillows, soft blankets, round mirrors, neutral art prints',
    plants: 'pampas grass, small decorative plants',
    lighting: 'warm ambient lighting from table lamps and soft lampshades',
    mood: 'soft, cozy, warm, elegant, gentle',
  },
  'Vintage Warm': {
    themeStyle: 'vintage artistic style',
    description:
      'A cozy vintage-inspired interior filled with artistic details and warm lighting. The space should feel creative, expressive, and slightly nostalgic.',
    palette: 'warm browns, muted colors, soft vintage tones',
    decor: 'vintage posters, stacked books, retro table lamps, textured blankets, artistic objects',
    plants: 'small decorative plants',
    lighting: 'warm yellow lighting creating a cozy artistic mood',
    mood: 'artistic, nostalgic, warm, creative, cozy',
  },
  '文艺复古风': {
    themeStyle: 'vintage artistic style',
    description:
      'A cozy vintage-inspired interior filled with artistic details and warm lighting. The space should feel creative, expressive, and slightly nostalgic.',
    palette: 'warm browns, muted colors, soft vintage tones',
    decor: 'vintage posters, stacked books, retro table lamps, textured blankets, artistic objects',
    plants: 'small decorative plants',
    lighting: 'warm yellow lighting creating a cozy artistic mood',
    mood: 'artistic, nostalgic, warm, creative, cozy',
  },
  'Nordic Light': {
    themeStyle: 'modern minimalist style',
    description:
      'A clean modern minimalist interior with simple lines, neutral colors, and uncluttered surfaces.',
    palette: 'black, white, gray, neutral tones',
    decor: 'minimal wall art, monochrome cushions, geometric rugs, simple desk accessories',
    plants: 'small decorative plants',
    lighting: 'modern floor lamps or minimal table lamps',
    mood: 'clean, modern, structured, balanced, minimal',
  },
  '现代极简风': {
    themeStyle: 'modern minimalist style',
    description:
      'A clean modern minimalist interior with simple lines, neutral colors, and uncluttered surfaces.',
    palette: 'black, white, gray, neutral tones',
    decor: 'minimal wall art, monochrome cushions, geometric rugs, simple desk accessories',
    plants: 'small decorative plants',
    lighting: 'modern floor lamps or minimal table lamps',
    mood: 'clean, modern, structured, balanced, minimal',
  },
  'Soft Loft': {
    themeStyle: 'urban nature style',
    description:
      'A nature-inspired interior filled with greenery, fresh textures, and natural materials.',
    palette: 'natural greens, beige, light wood, neutral colors',
    decor: 'woven baskets, cotton textiles, natural fiber rugs, botanical prints',
    plants: 'multiple indoor plants such as monstera, snake plant, ficus, and pothos',
    lighting: 'bright natural light with a fresh atmosphere',
    mood: 'fresh, natural, airy, relaxing, organic',
  },
  '绿植自然风': {
    themeStyle: 'urban nature style',
    description:
      'A nature-inspired interior filled with greenery, fresh textures, and natural materials.',
    palette: 'natural greens, beige, light wood, neutral colors',
    decor: 'woven baskets, cotton textiles, natural fiber rugs, botanical prints',
    plants: 'multiple indoor plants such as monstera, snake plant, ficus, and pothos',
    lighting: 'bright natural light with a fresh atmosphere',
    mood: 'fresh, natural, airy, relaxing, organic',
  },
};

function stripDataUrl(value: string) {
  return value.includes(',') ? value.split(',')[1] : value;
}

type ConstraintToggles = {
  lockWalls: boolean;
  lockFloor: boolean;
  lockCeiling: boolean;
  lockDoorsWindows: boolean;
  lockFixtures: boolean;
  lockLayout: boolean;
  lockLargeFurniture: boolean;
  requireNaturalLight: boolean;
  requireDeclutter: boolean;
  avoidArtifacts: boolean;
};

const DEFAULT_CONSTRAINTS: ConstraintToggles = {
  lockWalls: true,
  lockFloor: true,
  lockCeiling: true,
  lockDoorsWindows: true,
  lockFixtures: true,
  lockLayout: true,
  lockLargeFurniture: true,
  requireNaturalLight: true,
  requireDeclutter: true,
  avoidArtifacts: true,
};

function normalizeConstraints(input?: Partial<ConstraintToggles>): ConstraintToggles {
  const safeInput =
    input && typeof input === 'object' ? input : ({} as Partial<ConstraintToggles>);
  return {
    ...DEFAULT_CONSTRAINTS,
    ...safeInput,
  };
}

function buildPrompt(theme: string, strength: number, constraints: ConstraintToggles) {
  const details =
    THEME_DETAILS[theme] ?? THEME_DETAILS.Japandi ?? THEME_DETAILS['日式原木风'];
  const themeStyle = details?.themeStyle ?? theme ?? 'Japanese natural wood style';

  const hardRules: string[] = [];
  if (constraints.lockWalls) {
    hardRules.push(
      'DO NOT repaint or modify the walls. Wall color and material must remain exactly the same.'
    );
  }
  if (constraints.lockFloor) {
    hardRules.push('DO NOT replace or modify the floor.');
  }
  if (constraints.lockCeiling) {
    hardRules.push('DO NOT change the ceiling.');
  }
  if (constraints.lockDoorsWindows) {
    hardRules.push('DO NOT modify doors or windows.');
  }
  if (constraints.lockFixtures) {
    hardRules.push('DO NOT change built-in fixtures or architectural structures.');
  }
  if (constraints.lockLayout) {
    hardRules.push('Keep the original layout, geometry, and camera framing.');
  }
  if (constraints.lockLargeFurniture) {
    hardRules.push('Do not move large furniture. Only small movable decor is allowed.');
  }

  const avoidRules: string[] = [];
  if (constraints.avoidArtifacts) {
    avoidRules.push(
      'ugly, blurry, deformed, distorted, low resolution, watermark, bad proportions, unnatural lighting'
    );
  }

  const styleSection = details
    ? `
Style description:
${details.description}
Color palette:
${details.palette}
Decor elements:
${details.decor}
Plants:
${details.plants}
Lighting:
${details.lighting}
Mood:
${details.mood}
`
    : '';

  const declutterSection = constraints.requireDeclutter
    ? `
Step 1 — Declutter the room first:
Remove all clutter, trash, messy belongings, and random small objects. The room should appear clean, tidy, and organized before adding any decorations.
`
    : '';

  const naturalLightLine = constraints.requireNaturalLight
    ? 'Lighting must look natural and physically realistic.'
    : 'Lighting can be adjusted to suit the style, but keep it believable.';

  const hardRulesBlock = hardRules.length
    ? `Important constraints (must follow strictly):\n\n${hardRules.join('\n\n')}\n`
    : 'No hard constraints were requested. Keep changes subtle and renter-friendly.';

  const avoidBlock = avoidRules.length ? `Avoid: ${avoidRules.join(', ')}.` : '';

  const lockLine = `Structure lock strength: ${strength.toFixed(
    2
  )} (higher means preserve structure and materials).`;

  const resultLine = constraints.requireDeclutter
    ? 'The result should look like the same room after decluttering and soft decoration only.'
    : 'The result should look like the same room after soft decoration only.';

  const sameRoomLine = constraints.requireDeclutter
    ? 'same room, same architecture, same perspective, only decluttered and softly decorated'
    : 'same room, same architecture, same perspective, softly decorated';

  return `
Use the provided photo as the exact base image.
Keep identical layout, geometry, camera angle, and composition.

${lockLine}

${declutterSection}
Step 2 — Apply a soft furnishing makeover in ${themeStyle}.

${hardRulesBlock}

Only removable decorations and small movable objects are allowed.

Allowed elements include:
textiles, lamps, plants, small decor objects, books, removable wall art, posters, rugs, blankets, pillows.

${naturalLightLine}

The final image must keep the same camera angle, perspective, composition, and geometry as the original photo.

${resultLine}

${sameRoomLine}
${avoidBlock}
${styleSection}
`.trim();
}

export async function POST(req: Request) {
  try {
    const { image, theme, strength, constraints } = await req.json();

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
    const normalizedStrength =
      typeof strength === 'number' ? Math.min(1, Math.max(0.1, strength)) : 0.5;
    const prompt = buildPrompt(
      theme || '日式原木风',
      normalizedStrength,
      normalizeConstraints(constraints)
    );
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

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: result?.error?.message || result?.error || 'Generation failed' },
        { status: 500 }
      );
    }

    const parts = result?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part: any) => part?.inline_data || part?.inlineData);

    if (!imagePart) {
      return NextResponse.json(
        { error: 'No image returned from Gemini' },
        { status: 500 }
      );
    }

    const inline = imagePart.inline_data || imagePart.inlineData;
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
    });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
