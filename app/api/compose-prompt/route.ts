import { NextResponse } from 'next/server';
import type { PlanningPackage } from '../plan/route';
import { selectReferenceImages, type StyleReference } from '../../lib/styleReferences';
import {
  fetchMoonshotJson,
  moonshotErrorMessage,
  moonshotMessageText,
  parseFirstJSONObject,
} from '../../lib/server/moonshot';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ─── Types ──────────────────────────────────────────────────────────────────

type Payload = {
  planningPackage: PlanningPackage;
  userAnswers: Record<string, string | string[]>;
};

type ComposeAIOutput = {
  primary: string[];
  secondary: string[];
  declutter?: string;
  moodLight?: string;
  evaluation: string;
  suggestions: string;
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

function buildFallbackComposeOutput(pkg: PlanningPackage, answerText: string): ComposeAIOutput {
  const focal = pkg.designStrategy.focalPoint || 'bed area';
  const color = pkg.designStrategy.colorDirection || 'warm neutral';
  const atmosphere = pkg.generationGuidance.targetAtmosphere || 'warm and calm';

  return {
    primary: [
      `Place a warm 3000K floor lamp beside the ${focal}.`,
      `Drape a linen throw in ${color} tones over bed or sofa edge.`,
    ],
    secondary: [
      `Add a low-saturation area rug under the focal seating zone.`,
      `Hang one simple framed artwork near the focal wall center.`,
      `Place one medium green plant beside desk or window side.`,
    ],
    declutter: 'Clear visible clutter first, then keep desk and floor surfaces tidy.',
    moodLight: `Keep ${atmosphere} mood with layered side lighting and gentle local shadows.`,
    evaluation: '已根据你的房间条件生成稳妥可落地的改造指令。重点会放在灯光层次与焦点区域氛围建立。',
    suggestions:
      answerText && answerText.trim().length > 0
        ? `建议先按你的偏好落地主变化，再逐步添加辅助软装。若想更大胆，可再次提高改动强度并重生成。`
        : '建议先落地主灯与床区软装，再逐步补充地毯与墙面装饰。若你愿意，可补充偏好后再次生成更个性版本。',
  };
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

    const apiKey = process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY;
    const baseUrl = (process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1').replace(/\/$/, '');
    const model = process.env.KIMI_COMPOSE_MODEL || process.env.KIMI_TEXT_MODEL || 'kimi-k2-turbo-preview';
    const selectedReferences = selectReferenceImages(planningPackage, userAnswers, 1);
    const metaPrompt = buildMetaPrompt(planningPackage, userAnswers, selectedReferences);
    const answerText = resolveAnswers(planningPackage, userAnswers);

    let aiOutput: ComposeAIOutput | null = null;
    let fallbackReason: string | null = null;
    let kimiRetryModel: string | null = null;

    if (!apiKey) {
      fallbackReason = 'Missing KIMI_API_KEY (or MOONSHOT_API_KEY)';
    } else {
      try {
        const { response, raw: rawApiBody, json: result } = await fetchMoonshotJson({
          url: `${baseUrl}/chat/completions`,
          apiKey,
          timeoutMs: 12_000,
          body: {
            model,
            max_tokens: 900,
            response_format: {
              type: 'json_object',
            },
            messages: [
              {
                role: 'system',
                content: 'You are an interior prompt-composer assistant. Return valid JSON only.',
              },
              {
                role: 'user',
                content: metaPrompt,
              },
            ],
          },
        });
        if (!response.ok) {
          throw new Error(moonshotErrorMessage(result, rawApiBody, 'Compose failed'));
        }

        const rawContent = moonshotMessageText(result);
        if (!rawContent) {
          throw new Error('No text response from model');
        }

        const parsed = parseFirstJSONObject<ComposeAIOutput>(rawContent);
        if (!parsed) {
          throw new Error(`Failed to parse compose JSON: ${rawContent.slice(0, 120)}`);
        }

        aiOutput = parsed;
      } catch (error) {
        fallbackReason = error instanceof Error ? error.message : 'Compose failed';
      }
    }

    // Retry once with a faster Kimi model before local fallback
    if (!aiOutput && apiKey) {
      const retryModel = 'kimi-k2-turbo-preview';
      try {
        const { response, raw: rawApiBody, json: result } = await fetchMoonshotJson({
          url: `${baseUrl}/chat/completions`,
          apiKey,
          timeoutMs: 8_000,
          body: {
            model: retryModel,
            max_tokens: 900,
            response_format: {
              type: 'json_object',
            },
            messages: [
              {
                role: 'system',
                content: 'You are an interior prompt-composer assistant. Return valid JSON only.',
              },
              {
                role: 'user',
                content: metaPrompt,
              },
            ],
          },
        });
        if (!response.ok) {
          throw new Error(moonshotErrorMessage(result, rawApiBody, 'Compose retry failed'));
        }
        const rawContent = moonshotMessageText(result);
        if (!rawContent) throw new Error('No text response from retry model');
        const parsed = parseFirstJSONObject<ComposeAIOutput>(rawContent);
        if (!parsed) throw new Error('Retry model returned invalid JSON');
        aiOutput = parsed;
        kimiRetryModel = retryModel;
        fallbackReason = null;
      } catch (error) {
        fallbackReason = `${fallbackReason || 'compose_failed'} | retry: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    if (!aiOutput) {
      aiOutput = buildFallbackComposeOutput(planningPackage, answerText);
    }

    // Validate & cap: primary ≤ 2, secondary ≤ 3
    const primary = (Array.isArray(aiOutput.primary) ? aiOutput.primary : []).slice(0, 2);
    const secondary = (Array.isArray(aiOutput.secondary) ? aiOutput.secondary : []).slice(0, 3);

    if (primary.length === 0 && secondary.length === 0) {
      const local = buildFallbackComposeOutput(planningPackage, answerText);
      aiOutput = local;
    }

    // Assemble final prompt
    const fallbackPrimary = (Array.isArray(aiOutput.primary) ? aiOutput.primary : []).slice(0, 2);
    const fallbackSecondary = (Array.isArray(aiOutput.secondary) ? aiOutput.secondary : []).slice(0, 3);
    const fallbackDeclutter =
      (aiOutput.declutter || '').trim() ||
      'Clear visible clutter first. Make bed and surfaces neat before styling.';
    const fallbackMoodLight =
      (aiOutput.moodLight || '').trim() ||
      `Keep ${planningPackage.generationGuidance.targetAtmosphere} mood with layered light and a clear focal center.`;

    const prompt = assemblePrompt(
      planningPackage,
      fallbackPrimary.length ? fallbackPrimary : primary,
      fallbackSecondary.length ? fallbackSecondary : secondary,
      selectedReferences,
      fallbackDeclutter,
      fallbackMoodLight,
    );

    return NextResponse.json({
      prompt,
      evaluation: aiOutput.evaluation || '',
      suggestions: aiOutput.suggestions || '',
      modelProvider: fallbackReason ? 'local_fallback' : 'moonshot',
      model: kimiRetryModel || model,
      modelRequestPrompt: metaPrompt,
      fallbackReason,
      degraded: Boolean(fallbackReason) || Boolean(kimiRetryModel),
      referenceImages: selectedReferences.map((ref) => ref.url),
      referenceImageMeta: selectedReferences.map((ref) => ({
        id: ref.id,
        label: ref.label,
        category: ref.category,
      })),
      // Debug info
      designPlan: { primary: fallbackPrimary, secondary: fallbackSecondary },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 },
    );
  }
}
