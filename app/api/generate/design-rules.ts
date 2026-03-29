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

  质感氛围风: {
    lighting: [
      'MUST have one statement pendant light as the room\'s visual signature — paper ball pendant (Noguchi-style), dome pendant, PH5 pendant, or large round fabric shade',
      'Accent: one warm table lamp with small shade near sofa/desk (~2700K), creating a focused warm pool on the surface',
      'Mood: warm amber LED backlight placed behind a large plant or behind furniture — casts a golden glow wash on the wall. Add 1-2 candles on coffee/side table.',
      'At least 2-3 distinct light sources must be visible in the final image — pendant + table lamp + backlight/candle',
      'Light creates visible warm pools on surfaces — golden glow on walls behind plants, warm reflections on glass and dark wood',
    ],
    softFurnishing: [
      'One large statement plant: monstera, fiddle-leaf fig, or bird of paradise in a simple dark ceramic planter — placed in a corner near a warm backlight so leaves cast shadows on wall',
      'Coffee/side table vignette: 3-5 items grouped with intention — candle + stacked art/design books + one small object (whiskey glass, ceramic piece, fruit bowl). Curated, not cluttered.',
      'Throw blanket: one quality throw draped casually on sofa arm — not folded neatly, relaxed but intentional',
      '2-3 cushions in mixed textures (corduroy, knit, linen) — coordinated tones but not matching',
      'Wall art: 1-2 framed prints or posters with strong graphic identity (Yves Klein, Matisse, botanical illustration, abstract). Black or slim wood frames.',
      'One woven rattan pouf or seating cushion near seating area',
      'One grounding rug under the seating zone — can be bold solid color (deep navy, charcoal) or natural jute/wool',
    ],
    composition: [
      'One clear hero zone with most visual detail and light: sofa corner with pendant + plant + lamp, or desk area with pendant + art + backlight',
      'Layered 3-plane depth: foreground (plant leaf edge, lamp, or table corner) + midground (main furniture, rug) + background (wall art, pendant, backlit wall)',
      'Intentional asymmetry — slightly more weight on one side, natural not staged',
      'Surfaces are curated: 3-5 items max per surface, each object has purpose. Generous empty space between groups.',
      'Mix of material textures visible: glass + dark wood + metal + woven + ceramic — material contrast creates richness',
      'The feeling is "design-conscious person lives here" — every piece looks chosen, not random',
    ],
    color: [
      'Base: clean neutral walls (white, warm white, light gray) as backdrop',
      'Furniture anchor: one or two bold dark pieces — black sofa, dark walnut table, charcoal shelf. These ground the room.',
      'Accent: warm brass/gold from pendant and frames, deep green from plants, warm amber from backlight on walls',
      'Allow ONE bold color statement: a deep navy/indigo rug, a cobalt blue poster, or a rich terracotta piece — this gives the room personality',
      'Overall: warm despite neutral base — warmth comes from layered lighting, wood tones, and plant life. Never cold or sterile.',
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
