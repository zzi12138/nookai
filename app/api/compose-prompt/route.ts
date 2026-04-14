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
  sceneVision: string;
  lightingDesc: string;
  textureAndColor: string;
  focalDetail: string;
  keepUnchanged: string;
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

  const prompt = `You are a world-class interior photographer describing the AFTER photo of a room makeover. Return JSON only.

This room:
type=${pkg.sceneAnalysis.roomType}, size=${pkg.sceneAnalysis.estimatedSize}
furniture=${pkg.sceneAnalysis.existingFurniture.join(', ')}
layout=${pkg.sceneAnalysis.layout}
current_light=${pkg.sceneAnalysis.lightCondition}
focal_zone=${pkg.designStrategy.focalPoint}
desired_mood=${pkg.generationGuidance.targetAtmosphere}
color_direction=${pkg.designStrategy.colorDirection}
soft_furnishing=${pkg.designStrategy.softFurnishingApproach}
lighting_plan=${pkg.designStrategy.lightingApproach}
reference_style=${referenceText}
user_preferences=${answerText || 'AI decides all'}

Your task: Describe the FINAL transformed scene as if you are looking at a stunning magazine photo. NOT a list of actions — paint the picture.

Write these fields:
1) sceneVision: 2-3 sentences. Describe the overall atmosphere of the transformed room. What does it FEEL like to walk in? What catches your eye first? Use sensory language — light quality, warmth, depth, texture. Write as if captioning a beautiful interior photo.

2) lightingDesc: 1-2 sentences. Describe the SPECIFIC lighting in the final scene. Name exact light sources (e.g. "a warm amber floor lamp casting a pool of gold on the bedside", "soft LED strip behind the headboard creating a halo glow"). Describe shadows, warmth, contrast. This is the most important part — lighting makes or breaks the photo.

3) textureAndColor: 1-2 sentences. Describe the material palette visible in the scene — fabrics, wood grain, metal finishes. Name specific colors (not just "warm tones" but "cream linen, walnut wood, matte brass, sage green cushion").

4) focalDetail: 1-2 sentences. Zoom into the hero area (${pkg.designStrategy.focalPoint}). Describe exactly what it looks like after transformation — specific items, their arrangement, their visual weight.

5) keepUnchanged: 1 sentence. List what stays exactly the same (walls, floor, major furniture positions, ceiling, windows).

6) evaluation: 2 sentences in Chinese. Evaluate what this room needs most.
7) suggestions: 2 sentences in Chinese. Practical advice for the user.

CRITICAL RULES:
- The room MUST be recognizable as the same room. Same walls, floor, ceiling, windows, doors.
- All large furniture (${pkg.sceneAnalysis.existingFurniture.slice(0, 4).join(', ')}) stays in the same position.
- Be BOLD with styling but CONSERVATIVE with structure. Make it magazine-worthy.
- Write in English for fields 1-5.

Return JSON:
{
  "sceneVision": "...",
  "lightingDesc": "...",
  "textureAndColor": "...",
  "focalDetail": "...",
  "keepUnchanged": "...",
  "evaluation": "...",
  "suggestions": "..."
}`;

  return trimToWordLimit(prompt);
}

// ─── Assemble final structured prompt ───────────────────────────────────────

function assemblePrompt(
  pkg: PlanningPackage,
  ai: ComposeAIOutput,
  references: StyleReference[],
): string {
  const scene = pkg.sceneAnalysis;
  const furnitureList = scene.existingFurniture.slice(0, 6).join(', ');
  const anchor = references[0];
  const compact = `TASK: Edit this photo. Add styling and lighting to make it beautiful. DO NOT generate a new room.

=== RULE #1 (MOST IMPORTANT — violating this makes the output WRONG) ===
This is a PHOTO EDITING task on the input image. The output must be the SAME room:
- SAME walls (same color, same texture, same cracks/marks)
- SAME floor (same material, same color)
- SAME ceiling, windows, doors (same position, same shape)
- SAME camera angle and perspective (exact match)
- SAME major furniture in SAME positions: ${furnitureList}
- You may ADD small items (lamps, pillows, plants, throws) and CHANGE lighting
- You may NOT move, remove, or replace any existing furniture
- You may NOT change wall color, floor material, or room dimensions
If the output looks like a different room, it is WRONG.
===

Now, within these constraints, make the room look stunning:

[SCENE VISION]
${ai.sceneVision}

[LIGHTING]
${ai.lightingDesc}

[TEXTURES & COLORS]
${ai.textureAndColor}

[FOCUS AREA — ${pkg.designStrategy.focalPoint}]
${ai.focalDetail}

${anchor ? `[STYLE MOOD: ${anchor.label}]\nUse for color/mood inspiration only. Do NOT copy its room layout or furniture.` : ''}

[PHOTO QUALITY]
- Must look like a real photograph, not a 3D render or AI art.
- Realistic materials with visible texture (fabric weave, wood grain).
- Slight lived-in feel: a casually draped throw, natural light falloff.
- Cohesive color grading across the entire image.

=== FINAL CHECK ===
Compare your output with the input photo. If walls, floor, furniture positions, or camera angle changed: REDO. The viewer must instantly say "that's the same room, but nicer."`;
  return trimToWordLimit(compact, 500);
}

function buildFallbackComposeOutput(pkg: PlanningPackage): ComposeAIOutput {
  const focal = pkg.designStrategy.focalPoint || 'bed area';
  const color = pkg.designStrategy.colorDirection || 'warm neutral tones';
  const atmosphere = pkg.generationGuidance.targetAtmosphere || 'warm, calm, and inviting';
  const furniture = pkg.sceneAnalysis.existingFurniture.slice(0, 4).join(', ') || 'bed, desk';

  return {
    sceneVision: `The room feels like a warm retreat — soft ambient light fills the space, drawing the eye to the ${focal} which now anchors the room with quiet confidence. Every surface has intention: layered textiles, gentle curves, and a palette of ${color} that ties the space together into a cohesive, magazine-worthy scene.`,
    lightingDesc: `A warm 2700K floor lamp beside the ${focal} casts a golden pool of light across the textured throw. A subtle LED strip behind the headboard or shelf creates a soft halo glow, while the overhead light is dimmed to let the accent lighting do the storytelling.`,
    textureAndColor: `The palette anchors on ${color} — think linen bedding, a chunky knit throw, matte ceramic, and raw wood grain. Small pops of muted sage or dusty rose add depth without competing.`,
    focalDetail: `The ${focal} is now the undeniable hero: dressed in layered bedding with a textured throw casually draped, flanked by warm side lighting and a small curated vignette of objects that feel personal and lived-in.`,
    keepUnchanged: `Walls, floor, ceiling, windows, doors remain identical. ${furniture} stay in the same positions.`,
    evaluation: '这个空间有不错的改造基础，目前最大的问题是缺乏氛围感和视觉层次——灯光太平，软装太少，空间显得单调冷清。',
    suggestions: '建议重点投入三件事：1) 增加 2-3 个不同高度的暖光源；2) 用织物（毯子、抱枕、床品）建立质感层次；3) 在焦点区域创造一个让人想拍照的"角落"。',
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
      aiOutput = buildFallbackComposeOutput(planningPackage);
    }

    // Validate essential fields
    if (!aiOutput.sceneVision || !aiOutput.lightingDesc) {
      aiOutput = buildFallbackComposeOutput(planningPackage);
    }

    const prompt = assemblePrompt(
      planningPackage,
      aiOutput,
      selectedReferences,
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
      designPlan: {
        sceneVision: aiOutput.sceneVision,
        lightingDesc: aiOutput.lightingDesc,
        focalDetail: aiOutput.focalDetail,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 },
    );
  }
}
