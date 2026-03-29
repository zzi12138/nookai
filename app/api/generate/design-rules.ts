// ─── Rule-driven generation system ──────────────────────────────────────────
// Four design systems: Lighting, SoftFurnishing, Composition, Color
// Rules are short, hard, executable — no fluff.

// ─── Types ──────────────────────────────────────────────────────────────────

export type StyleRules = {
  lighting: string[];
  softFurnishing: string[];
  composition: string[];
  color: string[];
};

export type BoundaryRule = {
  rule: string;
  negative: string;
};

export type PreferenceRule = {
  rules: string[];
};

// ─── PART 1: Style Rule Library ─────────────────────────────────────────────

export const STYLE_RULES: Record<string, StyleRules> = {
  日式原木风: {
    lighting: [
      'Primary: warm paper/linen floor lamp or pendant (~2700K golden glow)',
      'Accent: wooden desk lamp or sculptural ceramic lamp',
      'Mood: LED candles, fairy string lights, or backlit shelf',
      'Light pools on wood surfaces with soft shadow edges',
      'Overall tone: golden-hour warmth, tranquil',
    ],
    softFurnishing: [
      'Linen or cotton curtains in natural beige/off-white',
      'Neutral cushions: beige, cream, muted earth tones',
      'Wooden trays, ceramic vases, washi paper objects',
      'One large green plant: monstera, ficus, or olive tree',
      'Woven baskets or rattan storage',
    ],
    composition: [
      'Low furniture grouping, floor-level living feel',
      'Asymmetric but balanced object placement',
      'Generous negative space — do not fill every surface',
      'One focal corner: reading nook or low table setup',
    ],
    color: [
      'Dominant: light wood, warm beige, cream',
      'Secondary: soft white, muted green',
      'Accent: charcoal or dark brown (small dose)',
      'Max 3 color families, no saturated tones',
    ],
  },

  奶油治愈风: {
    lighting: [
      'Primary: soft globe or mushroom lamp (~2700K)',
      'Accent: ceramic/glass table lamp with frosted shade',
      'Mood: micro fairy lights or Himalayan salt lamp',
      'Even soft glow — no harsh shadows, gentle falloff',
      'Overall tone: warm cocoon, enveloping comfort',
    ],
    softFurnishing: [
      'Boucle or teddy-texture cushions and throws',
      'Fluffy pillows in cream/beige tones',
      'Soft knit blanket draped casually',
      'Round mirror or soft-frame art print',
      'Dried flowers or pampas grass arrangement',
    ],
    composition: [
      'Rounded shapes preferred over sharp angles',
      'Layered textures: knit over linen over wood',
      'Cozy corner as main focal point',
      'Soft visual flow — no hard visual breaks',
    ],
    color: [
      'Dominant: cream, warm white, soft beige',
      'Secondary: light caramel, blush pink (subtle)',
      'Accent: muted gold or soft brown',
      'No black, no cool gray, no saturated color',
    ],
  },

  现代简约风: {
    lighting: [
      'Primary: sleek geometric floor lamp or linear pendant (warm white)',
      'Accent: minimal task lamp (Anglepoise-style or thin LED bar)',
      'Mood: indirect LED strip along shelf edge or behind furniture',
      'Clean light-shadow contrast — graphic but not harsh',
      'Overall tone: warm precision, architectural',
    ],
    softFurnishing: [
      'Monochrome cushions: black, white, charcoal',
      'Simple geometric rug in neutral tone',
      'Minimal wall art: one large piece or small grid',
      'No decorative clutter — every object functional',
      'One structural green plant (snake plant or fiddle leaf)',
    ],
    composition: [
      'Strong grid alignment — objects follow invisible lines',
      'Generous empty space between objects',
      'One statement piece per zone (lamp, art, or plant)',
      'Symmetric or deliberately asymmetric — no random placement',
    ],
    color: [
      'Dominant: white, light gray, off-white',
      'Secondary: charcoal, matte black',
      'Accent: warm wood tone or single muted color (terracotta, sage)',
      'Max 2-3 color families, high contrast ratio',
    ],
  },

  轻复古文艺风: {
    lighting: [
      'Primary: vintage brass or Edison-bulb floor/table lamp (warm amber)',
      'Accent: retro desk lamp or banker lamp for directional pool',
      'Mood: string lights with exposed warm bulbs, candles in vintage holders',
      'Warm amber pools with dramatic shadow interplay',
      'Overall tone: late-night bookshop, artistic studio',
    ],
    softFurnishing: [
      'Textured wool or velvet throw blanket',
      'Vintage-pattern cushions: paisley, plaid, or muted floral',
      'Stacked books as decor element',
      'Vintage poster or framed art print',
      'Optional props: film camera, record player, old clock',
    ],
    composition: [
      'Layered, curated clutter — intentional not random',
      'Mix of heights and textures on surfaces',
      'Warm corner as focal point (desk or reading chair)',
      'Objects tell a story — each piece has character',
    ],
    color: [
      'Dominant: warm brown, caramel, aged wood',
      'Secondary: muted burgundy, forest green, navy',
      'Accent: brass, copper, amber',
      'Warm-shifted palette, no cool tones',
    ],
  },

  氛围感深色风: {
    lighting: [
      'Primary: warm-toned floor lamp with dark/opaque shade (amber glow, ~2500K)',
      'Accent: directional spotlight or adjustable arm lamp',
      'Mood: LED candles, backlit shelves, hidden strip lights',
      'Strong contrast: pools of warm light in dark surroundings',
      'Overall tone: moody, intimate, bar-lounge atmosphere',
    ],
    softFurnishing: [
      'Dark velvet or leather-texture cushions',
      'Heavy knit or faux-fur throw in dark neutral',
      'Dark-toned rug: charcoal, deep brown, or black',
      'Statement art: dark or high-contrast piece',
      'Metallic accents: brass, black iron, dark gold',
    ],
    composition: [
      'Dramatic depth — dark background, lit foreground',
      'One strongly lit focal zone, rest in soft shadow',
      'Heavy anchoring objects (dark furniture, thick textiles)',
      'Vertical interest: tall lamp, hanging art, tall plant',
    ],
    color: [
      'Dominant: charcoal, deep brown, black',
      'Secondary: dark forest green, deep navy, burgundy',
      'Accent: brass, warm gold, amber highlights',
      'Saturated darks with warm metallic pops',
    ],
  },
};

// ─── PART 2: Boundary Rules ─────────────────────────────────────────────────

export const BOUNDARY_RULES: Record<string, BoundaryRule> = {
  不动墙面: {
    rule: 'DO NOT repaint, retexture, or modify walls. Wall color/material/finish stays identical.',
    negative: 'changed wall color, repainted walls, new wallpaper, modified wall texture',
  },
  不替换家具: {
    rule: 'DO NOT replace, remove, or swap any existing furniture. Shape, color, position stay identical.',
    negative: 'replaced furniture, new sofa, new bed frame, swapped desk, missing furniture',
  },
  不改动布局: {
    rule: 'DO NOT move furniture or change spatial layout. Every piece stays in original position.',
    negative: 'moved furniture, altered layout, rearranged furniture, different arrangement',
  },
  不改门窗: {
    rule: 'DO NOT modify, add, or remove doors or windows. Frame style/color/position unchanged.',
    negative: 'added windows, new door, removed door, changed window frame',
  },
  不改吊顶: {
    rule: 'DO NOT change ceiling — no new moldings, panels, paint, or ceiling-mounted fixtures.',
    negative: 'changed ceiling, new ceiling fixture, ceiling panels, repainted ceiling',
  },
  不增加人工光源: {
    rule: 'DO NOT add new artificial light sources (floor lamps, table lamps, light strips, pendants). Use only existing lighting.',
    negative: 'new lamp, added light, light strips, pendant light, new floor lamp, new table lamp',
  },
};

// ─── PART 2: Preference Rules ───────────────────────────────────────────────

export const PREFERENCE_RULES: Record<string, PreferenceRule> = {
  宠物友好: {
    rules: [
      'Include a small pet bed, pet cushion, or cozy pet corner',
      'Use scratch-resistant and easy-clean materials where possible',
      'Avoid fragile objects on low surfaces',
      'Add a small pet bowl or feeding station if space allows',
    ],
  },
  社交友好: {
    rules: [
      'Create a seating arrangement that faces inward for conversation',
      'Add a small side table or coffee table accessible from seating',
      'Include ambient mood lighting suitable for hosting',
      'Keep center floor area open for movement',
    ],
  },
  收纳优化: {
    rules: [
      'Add visible storage: woven baskets, shelf organizers, trays',
      'Group small items into containers — no loose objects on surfaces',
      'Use vertical storage: wall shelves, hanging organizers',
      'Every surface should look organized and intentional',
    ],
  },
  加入绿植: {
    rules: [
      'Add 2-3 indoor plants of varying heights (floor + tabletop)',
      'Use realistic common species: monstera, pothos, snake plant, ficus',
      'Place plants near light sources for natural look',
      'Use natural planters: ceramic, terracotta, woven basket',
    ],
  },
  投影放松: {
    rules: [
      'Include a portable projector on a table or shelf',
      'Show a projection on wall or ceiling (warm-toned image, nature, or ambient)',
      'Dim ambient lighting to complement projection glow',
      'Add floor cushions or bean bag near projection area',
    ],
  },
};

// ─── PART 3: Prompt Builder ─────────────────────────────────────────────────

const BASE_ROOM_LOCK = [
  'Same room, same layout, same camera angle, same perspective, same lens.',
  'Do not change room structure, geometry, or architectural elements.',
].join('\n');

const DECLUTTER = [
  'Remove ALL clutter, trash, plastic bags, messy belongings, random small objects.',
  'Room must be clean and tidy before any styling.',
].join('\n');

const BOTTOM_AESTHETIC = [
  'Warm layered lighting — no single flat overhead-light feeling.',
  'One clear focal area in the image — slightly brighter and richer.',
  'Less but better — fewer items, each contributing to atmosphere.',
  'Controlled composition — intentional placement, no random scattering.',
  'Limited palette — max 3 color families.',
  'Realistic but aesthetically elevated — not CG, not showroom.',
  'Clean but lived-in — slight drape, natural pillow angle, small asymmetry.',
].join('\n');

const BASE_NEGATIVE = [
  'flat lighting, evenly lit room, no shadows, fluorescent overhead',
  'showroom, over-clean, sterile, plastic-looking',
  'messy clutter, plastic bags, trash, random objects',
  'different room, layout change, camera change, perspective shift',
  'blurry, distorted, low quality, watermark, text overlay',
].join(', ');

export function buildPrompt(
  theme: string,
  constraints: string[],
  requirements: string[],
): string {
  // ── Step 1: Map inputs to rules ──

  const style = STYLE_RULES[theme] || STYLE_RULES['日式原木风'];

  const activeBoundaries = constraints
    .map((c) => BOUNDARY_RULES[c])
    .filter(Boolean);

  const activePreferences = requirements
    .map((r) => PREFERENCE_RULES[r])
    .filter(Boolean);

  // Free-text requirements that don't match a preference key
  const freeTextReqs = requirements.filter((r) => !PREFERENCE_RULES[r]);

  // ── Step 2: Assemble prompt ──

  const boundaryBlock = activeBoundaries.length > 0
    ? activeBoundaries.map((b) => `- ${b.rule}`).join('\n')
    : '- No hard-furnishing restrictions. Soft furnishing changes only.';

  const preferenceBlock = activePreferences.length > 0
    ? activePreferences.flatMap((p) => p.rules.map((r) => `- ${r}`)).join('\n')
    : '';

  const freeTextBlock = freeTextReqs.length > 0
    ? freeTextReqs.map((r) => `- ${r}`).join('\n')
    : '';

  const dynamicNegatives = activeBoundaries.map((b) => b.negative).join(', ');

  const sections: string[] = [];

  // 1. Base room lock
  sections.push(`[BASE]\n${BASE_ROOM_LOCK}`);

  // 2. Declutter
  sections.push(`[DECLUTTER]\n${DECLUTTER}`);

  // 3. Style rules
  sections.push(`[STYLE: ${theme}]
Lighting:
${style.lighting.map((r) => `- ${r}`).join('\n')}

Soft furnishing:
${style.softFurnishing.map((r) => `- ${r}`).join('\n')}

Composition:
${style.composition.map((r) => `- ${r}`).join('\n')}

Color:
${style.color.map((r) => `- ${r}`).join('\n')}`);

  // 4. Boundary rules
  sections.push(`[BOUNDARIES]\n${boundaryBlock}`);

  // 5. Preference rules
  if (preferenceBlock || freeTextBlock) {
    const parts = [preferenceBlock, freeTextBlock].filter(Boolean).join('\n');
    sections.push(`[PREFERENCES]\n${parts}`);
  }

  // 6. Bottom aesthetic rules
  sections.push(`[AESTHETIC FLOOR]\n${BOTTOM_AESTHETIC}`);

  // 7. Negative
  sections.push(`[NEGATIVE]\n${BASE_NEGATIVE}${dynamicNegatives ? `, ${dynamicNegatives}` : ''}`);

  return sections.join('\n\n');
}
