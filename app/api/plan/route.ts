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
  visualImpactRules: {
    lightingContrast: string;
    focalPriority: string;
    emotionalTone: string;
    minimalismDiscipline: string;
    livedInFeeling: string;
  };
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
  const frameworkJSON = QUESTION_FRAMEWORK.map((q) => ({
    id: q.id,
    type: q.type,
    instruction: q.prompt,
  }));

  return `You are an expert interior designer analyzing a rental apartment photo.

Return a JSON object with EXACTLY this structure. No markdown, no code fences — ONLY raw JSON.

{
  "sceneAnalysis": {
    "roomType": "<卧室/客厅/书房/工作室/etc>",
    "estimatedSize": "<e.g. '约12㎡'>",
    "existingFurniture": ["<3-8 main items, Chinese>"],
    "layout": "<one sentence: spatial arrangement>",
    "lightCondition": "<one sentence: current lighting>",
    "clutterLevel": "<整洁/轻度杂乱/中度杂乱/严重杂乱>",
    "keyAreas": ["<1-3 areas with renovation potential>"]
  },
  "designStrategy": {
    "focalPoint": "<specific area as visual center, max 15 words>",
    "lightingApproach": "<specific lamp types to add, max 20 words>",
    "softFurnishingApproach": "<specific items: throws, cushions, rug, etc. Max 20 words>",
    "colorDirection": "<3-4 color names, e.g. '米白基底+焦糖棕+雾霾蓝点缀'>",
    "risks": ["<2-3 risks for THIS room>"],
    "styleMapping": {
      "<combo1>": "<tag from: ${STYLE_TAGS.join(', ')}>",
      "<combo2>": "<tag>",
      "<combo3>": "<tag>",
      "<combo4>": "<tag>"
    }
  },
  "dynamicQuestions": [
    // EXACTLY 6 questions, one for each type below
  ],
  "generationGuidance": {
    "targetAtmosphere": "<one sentence>",
    "focalPointHint": "<one sentence>",
    "lightingHint": "<one sentence>",
    "visualImpactRules": {
      "lightingContrast": "<one sentence about light and shadow structure>",
      "focalPriority": "<one sentence about visual center and surrounding hierarchy>",
      "emotionalTone": "<one sentence about the emotional mood of the frame>",
      "minimalismDiscipline": "<one sentence about restraint and fewer-but-stronger additions>",
      "livedInFeeling": "<one sentence about natural, lived-in realism>"
    },
    "mustAvoid": ["<3-5 items>"]
  }
}

=== DYNAMIC QUESTIONNAIRE (CRITICAL) ===

You must generate EXACTLY 6 questions, following this fixed type framework:
${JSON.stringify(frameworkJSON, null, 2)}

QUESTIONNAIRE GOAL:
- The questionnaire should feel like a warm, natural conversation with someone who has taste, not a survey or form.
- Its job is to uncover the few preferences that most strongly change the generated image.
- Prioritize discovering: what feeling the user wants, what color/depth direction they prefer, what in the current room they dislike, whether they want a subtle refresh or obvious change, and which visible area/object matters most.
- The questions should help reveal both positive preferences and negative reactions.
- Every answer must be useful for the next prompt stage. Do not ask anything that will not influence generation.

TONE + EXPERIENCE:
- All questions must be Chinese only, natural, spoken, simple, and warm.
- The assistant should sound friendly, aesthetically sensitive, and easy to talk to.
- Do NOT sound like a questionnaire, product survey, or professional interview.
- Avoid stiff phrasing, labels, and abstract wording. The user should feel like they are being guided, not examined.

QUESTION QUALITY RULES:
- Follow the type and id from the framework above (q1-q6 in order).
- Keep total questions at exactly 6, but make them feel light and purposeful.
- Have 3-6 options per question (label max 6 Chinese chars, desc max 15 Chinese chars).
- The LAST option of EVERY question must ALWAYS use value "ai_decide", but its label/desc should feel natural and relaxed rather than mechanical.
- Use allowMultiple only when it truly helps the user express something meaningful.
- Options must be concrete, easy to understand, and directly usable by scene 2.

CONTENT DIRECTION:
- q1 should quickly clarify how the room should mainly serve daily life.
- q2 should uncover the emotional direction of the final image, especially whether the user values atmosphere, calmness, cleanliness, personality, or liveliness.
- q3 and q4 together should produce actionable image cues, especially brightness, warmth, depth, contrast, dark-vs-light preference, and specific color-family leanings.
- At least one question must reveal dislike, annoyance, weakening intent, or replacement intent — not only “what do you like”.
- q5 must reference a REAL visible object or area from the current photo by name, such as bed, desk, sofa, curtains, cabinet, or empty wall. It should help reveal whether the user wants to keep it, soften it, hide it visually, or give it a different feeling.
- q6 should be a high-value follow-up that helps clarify change intensity, first-priority area, or the thing the user most wants to fix.

COLOR REQUIREMENT:
- Color questions must be specific enough that scene 2 can infer useful prompt instructions.
- The answers should make it possible to infer things like:
  - black / gray / white / wood / warm brown / red accents / green accents
  - light vs dark
  - low saturation vs stronger contrast
  - unified palette vs one accent color
- Do not keep color at the level of vague “tone preference”.

IMPORTANT BEHAVIOR:
- Different rooms should produce noticeably different questions and options.
- Do not make every question optimistic-only; the model must be able to discover what the user wants to weaken or change.
- All questions must be answerable by someone with zero design knowledge.
- Do NOT ask about “style” or “风格”.
- Do NOT use design jargon.

=== STYLE MAPPING ===
- Map 4 likely user-preference combos to tags
- ONLY use: ${STYLE_TAGS.join(', ')}
- Keys: combo of q2_value+q3_value+q4_value (e.g. "warm_cozy+soft_warm+light_warm")

=== DESIGN STRATEGY ===
- Short, specific, actionable — concrete nouns not vague adjectives
- "落地灯+台灯组合" not "增加灯光层次"

=== GENERATION GUIDANCE ===
- mustAvoid: based on THIS room's actual problems
- All hints specific to THIS room

=== VISUAL IMPACT RULES (NEW, VERY IMPORTANT) ===
You must define what makes the final image feel "editorial", "Xiaohongshu-ready", and visually striking.

This section is NOT about objects, shopping, or style labels.
It is about image-making principles — as if guiding a photographer or interior stylist.

visualImpactRules must contain exactly these 5 fields:
- lightingContrast
- focalPriority
- emotionalTone
- minimalismDiscipline
- livedInFeeling

Rules for visualImpactRules:
- Write only visual principles, not shopping suggestions.
- Do NOT mention specific objects like lamp / rug / sofa / cushion.
- Do NOT mention style words like 日式 / 北欧 / 法式.
- Focus on how the image should work, not what to buy.

Each field should define:
- lightingContrast: clear light source, visible bright-dark contrast, local glow plus local shadow, never evenly lit.
- focalPriority: one obvious visual center, brighter/richer focal area, surrounding areas intentionally weaker.
- emotionalTone: the frame must communicate one clear feeling, such as warm / calm / relaxed / immersive, not just "pretty".
- minimalismDiscipline: fewer but stronger, no over-decoration, every added element must earn its place.
- livedInFeeling: realistic, slightly imperfect, slightly relaxed, never showroom-stiff.

Goal:
- After scene 1, scene 2 should naturally move toward images with stronger light hierarchy, clearer focus, stronger emotional tone, and more editorial tension.
- The output should define what makes the frame impressive, not just reasonable.

Return ONLY the JSON.`;
}

// ─── Handler ────────────────────────────────────────────────────────────────

type Payload = {
  image?: string;
};

function stripDataUrl(value: string) {
  return value.includes(',') ? value.split(',')[1] : value;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;
    const image = body.image || '';

    if (!image) {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 500 });
    }

    const model = process.env.GEMINI_TEXT_MODEL || 'gemini-3-flash-preview';
    const prompt = buildPlanPrompt();
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
            responseMimeType: 'application/json',
            temperature: 0.3,
          },
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

    const textPart = result?.candidates?.[0]?.content?.parts?.find(
      (p: { text?: string }) => typeof p.text === 'string'
    );

    if (!textPart?.text) {
      return NextResponse.json(
        { error: 'No text response from model' },
        { status: 500 }
      );
    }

    // Parse JSON
    let rawText = textPart.text.trim();
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

    // All 6 questions from AI, enforce structure
    const AI_DECIDE_OPTION = { value: 'ai_decide', label: '你来决定', desc: '交给 AI 自动判断' };
    const rawQuestions = aiOutput.dynamicQuestions || [];
    const dynamicQuestionnaire: DynamicQuestion[] = QUESTION_FRAMEWORK.map((frame, i) => {
      const aiQ = rawQuestions.find((q) => q.id === frame.id) || rawQuestions[i];
      if (aiQ) {
        // Cap at 6 options, ensure "你来决定" is always the last option
        let options = (aiQ.options || []).slice(0, 6).filter((o) => o.value !== 'ai_decide');
        options.push(AI_DECIDE_OPTION);
        return {
          id: frame.id,
          question: aiQ.question || `关于${frame.label}的偏好？`,
          purpose: aiQ.purpose || frame.prompt,
          options,
          allowMultiple: aiQ.allowMultiple ?? false,
          fallbackOption: '你来决定',
        };
      }
      // Fallback if AI missed this question
      return {
        id: frame.id,
        question: `关于${frame.label}的偏好？`,
        purpose: frame.prompt,
        options: [
          { value: 'option_a', label: '选项A', desc: '默认选项' },
          { value: 'option_b', label: '选项B', desc: '默认选项' },
          AI_DECIDE_OPTION,
        ],
        allowMultiple: false,
        fallbackOption: '你来决定',
      };
    });

    // Force qualityBaseline to fixed constant
    const generationGuidance: GenerationGuidance = {
      targetAtmosphere: aiOutput.generationGuidance.targetAtmosphere || '',
      focalPointHint: aiOutput.generationGuidance.focalPointHint || '',
      lightingHint: aiOutput.generationGuidance.lightingHint || '',
      visualImpactRules: {
        lightingContrast:
          aiOutput.generationGuidance.visualImpactRules?.lightingContrast ||
          'Light should have a clear source and visible bright-dark contrast, never flat or evenly spread.',
        focalPriority:
          aiOutput.generationGuidance.visualImpactRules?.focalPriority ||
          'The frame needs one obvious visual center, with richer detail there and quieter surrounding areas.',
        emotionalTone:
          aiOutput.generationGuidance.visualImpactRules?.emotionalTone ||
          'The final image should communicate one clear mood instead of only looking neat or decorative.',
        minimalismDiscipline:
          aiOutput.generationGuidance.visualImpactRules?.minimalismDiscipline ||
          'Use fewer but stronger additions, and avoid filling the room with unnecessary decorative noise.',
        livedInFeeling:
          aiOutput.generationGuidance.visualImpactRules?.livedInFeeling ||
          'Keep a natural lived-in softness so the room feels real, relaxed, and not like a showroom.',
      },
      mustAvoid: (aiOutput.generationGuidance.mustAvoid || []).slice(0, 5),
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

    return NextResponse.json({ planningPackage });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
