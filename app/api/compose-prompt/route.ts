import { NextResponse } from 'next/server';
import type { PlanningPackage } from '../plan/route';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ─── Types ──────────────────────────────────────────────────────────────────

type Payload = {
  planningPackage: PlanningPackage;
  userAnswers: Record<string, string | string[]>;
};

// ─── Fixed sections (never AI-generated) ────────────────────────────────────

const FIXED_BASE = [
  'Same room, same layout, same camera angle, same perspective, same lens.',
  'Do not change room structure, geometry, or architectural elements.',
].join('\n');

const FIXED_DECLUTTER_BASE = [
  'CRITICAL: Before ANY styling, the room must be COMPLETELY cleaned first.',
  'Remove ALL: scattered clothes, messy bedding, shoes on floor, trash, plastic bags, random cables, packaging.',
  'Bed must be neatly made. Surfaces clear. Floor clean.',
  'If the original photo has mess, CLEAN IT FIRST — do not style on top of mess.',
].join('\n');

const FIXED_AESTHETIC = [
  'clear focal area',
  'layered warm lighting',
  'strong light/shadow contrast',
  'less but better',
  'controlled composition',
  'limited palette',
  'realistic and visually striking',
].map((r) => `- ${r}`).join('\n');

const FIXED_NEGATIVE_BASE = [
  'flat lighting, evenly lit, no shadows, fluorescent overhead',
  'showroom, sterile, plastic-looking, CG render',
  'messy clutter, trash, scattered clothes, shoes on floor',
  'wrinkled sheets, messy bedding',
  'different room, layout change, camera change',
  'blurry, distorted, low quality, watermark',
].join(', ');

// ─── Helper: resolve user answers to readable text ──────────────────────────

function resolveAnswers(
  pkg: PlanningPackage,
  answers: Record<string, string | string[]>,
): string {
  return pkg.dynamicQuestionnaire
    .map((q) => {
      const raw = answers[q.id];
      if (!raw) return null;
      const values = Array.isArray(raw) ? raw : [raw];
      const labels = values.map((v) => {
        if (v === 'ai_decide') return 'AI decides';
        const opt = q.options.find((o) => o.value === v);
        return opt ? opt.label : v;
      });
      return `${q.id}(${q.purpose.split('.')[0]}): ${labels.join(', ')}`;
    })
    .filter(Boolean)
    .join('\n');
}

// ─── Helper: derive boundaries from user answers ────────────────────────────

function deriveBoundaries(
  pkg: PlanningPackage,
  answers: Record<string, string | string[]>,
): string[] {
  const boundaries: string[] = [
    'DO NOT repaint or modify walls.',
    'DO NOT replace existing furniture — only ADD items.',
    'DO NOT change ceiling, doors, or windows.',
  ];

  // Check q5 (boundary question) for user-specified boundaries
  const boundaryAnswer = answers['q5'];
  if (boundaryAnswer) {
    const vals = Array.isArray(boundaryAnswer) ? boundaryAnswer : [boundaryAnswer];
    const q5 = pkg.dynamicQuestionnaire.find((q) => q.id === 'q5');
    if (q5) {
      for (const v of vals) {
        if (v === 'ai_decide') continue;
        const opt = q5.options.find((o) => o.value === v);
        if (opt) boundaries.push(`User specified: ${opt.label}（${opt.desc}）`);
      }
    }
  }

  return boundaries;
}

// ─── Build meta-prompt for Gemini (compact) ─────────────────────────────────

function buildMetaPrompt(
  pkg: PlanningPackage,
  answers: Record<string, string | string[]>,
): string {
  const answerText = resolveAnswers(pkg, answers);

  return `You are composing a [DESIGN_PLAN] section for an image generation prompt.

Room: ${pkg.sceneAnalysis.roomType}, ${pkg.sceneAnalysis.estimatedSize}
Furniture: ${pkg.sceneAnalysis.existingFurniture.join(', ')}
Layout: ${pkg.sceneAnalysis.layout}
Light: ${pkg.sceneAnalysis.lightCondition}

Strategy:
- Focal: ${pkg.designStrategy.focalPoint}
- Lighting: ${pkg.designStrategy.lightingApproach}
- Soft: ${pkg.designStrategy.softFurnishingApproach}
- Color: ${pkg.designStrategy.colorDirection}

User choices:
${answerText}

Atmosphere: ${pkg.generationGuidance.targetAtmosphere}

Write 10-15 short rules (max 20 words each) for what to ADD to this room.
Rules must integrate designStrategy + user choices.
For "AI decides" answers, use the strategy to choose.
Only addable items: lamps, throws, cushions, plants, wall art, small decor.
Do NOT replace furniture. Do NOT paint walls.
Be SPECIFIC: name exact items, colors, materials, placement.

Also write:
- evaluation: 2-sentence Chinese summary of the design approach
- suggestions: 2-sentence Chinese actionable next steps

Return JSON only:
{
  "designRules": ["rule1", "rule2", ...],
  "evaluation": "...",
  "suggestions": "..."
}`;
}

// ─── Assemble final structured prompt ───────────────────────────────────────

function assemblePrompt(
  pkg: PlanningPackage,
  answers: Record<string, string | string[]>,
  designRules: string[],
): string {
  const sections: string[] = [];

  // [BASE]
  sections.push(`[BASE]\n${FIXED_BASE}`);

  // [SCENE] — extracted from sceneAnalysis, compact
  const scene = pkg.sceneAnalysis;
  sections.push(`[SCENE]\n${scene.roomType}, ${scene.estimatedSize}. ${scene.layout}. Light: ${scene.lightCondition}. Existing: ${scene.existingFurniture.slice(0, 5).join(', ')}.`);

  // [DECLUTTER] — fixed base + clutter-level supplement
  const clutterExtra = scene.clutterLevel !== '整洁'
    ? `\nThis room is "${scene.clutterLevel}" — pay extra attention to removing ALL visible mess before styling.`
    : '';
  sections.push(`[DECLUTTER]\n${FIXED_DECLUTTER_BASE}${clutterExtra}`);

  // [DESIGN_PLAN] — AI-generated rules
  sections.push(`[DESIGN_PLAN]\n${designRules.map((r) => `- ${r}`).join('\n')}`);

  // [AESTHETIC] — fixed, never AI-generated
  sections.push(`[AESTHETIC]\n${FIXED_AESTHETIC}`);

  // [BOUNDARIES] — derived from user answers
  const boundaries = deriveBoundaries(pkg, answers);
  sections.push(`[BOUNDARIES]\n${boundaries.map((b) => `- ${b}`).join('\n')}`);

  // [NEGATIVE] — fixed base + mustAvoid from planningPackage
  const extraNeg = pkg.generationGuidance.mustAvoid;
  const negLine = extraNeg.length > 0
    ? `${FIXED_NEGATIVE_BASE}, ${extraNeg.join(', ')}`
    : FIXED_NEGATIVE_BASE;
  sections.push(`[NEGATIVE]\n${negLine}`);

  return sections.join('\n\n');
}

// ─── Handler ────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;
    const { planningPackage, userAnswers } = body;

    if (!planningPackage || !userAnswers) {
      return NextResponse.json(
        { error: 'Missing planningPackage or userAnswers' },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 500 });
    }

    const model = 'gemini-2.5-flash';
    const metaPrompt = buildMetaPrompt(planningPackage, userAnswers);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: metaPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3,
          },
        }),
      },
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: result?.error?.message || 'Compose failed' },
        { status: 500 },
      );
    }

    const textPart = result?.candidates?.[0]?.content?.parts?.find(
      (p: { text?: string }) => typeof p.text === 'string',
    );

    if (!textPart?.text) {
      return NextResponse.json(
        { error: 'No text response from model' },
        { status: 500 },
      );
    }

    let rawText = textPart.text.trim();
    if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let aiOutput: {
      designRules: string[];
      evaluation: string;
      suggestions: string;
    };

    try {
      aiOutput = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse compose JSON', raw: rawText.slice(0, 500) },
        { status: 500 },
      );
    }

    // Validate
    if (!Array.isArray(aiOutput.designRules) || aiOutput.designRules.length === 0) {
      return NextResponse.json(
        { error: 'Empty designRules from model', raw: rawText.slice(0, 500) },
        { status: 500 },
      );
    }

    // Cap rules at 15
    const designRules = aiOutput.designRules.slice(0, 15);

    // Assemble final prompt
    const prompt = assemblePrompt(planningPackage, userAnswers, designRules);

    return NextResponse.json({
      prompt,
      evaluation: aiOutput.evaluation || '',
      suggestions: aiOutput.suggestions || '',
      // Debug info
      designPlan: designRules,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 },
    );
  }
}
