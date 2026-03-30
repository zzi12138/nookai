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

// Fixed questions Q1–Q4 (AI must not alter these)
const FIXED_QUESTIONS = [
  {
    id: 'q1',
    question: '这个房间你主要用来做什么？',
    purpose: 'Determine primary function to guide layout and furnishing priority',
    options: [
      { value: 'sleep', label: '睡觉休息', desc: '安静、舒适、助眠' },
      { value: 'work', label: '工作学习', desc: '专注、有序、高效' },
      { value: 'relax', label: '放松追剧', desc: '慵懒、舒服、窝着' },
      { value: 'mixed', label: '都有一点', desc: '多功能，灵活使用' },
    ],
    allowMultiple: false,
    fallbackOption: '你来决定',
  },
  {
    id: 'q2',
    question: '你希望待在房间里的感觉是？',
    purpose: 'Determine emotional direction for atmosphere and styling',
    options: [
      { value: 'warm_cozy', label: '温暖治愈', desc: '像被毯子裹住一样舒服' },
      { value: 'calm_quiet', label: '安静平和', desc: '干净、放空、不被打扰' },
      { value: 'energetic', label: '有活力', desc: '明亮、鲜活、有生命力' },
      { value: 'ritual', label: '有仪式感', desc: '精致、讲究、每个角落都好看' },
    ],
    allowMultiple: false,
    fallbackOption: '你来决定',
  },
  {
    id: 'q3',
    question: '你喜欢什么样的光线感觉？',
    purpose: 'Determine lighting strategy — key driver of final image quality',
    options: [
      { value: 'bright', label: '明亮通透', desc: '阳光感，白天自然光的感觉' },
      { value: 'soft_warm', label: '柔和温暖', desc: '暖黄灯光，像咖啡馆的氛围' },
      { value: 'dim_moody', label: '偏暗有氛围', desc: '微光、蜡烛感、有层次' },
    ],
    allowMultiple: false,
    fallbackOption: '你来决定',
  },
  {
    id: 'q4',
    question: '房间整体色调你更偏好？',
    purpose: 'Determine color palette direction',
    options: [
      { value: 'light_warm', label: '浅色温暖', desc: '米白、奶油、原木色' },
      { value: 'light_cool', label: '浅色清爽', desc: '白色、浅灰、薄荷绿' },
      { value: 'dark_rich', label: '深色沉稳', desc: '深棕、墨绿、藏青' },
      { value: 'neutral', label: '无所谓', desc: 'AI 根据房间条件决定' },
    ],
    allowMultiple: false,
    fallbackOption: '你来决定',
  },
];

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
  return `You are an expert interior designer analyzing a rental apartment photo.

Analyze this room and return a JSON object with EXACTLY this structure.
No markdown, no code fences — ONLY raw JSON.

{
  "sceneAnalysis": {
    "roomType": "<卧室/客厅/书房/工作室/etc — pick one>",
    "estimatedSize": "<e.g. '约12㎡'>",
    "existingFurniture": ["<list 3-8 main items visible, in Chinese>"],
    "layout": "<one sentence: spatial arrangement, e.g. '床靠北墙，书桌在窗边'>",
    "lightCondition": "<one sentence: current light situation, e.g. '自然光充足但无人工光源'>",
    "clutterLevel": "<整洁/轻度杂乱/中度杂乱/严重杂乱>",
    "keyAreas": ["<1-3 areas with most renovation potential, e.g. '床头区域', '窗台'>"]
  },
  "designStrategy": {
    "focalPoint": "<which specific area should be the visual center, max 15 words>",
    "lightingApproach": "<what to add/change, specific lamp types, max 20 words>",
    "softFurnishingApproach": "<specific items to add: throws, cushions, rug, etc. Max 20 words>",
    "colorDirection": "<palette in 3-4 color names, e.g. '米白基底+焦糖棕+雾霾蓝点缀'>",
    "risks": ["<2-3 specific risks for THIS room, e.g. '空间小容易堆砌'>"],
    "styleMapping": {
      "warm_cozy+soft_warm+light_warm": "<best matching tag from: ${STYLE_TAGS.join(', ')}>",
      "calm_quiet+bright+light_cool": "<best matching tag>",
      "energetic+bright+light_warm": "<best matching tag>",
      "ritual+dim_moody+dark_rich": "<best matching tag>"
    }
  },
  "dynamicQuestions": [
    {
      "id": "q5",
      "question": "<about renovation boundary for THIS room, in Chinese, max 20 chars>",
      "purpose": "<internal: what this decides, in English>",
      "options": [
        { "value": "<short_key>", "label": "<Chinese, max 8 chars>", "desc": "<Chinese, max 15 chars>" }
      ],
      "allowMultiple": false,
      "fallbackOption": "你来决定"
    },
    {
      "id": "q6",
      "question": "<about a specific detail preference for THIS room, in Chinese, max 20 chars>",
      "purpose": "<internal: what this decides, in English>",
      "options": [
        { "value": "<short_key>", "label": "<Chinese, max 8 chars>", "desc": "<Chinese, max 15 chars>" }
      ],
      "allowMultiple": false,
      "fallbackOption": "你来决定"
    }
  ],
  "generationGuidance": {
    "targetAtmosphere": "<one sentence: the emotional feeling the final image should evoke>",
    "focalPointHint": "<one sentence: where the eye goes and how to achieve it in THIS room>",
    "lightingHint": "<one sentence: specific lighting layers for THIS room>",
    "mustAvoid": ["<3-5 specific things to avoid, based on THIS room's issues>"]
  }
}

RULES for dynamicQuestions:
- Generate EXACTLY 2 questions: q5 and q6
- q5: about renovation boundary (what to keep/change in THIS room)
- q6: about a room-specific detail (bedding, desk setup, plants, etc.)
- Each question: 3-4 options + fallbackOption is always "你来决定"
- Questions must relate to what's actually IN the photo
- Options must be concrete and easy to understand — no design jargon
- All text in Chinese

RULES for styleMapping:
- Map 4 likely user-preference combos to style tags
- ONLY use these tags: ${STYLE_TAGS.join(', ')}
- Keys should be combo patterns like "emotion+light+color"
- This helps the downstream prompt builder pick a coherent direction

RULES for designStrategy:
- Every field: short, specific, actionable
- Use concrete nouns: "落地灯" not "灯具", "亚麻床品" not "床品"
- No marketing copy, no vague adjectives

RULES for generationGuidance:
- mustAvoid: based on THIS room's actual problems (clutter type, lighting issues, etc.)
- All hints must be specific to THIS room, not generic

Return ONLY the JSON. No other text.`;
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

    // Q1-Q4 fixed + Q5-Q6 from AI (capped at 2, with fallback enforced)
    const aiQuestions = (aiOutput.dynamicQuestions || []).slice(0, 2).map((q, i) => ({
      id: `q${5 + i}`,
      question: q.question,
      purpose: q.purpose || '',
      options: (q.options || []).slice(0, 4),
      allowMultiple: q.allowMultiple ?? false,
      fallbackOption: q.fallbackOption || '你来决定',
    }));

    const dynamicQuestionnaire: DynamicQuestion[] = [
      ...FIXED_QUESTIONS,
      ...aiQuestions,
    ];

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
