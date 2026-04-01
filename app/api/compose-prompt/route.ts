import { NextResponse } from 'next/server';
import type { PlanningPackage } from '../plan/route';
import { selectReferenceImages, type StyleReference } from '../../lib/styleReferences';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ─── Types ──────────────────────────────────────────────────────────────────

type Payload = {
  planningPackage: PlanningPackage;
  userAnswers: Record<string, string | string[]>;
};

const WORD_LIMIT = 300;

function trimToWordLimit(text: string, limit = WORD_LIMIT) {
  const words = text.trim().split(/\s+/);
  if (words.length <= limit) return text.trim();
  return `${words.slice(0, limit).join(' ')}\n[TRIMMED_TO_${limit}_WORDS]`;
}

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

// ─── Build meta-prompt for Gemini (compact) ─────────────────────────────────

function buildMetaPrompt(
  pkg: PlanningPackage,
  answers: Record<string, string | string[]>,
  references: StyleReference[],
): string {
  const answerText = resolveAnswers(pkg, answers);
  const referenceText = references.length
    ? `${references[0].label} (${references[0].category})`
    : 'none';

  const prompt = `You are an interior art director. Return JSON only.

Create a compact image-prompt plan for a rental-room makeover.

Scene:
room=${pkg.sceneAnalysis.roomType}, size=${pkg.sceneAnalysis.estimatedSize}
layout=${pkg.sceneAnalysis.layout}
light=${pkg.sceneAnalysis.lightCondition}
focal=${pkg.designStrategy.focalPoint}
mood=${pkg.generationGuidance.targetAtmosphere}
color=${pkg.designStrategy.colorDirection}
reference=${referenceText}
user_choices=${answerText}

Write:
1) primary: exactly 2 actions.
2) secondary: 2-3 actions.
3) declutter: 1 short sentence.
4) moodLight: 1 short sentence.
5) evaluation: 2 Chinese sentences.
6) suggestions: 2 Chinese sentences.

Action rules:
- Start with Add / Place / Drape / Hang.
- Include object + color/material + placement.
- Keep each action under 15 words.
- No explanations, no policy text.

Boundaries:
- Keep room structure and camera unchanged.
- No repaint, no structural edits, no major furniture replacement.

Return JSON:
{
  "primary": ["...", "..."],
  "secondary": ["...", "...", "..."],
  "declutter": "...",
  "moodLight": "...",
  "evaluation": "...",
  "suggestions": "..."
}`;

  return trimToWordLimit(prompt);
}

// ─── Assemble final structured prompt ───────────────────────────────────────

function assemblePrompt(
  pkg: PlanningPackage,
  primary: string[],
  secondary: string[],
  references: StyleReference[],
  declutter: string,
  moodLight: string,
): string {
  const scene = pkg.sceneAnalysis;
  const anchor = references[0];
  const designLines = [...primary.slice(0, 2), ...secondary.slice(0, 3)];
  const compact = `[BASE + SCENE]
Same room, same layout, same camera perspective.
Rental-safe refresh only. No repaint, no structural change, no major furniture replacement.
Room: ${scene.roomType}, ${scene.estimatedSize}. ${scene.layout}
Light now: ${scene.lightCondition}
Focal zone: ${pkg.designStrategy.focalPoint}
${anchor ? `Style anchor: ${anchor.label}.` : ''}

[DECLUTTER]
${declutter || 'Clear visible clutter first. Make bed and surfaces neat before styling.'}

[DESIGN]
${designLines.map((line) => `- ${line}`).join('\n')}

[MOOD + LIGHT]
${moodLight || `Keep ${pkg.generationGuidance.targetAtmosphere} mood with layered light and clear focal contrast.`}`;
  return trimToWordLimit(compact);
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

    const model = process.env.GEMINI_TEXT_MODEL || 'gemini-3-flash-preview';
    const selectedReferences = selectReferenceImages(planningPackage, userAnswers, 1);
    const metaPrompt = buildMetaPrompt(planningPackage, userAnswers, selectedReferences);

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
      primary: string[];
      secondary: string[];
      declutter?: string;
      moodLight?: string;
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

    // Validate & cap: primary ≤ 2, secondary ≤ 3
    const primary = (Array.isArray(aiOutput.primary) ? aiOutput.primary : []).slice(0, 2);
    const secondary = (Array.isArray(aiOutput.secondary) ? aiOutput.secondary : []).slice(0, 3);
    const declutter =
      (aiOutput.declutter || '').trim() ||
      'Clear visible clutter first. Make bed and surfaces neat before styling.';
    const moodLight =
      (aiOutput.moodLight || '').trim() ||
      `Keep ${planningPackage.generationGuidance.targetAtmosphere} mood with layered light and a clear focal center.`;

    if (primary.length === 0 && secondary.length === 0) {
      return NextResponse.json(
        { error: 'Empty design rules from model', raw: rawText.slice(0, 500) },
        { status: 500 },
      );
    }

    // Assemble final prompt
    const prompt = assemblePrompt(planningPackage, primary, secondary, selectedReferences, declutter, moodLight);

    return NextResponse.json({
      prompt,
      evaluation: aiOutput.evaluation || '',
      suggestions: aiOutput.suggestions || '',
      referenceImages: selectedReferences.map((ref) => ref.url),
      referenceImageMeta: selectedReferences.map((ref) => ({
        id: ref.id,
        label: ref.label,
        category: ref.category,
      })),
      // Debug info
      designPlan: { primary, secondary },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 },
    );
  }
}
