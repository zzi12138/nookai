import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ─── Types ──────────────────────────────────────────────────────────────────

export type SceneAnalysis = {
  roomType: string;
  estimatedSize: string;
  existingFurniture: string[];
  currentIssues: string[];
  strengths: string[];
};

export type DesignStrategy = {
  focusArea: string;
  lightingApproach: string;
  colorDirection: string;
  furnishingApproach: string;
  estimatedBudget: string;
};

export type StepQuestion = {
  id: string;
  question: string;
  options: Array<{ value: string; label: string; desc: string }>;
  allowMultiple: boolean;
};

export type GenerationGuidance = {
  atmosphereGoal: string;
  focalPointRule: string;
  lightingRule: string;
  mustAvoid: string[];
  qualityBaseline: string;
};

export type PlanningPackage = {
  sceneAnalysis: SceneAnalysis;
  designStrategy: DesignStrategy;
  stepQuestions: StepQuestion[];
  generationGuidance: GenerationGuidance;
};

// ─── Prompt ─────────────────────────────────────────────────────────────────

function buildPlanPrompt(style: string, constraints: string[]) {
  const constraintLine = constraints.length > 0
    ? `User constraints: ${constraints.join(', ')}`
    : 'No hard constraints specified.';

  return `You are an expert interior designer analyzing a rental apartment photo.

User selected style: ${style}
${constraintLine}

Analyze this room photo and return a JSON object with EXACTLY this structure.
No markdown, no code fences, no explanation — just raw JSON.

{
  "sceneAnalysis": {
    "roomType": "<bedroom/living room/studio/etc>",
    "estimatedSize": "<rough size in square meters, e.g. '约12平米，长方形'>",
    "existingFurniture": ["<list 3-6 main furniture items visible>"],
    "currentIssues": ["<list 2-4 specific problems: clutter, bad lighting, etc>"],
    "strengths": ["<list 1-3 positives: natural light, high ceiling, etc>"]
  },
  "designStrategy": {
    "focusArea": "<which area of the room should be the visual focal point, be specific>",
    "lightingApproach": "<what lights to add/change, specific lamp types, max 2 sentences>",
    "colorDirection": "<main palette + accent color, specific, e.g. '米白+原木基底，焦糖棕点缀'>",
    "furnishingApproach": "<what textiles/decor to add, specific items, max 2 sentences>",
    "estimatedBudget": "<rough budget range in CNY, e.g. '800-1500元'>"
  },
  "stepQuestions": [
    {
      "id": "q1",
      "question": "<question text in Chinese>",
      "options": [
        { "value": "a", "label": "<short label>", "desc": "<1-line description>" },
        { "value": "b", "label": "<short label>", "desc": "<1-line description>" },
        { "value": "c", "label": "<short label>", "desc": "<1-line description>" }
      ],
      "allowMultiple": false
    }
  ],
  "generationGuidance": {
    "atmosphereGoal": "<the emotional feeling the final image should evoke, 1 sentence>",
    "focalPointRule": "<where the eye should go first and how to achieve it>",
    "lightingRule": "<specific lighting layers: key + accent + mood, tied to this room>",
    "mustAvoid": ["<3-5 specific things to avoid based on this room>"],
    "qualityBaseline": "<what 'good enough' looks like for this specific room>"
  }
}

RULES for stepQuestions:
- Generate 3-5 questions, each with 3-4 options
- All questions must be closed-ended (pick from options, no free text)
- Questions should be about THIS specific room, not generic
- Good questions: lighting mood, color warmth, how much greenery, bedding style, rug preference
- Bad questions: generic "what style do you like" (already chosen), budget (already estimated)
- Each question id must be unique: q1, q2, q3, etc.
- Questions and options must be in Chinese

RULES for designStrategy:
- Every field must be specific to THIS room, not generic advice
- Use concrete nouns: "落地灯" not "灯具", "亚麻床品" not "床品"
- Short, actionable — not marketing copy

RULES for generationGuidance:
- mustAvoid must include room-specific issues (e.g. "地面杂物残留" if there's clutter)
- lightingRule must describe 3 layers tied to specific spots in this room
- qualityBaseline: describe what a successful result looks like for THIS room

Return ONLY the JSON object. No other text.`;
}

// ─── Handler ────────────────────────────────────────────────────────────────

type Payload = {
  image?: string;
  style?: string;
  constraints?: string[];
};

function stripDataUrl(value: string) {
  return value.includes(',') ? value.split(',')[1] : value;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;
    const image = body.image || '';
    const style = body.style || '小红书爆款风';
    const constraints = body.constraints || [];

    if (!image) {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 500 });
    }

    const model = 'gemini-2.5-flash';
    const prompt = buildPlanPrompt(style, constraints);
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
            temperature: 0.4,
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
      (p: any) => typeof p.text === 'string'
    );

    if (!textPart?.text) {
      return NextResponse.json(
        { error: 'No text response from model' },
        { status: 500 }
      );
    }

    // Parse JSON — strip code fences if model adds them
    let rawText = textPart.text.trim();
    if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let planningPackage: PlanningPackage;
    try {
      planningPackage = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse planning package JSON', raw: rawText.slice(0, 500) },
        { status: 500 }
      );
    }

    // Basic validation
    if (
      !planningPackage.sceneAnalysis ||
      !planningPackage.designStrategy ||
      !planningPackage.stepQuestions ||
      !planningPackage.generationGuidance
    ) {
      return NextResponse.json(
        { error: 'Incomplete planning package', raw: rawText.slice(0, 500) },
        { status: 500 }
      );
    }

    // Enforce max 5 questions, max 4 options each
    planningPackage.stepQuestions = planningPackage.stepQuestions.slice(0, 5).map((q) => ({
      ...q,
      options: q.options.slice(0, 4),
    }));

    return NextResponse.json({ planningPackage });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
