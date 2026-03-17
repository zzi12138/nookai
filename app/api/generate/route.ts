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
  if (constraints.lockLayout) {
    hardRules.push('No structural renovation. Keep the original layout and framing.');
  }
  if (constraints.lockWalls) {
    hardRules.push('No wall destruction, repainting, or material changes.');
  }
  if (constraints.lockFloor) {
    hardRules.push('No floor replacement. Rugs may cover the original flooring.');
  }
  if (constraints.lockCeiling) {
    hardRules.push('No ceiling modification.');
  }
  if (constraints.lockDoorsWindows) {
    hardRules.push('No door or window changes.');
  }
  if (constraints.lockFixtures) {
    hardRules.push('No built-in furniture changes.');
  }
  if (constraints.lockLargeFurniture) {
    hardRules.push('Do not move large furniture. Use small movable pieces only.');
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

  const declutterLine = constraints.requireDeclutter
    ? 'Clean composition, no clutter.'
    : 'Keep the scene tidy, but light styling is allowed.';

  const naturalLightLine = constraints.requireNaturalLight
    ? 'Lighting must look natural and physically realistic.'
    : 'Lighting can be adjusted to suit the style, but keep it believable.';

  const hardRulesBlock = hardRules.length
    ? `Constraints (must follow strictly):\n${hardRules.join('\n')}\n`
    : 'Constraints: Keep the changes renter-friendly and subtle.';

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

A high-quality interior render of a rental room makeover, focusing only on non-permanent, renter-friendly design solutions.
${hardRulesBlock}

Style: ${themeStyle}, targeting young professionals, cozy, warm, visually pleasing, social-media-ready.

Lighting:
layered lighting design with warm soft spotlights, pendant lights, floor lamps, and wall lamps,
creating depth, shadow, and emotional atmosphere, cinematic and cozy.
${naturalLightLine}

Textiles:
large area rug covering original flooring,
sofa covered with aesthetic fabric,
soft textures, neutral or warm tones.

Furniture:
small-scale movable furniture,
compact sofa, lightweight bookshelf, small storage cabinet,
flexible layout, space-saving.

Decor:
minimal but tasteful wall decorations,
art paintings, small art objects,
${declutterLine}
desktop styled with small decor items.

Greenery:
indoor plants (real or fake),
adding freshness and contrast,
soft natural vibe.

Entertainment:
projector setup area,
cozy viewing corner with soft seating,
relaxed lifestyle feeling.

Overall:
warm lighting, cohesive color palette,
clean, soft, cozy, aesthetic,
feels like a low-cost but high-end transformation,
designed for renters.

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
