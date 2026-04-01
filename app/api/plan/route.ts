import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ─── Fixed constants (not AI-generated) ─────────────────────────────────────

const STYLE_TAGS = [
  'warm_healing',
  'clean_minimal',
  'dark_moody',
  'light_natural',
  'lively_social',
] as const;

const QUALITY_BASELINE = [
  'clear focal area',
  'layered warm lighting',
  'controlled composition',
  'limited palette',
  'clean but lived-in',
  'realistic and visually striking',
] as const;

// Fixed question type framework — AI must follow this order and these types
const QUESTION_FRAMEWORK = [
  { id: 'q1', type: 'usage', label: '使用目的', prompt: 'What will this room mainly be used for? Adapt options to roomType.' },
  { id: 'q2', type: 'emotion', label: '情绪感受', prompt: 'What feeling should the room evoke? Adapt to room size and current state.' },
  { id: 'q3', type: 'lighting', label: '光线偏好', prompt: 'What lighting feel do they want? Adapt to current lightCondition.' },
  { id: 'q4', type: 'color', label: '色调倾向', prompt: 'Color palette preference? Adapt to existing furniture colors and wall color.' },
  { id: 'q5', type: 'boundary', label: '改造边界', prompt: 'What can/cannot be changed? Adapt to existing furniture situation.' },
  { id: 'q6', type: 'detail', label: '房间细节偏好', prompt: 'Specific detail preference for THIS room. Must be unique to what is visible.' },
] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export type SceneAnalysis = {
  roomType: string;
  estimatedSize: string;
  existingFurniture: string[];
  layout: string;
  lightCondition: string;
  clutterLevel: string;
  keyAreas: string[];
};

export type DesignStrategy = {
  focalPoint: string;
  lightingApproach: string;
  softFurnishingApproach: string;
  colorDirection: string;
  risks: string[];
  styleMapping: Record<string, string>;
};

export type DynamicQuestion = {
  id: string;
  question: string;
  purpose: string;
  options: Array<{ value: string; label: string; desc: string }>;
  allowMultiple: boolean;
  fallbackOption: string;
};

export type GenerationGuidance = {
  targetAtmosphere: string;
  focalPointHint: string;
  lightingHint: string;
  mustAvoid: string[];
  qualityBaseline: readonly string[];
};

export type PlanningPackage = {
  sceneAnalysis: SceneAnalysis;
  designStrategy: DesignStrategy;
  dynamicQuestionnaire: DynamicQuestion[];
  generationGuidance: GenerationGuidance;
};

// ─── Prompt ─────────────────────────────────────────────────────────────────

function buildPlanPrompt() {
  return `Analyze the rental-room photo and output JSON only.

Output fields:
sceneAnalysis: roomType, estimatedSize, existingFurniture(4-8 CN nouns), layout(1 sentence), lightCondition(1 sentence), clutterLevel, keyAreas(1-3).
designStrategy: focalPoint, lightingApproach, softFurnishingApproach, colorDirection, risks(<=2), styleMapping(4 combos, tags only from ${STYLE_TAGS.join(', ')}).
dynamicQuestions: 4-6 Chinese questions (friendly, conversational, simple, warm). Each question has id, question, purpose, options, allowMultiple, fallbackOption.
generationGuidance: targetAtmosphere, focalPointHint, lightingHint, mustAvoid(2-4).

Core direction:
- Give one clear visual center and one clear mood.
- Keep guidance short and image-oriented, not a rule document.
- Mention concrete design actions through wording in lightingApproach + softFurnishingApproach (3-5 actionable moves total, with object/color/placement hints).
- Keep rental-safe boundaries in mind: no structural change, no repaint, no major furniture replacement.

Question goals:
- Discover use scenario, desired feeling, color/depth preference, change intensity, and one disliked visible object/area.
- At least one question must ask what the user dislikes or wants to weaken/replace visually.
- q5 should reference a real visible object/area in the photo.
- Options must be useful for image generation.
- Last option of every question must use value "ai_decide" with natural label/desc.

Return raw JSON only.`;
}

// ─── Handler ────────────────────────────────────────────────────────────────

type Payload = {
  image?: string;
};

function parseDataUrl(value: string) {
  const match = value.match(/^data:(.*?);base64,(.*)$/);
  if (!match) {
    return {
      mimeType: 'image/jpeg',
      data: value,
    };
  }
  return {
    mimeType: match[1] || 'image/jpeg',
    data: match[2] || '',
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;
    const image = body.image || '';

    if (!image) {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 });
    }

    const apiKey = process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing KIMI_API_KEY (or MOONSHOT_API_KEY)' },
        { status: 500 }
      );
    }

    const baseUrl = (process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.ai/v1').replace(/\/$/, '');
    const model = process.env.KIMI_TEXT_MODEL || 'kimi-k2.5';
    const prompt = buildPlanPrompt();
    const imageData = parseDataUrl(image);

    const response = await fetch(
      `${baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          response_format: {
            type: 'json_object',
          },
          messages: [
            {
              role: 'system',
              content: 'You are a precise interior-planning assistant. Return valid JSON only.',
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${imageData.mimeType};base64,${imageData.data}`,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: result?.error?.message || 'Plan generation failed' },
        { status: 500 }
      );
    }

    const messageContent = result?.choices?.[0]?.message?.content;
    const rawContent =
      typeof messageContent === 'string'
        ? messageContent
        : Array.isArray(messageContent)
          ? messageContent
              .map((part: { type?: string; text?: string }) =>
                part?.type === 'text' ? part.text || '' : ''
              )
              .join('\n')
          : '';

    if (!rawContent) {
      return NextResponse.json(
        { error: 'No text response from model' },
        { status: 500 }
      );
    }

    // Parse JSON
    let rawText = rawContent.trim();
    if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let aiOutput: {
      sceneAnalysis: SceneAnalysis;
      designStrategy: DesignStrategy;
      dynamicQuestions: Array<{
        id: string;
        question: string;
        purpose: string;
        options: Array<{ value: string; label: string; desc: string }>;
        allowMultiple?: boolean;
        fallbackOption?: string;
      }>;
      generationGuidance: Omit<GenerationGuidance, 'qualityBaseline'>;
    };

    try {
      aiOutput = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse JSON', raw: rawText.slice(0, 500) },
        { status: 500 }
      );
    }

    // Validate core fields exist
    if (!aiOutput.sceneAnalysis || !aiOutput.designStrategy || !aiOutput.generationGuidance) {
      return NextResponse.json(
        { error: 'Incomplete response', raw: rawText.slice(0, 500) },
        { status: 500 }
      );
    }

    // ── Assemble final PlanningPackage ──

    // Normalize AI questions into 4-6 items, keep framework order when possible.
    const AI_DECIDE_OPTION = { value: 'ai_decide', label: '你来决定', desc: '交给 AI 自动判断' };
    const rawQuestions = aiOutput.dynamicQuestions || [];
    const byId = new Map(rawQuestions.map((q) => [q.id, q]));
    const orderedQuestions = QUESTION_FRAMEWORK
      .map((frame, i) => byId.get(frame.id) || rawQuestions[i] || null)
      .filter(Boolean) as Array<{
      id: string;
      question: string;
      purpose: string;
      options: Array<{ value: string; label: string; desc: string }>;
      allowMultiple?: boolean;
    }>;

    const normalizedQuestions: DynamicQuestion[] = orderedQuestions.slice(0, 6).map((aiQ, i) => {
      const frame = QUESTION_FRAMEWORK[i] || QUESTION_FRAMEWORK[0];
      const options = (aiQ.options || [])
        .slice(0, 5)
        .filter((o) => o.value !== 'ai_decide')
        .map((o) => ({
          value: o.value || `option_${Math.random().toString(36).slice(2, 7)}`,
          label: (o.label || '默认选项').slice(0, 8),
          desc: (o.desc || '可用于生成').slice(0, 18),
        }));
      return {
        id: aiQ.id || frame.id,
        question: aiQ.question || `关于${frame.label}你更偏向哪种？`,
        purpose: aiQ.purpose || frame.prompt,
        options: [...options, AI_DECIDE_OPTION],
        allowMultiple: aiQ.allowMultiple ?? false,
        fallbackOption: '你来决定',
      };
    });

    while (normalizedQuestions.length < 4) {
      const frame = QUESTION_FRAMEWORK[normalizedQuestions.length];
      normalizedQuestions.push({
        id: frame.id,
        question: `关于${frame.label}你更偏向哪种？`,
        purpose: frame.prompt,
        options: [
          { value: 'option_a', label: '选项A', desc: '偏向这个方向' },
          { value: 'option_b', label: '选项B', desc: '另一种方向' },
          AI_DECIDE_OPTION,
        ],
        allowMultiple: false,
        fallbackOption: '你来决定',
      });
    }
    const dynamicQuestionnaire = normalizedQuestions.slice(0, 6);

    // Force qualityBaseline to fixed constant
    const generationGuidance: GenerationGuidance = {
      targetAtmosphere: aiOutput.generationGuidance.targetAtmosphere || '',
      focalPointHint: aiOutput.generationGuidance.focalPointHint || '',
      lightingHint: aiOutput.generationGuidance.lightingHint || '',
      mustAvoid: (aiOutput.generationGuidance.mustAvoid || []).slice(0, 4),
      qualityBaseline: QUALITY_BASELINE,
    };

    // Validate styleMapping values — only allow known tags
    const validTags = new Set<string>(STYLE_TAGS);
    const rawMapping = aiOutput.designStrategy.styleMapping || {};
    const cleanMapping: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawMapping)) {
      if (validTags.has(v)) {
        cleanMapping[k] = v;
      } else {
        cleanMapping[k] = 'warm_healing'; // safe fallback
      }
    }
    aiOutput.designStrategy.styleMapping = cleanMapping;

    const planningPackage: PlanningPackage = {
      sceneAnalysis: aiOutput.sceneAnalysis,
      designStrategy: aiOutput.designStrategy,
      dynamicQuestionnaire,
      generationGuidance,
    };

    return NextResponse.json({
      planningPackage,
      modelProvider: 'moonshot',
      model,
      modelRequestPrompt: prompt,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
