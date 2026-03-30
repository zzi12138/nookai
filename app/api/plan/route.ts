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
    "mustAvoid": ["<3-5 items>"]
  }
}

=== DYNAMIC QUESTIONNAIRE (CRITICAL) ===

You must generate EXACTLY 6 questions, following this fixed type framework:
${JSON.stringify(frameworkJSON, null, 2)}

QUESTIONNAIRE GOAL:
- This should feel like a warm, taste-driven conversation, not a cold survey.
- The purpose is to quickly discover the strongest image-changing preferences.
- Prioritize what most affects rendering: desired feeling, color/depth preference, dislike of current objects, willingness for small refresh vs obvious change, and the area/object the user most wants to move visually.
- Do NOT just collect generic information. Every answer must be useful for the next prompt stage.

TONE RULES:
- All questions must be Chinese only, natural, spoken, simple, and warm.
- The assistant should sound like a friendly person with taste chatting while looking at the photo.
- Do NOT sound like a form, product survey, or design consultant.
- Avoid stiff wording like: “请选择你的偏好”, “你的空间氛围是”, “你对当前家具保留策略的态度是”.
- Prefer wording like:
  - “这个房间你更想让它变成什么感觉？”
  - “看到现在这张图，你第一反应最想改哪里？”
  - “你会更喜欢哪种颜色待在房间里？”
  - “这个桌子你还想留着吗？”

EACH question must:
- Follow the type and id from the framework above (q1-q6 in order)
- Have 3-6 options (each: value, label max 6 chars Chinese, desc max 15 chars Chinese)
- The LAST option of EVERY question must ALWAYS use value "ai_decide", but the label/desc should feel natural, such as:
  - { "value": "ai_decide", "label": "你来决定", "desc": "按这张图帮我搭" }
  - { "value": "ai_decide", "label": "你帮我搭", "desc": "我先交给你判断" }
  - { "value": "ai_decide", "label": "我也说不清", "desc": "你看着帮我配" }
- Set allowMultiple: true for questions where multiple answers make sense (q1 usage, q2 emotion, q5 boundary, q6 detail). Keep false for q3 and q4 unless the photo strongly requires multiple answers.
- Every option should be concrete enough to affect the final image, not abstract or generic.

QUESTION DESIGN RULES — adapt to THIS room:
- q1 (usage): Ask what this room should mainly support in daily life. If 卧室, include "睡觉休息"; if desk is visible, include "工作学习"; if sofa is visible, include "放松追剧". Make it feel like daily life, not functionality jargon.
- q2 (emotion): Ask what feeling they want most. This question should help distinguish “更有氛围感” vs “更整洁清爽” vs “更有个性/更有存在感”. If the room is small/dim, still allow one stronger, mood-heavy option instead of only soft/cozy options.
- q3 (lighting): Ask in plain language about brightness and mood, not technical lighting. Options should help infer things like: brighter natural / warmer and softer / darker but more atmospheric / obvious local light pools. This question should influence whether the final image leans clean-bright or moody-layered.
- q4 (color): This question must be MUCH more actionable than “色调偏好”. Options must help infer specific color families and depth preference. Include concrete directions such as black/gray high-contrast, creamy light wood, warm brown/red-brown, green accents, low-saturation neutrals. At least one option should express dark or high-contrast preference, and at least one should express light/natural preference. If possible, let one option imply “统一一点” and another imply “想跳一点颜色”.
- q5 (boundary): This is the MOST IMPORTANT upgrade. It MUST reference a real visible object or area in the current photo by name, such as 床 / 桌子 / 沙发 / 窗帘 / 柜子 / 墙面空区. The question must help discover dislike, retain intent, weaken intent, or visual replacement intent. Good examples:
  - “这个桌子你还想留着吗？”
  - “床这块你想继续现在这样，还是想明显换个感觉？”
  - “这面空墙你想让它更安静，还是更有存在感？”
  One option must explicitly surface a negative or replacement-like intent, such as “看腻了，想弱化”, “先别那么抢眼”, “想换种感觉”.
- q6 (detail): Ask only one final high-value follow-up based on THIS room. Use it to capture either:
  - which area the user most wants to handle first, or
  - whether they want a small refresh vs obvious change, or
  - what current thing feels most碍眼 /最想改.
  This question should help uncover stronger intent, not repeat earlier questions.

FORBIDDEN:
- Do NOT use design jargon (no "日式", "北欧", "极简主义")
- Do NOT ask about "style" or "风格"
- Do NOT ask generic questions that could fit any room
- Do NOT make all questions positive-only; at least one question must reveal dislike / annoyance / what to weaken
- All questions must be answerable by someone with zero design knowledge
- Do NOT generate the same options for every room — if two rooms look different, questions must be different

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

    const model = 'gemini-2.5-flash';
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
