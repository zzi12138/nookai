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
  现代简约风: {
    lighting: [
      'Primary: sleek geometric floor lamp or linear pendant (warm white ~3000K)',
      'Accent: minimal task lamp (thin LED bar or Anglepoise-style)',
      'Mood: indirect LED strip along shelf edge or behind furniture for depth',
      'Clean light-shadow contrast — graphic, precise, not harsh',
      'Overall tone: warm precision, architectural clarity',
    ],
    softFurnishing: [
      'Monochrome cushions: black, white, charcoal, or single muted accent',
      'Simple geometric rug in neutral tone',
      'Minimal wall art: one large piece or clean small grid',
      'No decorative clutter — every object functional or intentional',
      'One structural green plant (snake plant, fiddle leaf, or bird of paradise)',
    ],
    composition: [
      'Strong grid alignment — objects follow invisible lines',
      'Generous empty space between objects — breathing room is key',
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
      'Primary: vintage brass or Edison-bulb floor/table lamp casting warm amber pools',
      'Accent: retro desk lamp, banker lamp, or adjustable arm lamp for directional glow',
      'Mood: string lights with exposed warm bulbs, candles in vintage holders, or neon sign',
      'Warm amber pools with dramatic shadow interplay — depth in every corner',
      'Overall tone: late-night bookshop, cozy artist studio, cinematic warmth',
    ],
    softFurnishing: [
      'Textured wool or velvet throw blanket draped casually',
      'Mix-pattern cushions: paisley, plaid, muted floral, or ethnic textile',
      'Stacked books as decor — on tables, shelves, floor',
      'Vintage poster, framed art print, or gallery wall with mixed frames',
      'Optional props: film camera, record player, old clock, vinyl records, guitar',
    ],
    composition: [
      'Layered, curated clutter — intentional and story-telling, not random',
      'Mix of heights and textures on surfaces — visual richness',
      'Warm corner as focal point (reading chair + lamp, or desk setup)',
      'Objects have character — each piece feels collected over time',
    ],
    color: [
      'Dominant: warm brown, caramel, aged wood tones',
      'Secondary: muted burgundy, forest green, navy, deep teal',
      'Accent: brass, copper, amber, burnt orange',
      'Warm-shifted palette throughout — no cool blue or gray tones',
    ],
  },

  小红书爆款风: {
    lighting: [
      'Primary: one warm floor lamp or large table lamp as hero light — pleated shade, paper shade, or fabric dome (~2700K golden glow)',
      'Accent: small table lamp or desk lamp near a cozy corner — creates a secondary warm pool',
      'Mood: fairy string lights draped on wall/shelf, LED candles, or warm backlit shelf',
      'Light must create visible warm glow on nearby surfaces — fabric picks up golden tones, wood surfaces glow',
      'Overall tone: golden-hour indoor feeling, the kind of warm cozy light that makes you want to curl up and stay',
    ],
    softFurnishing: [
      'Sofa/bed cover or throw in earth tone: olive green, warm brown, cream, or terracotta',
      'Mix of cushions: 2-3 in coordinated warm tones, different textures (knit, linen, boucle)',
      'Woven jute/sisal rug on floor — natural texture, warm neutral color',
      'Wall decor: framed art prints, photo collage, or one statement painting (warm palette)',
      'Plants: 1-2 medium green plants (monstera, pothos) in ceramic or woven basket planter',
      'Personal touches: books stacked casually, a tray with mug/candle, small decor objects grouped in 3s',
      'Woven storage baskets, rattan/wood organizers for visible but tidy storage',
    ],
    composition: [
      'One clear "hero zone" — bed corner, sofa area, or desk nook — this is the visual anchor',
      'Hero zone is slightly brighter, richer, more detailed than the rest',
      'Layered depth: foreground object (plant/lamp) + mid-ground (main furniture) + background (wall decor)',
      'Intentional asymmetry — not perfectly balanced, feels natural and lived-in',
      'Every surface has purpose but is not overcrowded — 2-3 items per surface max',
    ],
    color: [
      'Dominant: warm neutrals — cream, beige, light wood, warm white',
      'Secondary: earth tones — olive green, warm brown, terracotta, caramel',
      'Accent: natural green (plants), warm brass/gold (lamp, frame), soft rust or mustard',
      'Overall palette feels warm, earthy, cohesive — like a Xiaohongshu saved photo',
      'No cool gray, no bright neon, no pure white — everything leans warm',
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
  'CRITICAL: Before ANY styling, the room must be COMPLETELY cleaned first.',
  'Remove ALL of the following — zero tolerance, no exceptions:',
  '- Clothes: scattered clothing, piled laundry, clothes on chairs/bed/floor',
  '- Bedding mess: wrinkled/bunched sheets, messy blankets, unfolded duvet',
  '- Shoes: any shoes on floor, shoe racks with visible mess',
  '- Trash: plastic bags, garbage, food containers, takeout boxes, empty bottles',
  '- Random objects: cables, chargers, boxes, packaging, plastic containers',
  '- Personal clutter: toiletries on surfaces, scattered papers, random small items',
  'The room must look MOVE-IN READY clean before adding any decoration.',
  'Bed must be neatly made. Surfaces must be clear. Floor must be clean.',
  'If the original photo has mess, you MUST clean it — do not style on top of mess.',
].join('\n');

const BOTTOM_AESTHETIC = [
  'Warm layered lighting — no single flat overhead-light feeling.',
  'One clear focal area in the image — slightly brighter and richer.',
  'Less but better — fewer items, each contributing to atmosphere.',
  'Controlled composition — intentional placement, no random scattering.',
  'Limited palette — max 3 color families.',
  'Realistic but aesthetically elevated — not CG, not showroom.',
  'Clean but lived-in — slight drape on throw, natural pillow angle, small asymmetry.',
  'The result should look like someone carefully styled this room and took a beautiful photo.',
].join('\n');

const BASE_NEGATIVE = [
  'flat lighting, evenly lit room, no shadows, fluorescent overhead',
  'showroom, over-clean, sterile, plastic-looking',
  'messy clutter, plastic bags, trash, random objects, scattered clothes, shoes on floor',
  'wrinkled sheets, messy bedding, unfolded blankets',
  'different room, layout change, camera change, perspective shift',
  'blurry, distorted, low quality, watermark, text overlay',
].join(', ');

export function buildPrompt(
  theme: string,
  constraints: string[],
  requirements: string[],
): string {
  // ── Step 1: Map inputs to rules ──

  const style = STYLE_RULES[theme] || STYLE_RULES['小红书爆款风'];

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
