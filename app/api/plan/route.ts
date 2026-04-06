import { NextResponse } from 'next/server';
import {
  fetchMoonshotJson,
  moonshotErrorMessage,
  moonshotMessageText,
  parseFirstJSONObject,
} from '../../lib/server/moonshot';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

type PlanAIOutput = {
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

// ─── Prompt ─────────────────────────────────────────────────────────────────

function buildPlanPrompt() {
  return `你是一位资深室内设计师，请基于这张房间图输出 JSON（仅 JSON）。

目标：给出”可用于后续生图”的简洁规划。

严格按以下 JSON 结构输出：

{
  “sceneAnalysis”: {
    “roomType”: “卧室”,
    “estimatedSize”: “12平米”,
    “existingFurniture”: [“床”,”书桌”,”椅子”,”衣柜”],
    “layout”: “一句话描述布局”,
    “lightCondition”: “一句话描述光线”,
    “clutterLevel”: “low/medium/high”,
    “keyAreas”: [“床区”,”桌面区”]
  },
  “designStrategy”: {
    “focalPoint”: “主视觉焦点区域”,
    “lightingApproach”: “简洁灯光方案”,
    “softFurnishingApproach”: “软装方向”,
    “colorDirection”: “色彩方向”,
    “risks”: [“风险1”],
    “styleMapping”: {“key1”: “${STYLE_TAGS[0]}”, “key2”: “${STYLE_TAGS[1]}”}
  },
  “dynamicQuestions”: [
    {
      “id”: “q1”,
      “question”: “这个房间你平时主要拿来干嘛？”,
      “purpose”: “了解使用目的”,
      “options”: [
        {“value”: “sleep”, “label”: “睡觉休息”, “desc”: “安安静静躺平”},
        {“value”: “work”, “label”: “办公学习”, “desc”: “需要专注高效”},
        {“value”: “chill”, “label”: “追剧发呆”, “desc”: “纯放松不动脑”},
        {“value”: “ai_decide”, “label”: “你来决定”, “desc”: “交给 AI 自动判断”}
      ],
      “allowMultiple”: true
    }
  ],
  “generationGuidance”: {
    “targetAtmosphere”: “整体氛围”,
    “focalPointHint”: “焦点提示”,
    “lightingHint”: “灯光提示”,
    “mustAvoid”: [“禁忌1”,”禁忌2”]
  }
}

dynamicQuestions 要求（重要！！！）：
- 生成 4-6 题，id 依次为 q1, q2, q3, q4, q5, q6
- 每题 options 数组 3-5 个选项，最后一个固定为 {“value”:”ai_decide”,”label”:”你来决定”,”desc”:”交给 AI 自动判断”}
- 每个 option 必须有 value, label, desc 三个字段
- label 用直白的词，2-6个中文字（例：暖色调、冷色调、亮一点、暗一点、小改、大改）
- desc 用简单说明，4-10个中文字（例：米色棕色为主、整体更亮更通透）
- 禁止文艺比喻！不要出现”云朵””微风””森林””暖炉”这类抽象意象词
- 必须覆盖：使用目的、想要感觉、颜色/深浅、改动强度、反感或想替换的具体物件
- 至少1题问”不喜欢什么/想弱化或替换什么”
- 每题选项必须不同！不同题之间不能出现重复的 label
- q5/q6 选项要引用图中真实可见的物件或区域名称

styleMapping 的值只能是：${STYLE_TAGS.join(', ')}

边界：仅做租房友好改造，不改结构，不改硬装布局。

只返回纯 JSON，不要任何解释。`;
}

// ─── Handler ────────────────────────────────────────────────────────────────

type Payload = {
  image?: string;
};

const AI_DECIDE_OPTION = { value: 'ai_decide', label: '你来决定', desc: '交给 AI 自动判断' };

function pickRoomObject(
  scene: Pick<SceneAnalysis, 'existingFurniture' | 'keyAreas'> | undefined,
  index: number,
  fallback: string,
) {
  const furniture = (scene?.existingFurniture || []).filter(Boolean);
  const keyAreas = (scene?.keyAreas || []).filter(Boolean);
  const pool = [...furniture, ...keyAreas].filter((item) => item && item.length <= 8);
  return pool[index] || fallback;
}

function buildDefaultOptionsByQuestion(
  scene: Pick<SceneAnalysis, 'existingFurniture' | 'keyAreas'> | undefined,
): Record<string, Array<{ value: string; label: string; desc: string }>> {
  const objA = pickRoomObject(scene, 0, '床区');
  const objB = pickRoomObject(scene, 1, '桌面');
  const objC = pickRoomObject(scene, 2, '窗边');

  return {
    q1: [
      { value: 'sleep', label: '休息睡眠', desc: '更放松更助眠' },
      { value: 'work', label: '工作学习', desc: '更专注更高效' },
      { value: 'mixed', label: '两者都要', desc: '兼顾休息与办公' },
    ],
    q2: [
      { value: 'warm', label: '温暖治愈', desc: '暖暖的很放松' },
      { value: 'calm', label: '安静克制', desc: '干净沉稳不吵闹' },
      { value: 'vivid', label: '有氛围感', desc: '更有层次更出片' },
    ],
    q3: [
      { value: 'warm_glow', label: '昏黄暖光', desc: '局部点亮，很有情调' },
      { value: 'bright_clear', label: '明亮通透', desc: '光线充足，视线清晰' },
      { value: 'cinematic', label: '电影质感', desc: '明暗对比强烈，有层次' },
    ],
    q4: [
      { value: 'earth_warm', label: '大地暖色', desc: '米色、棕色与木质调' },
      { value: 'cool_gray_blue', label: '冷调灰蓝', desc: '保留蓝色调，更显高级' },
      { value: 'bw_clean', label: '纯净黑白灰', desc: '经典简约，永不过时' },
    ],
    q5: [
      { value: 'keep_current', label: `${objA}保留现状`, desc: '它是必要功能位' },
      { value: 'weaken_visual', label: `${objB}视觉弱化`, desc: '用软装遮盖或减弱存在感' },
      { value: 'restyle_replace', label: `${objC}风格重做`, desc: '换成更轻盈统一的感觉' },
    ],
    q6: [
      { value: 'fix_clutter', label: `${objB}有点乱`, desc: '想要更清爽的收纳感' },
      { value: 'need_texture', label: `${objC}太空了`, desc: '想补一点温暖层次' },
      { value: 'soft_upgrade', label: `${objA}不够舒服`, desc: '想增强软装和触感' },
    ],
  };
}

function normalizeOption(
  option: { value?: string; label?: string; desc?: string },
  index: number,
) {
  const label = (option.label || '').trim();
  const desc = (option.desc || '').trim();
  return {
    value: (option.value || `option_${index + 1}`).trim(),
    label: (label || `选项${index + 1}`).slice(0, 15),
    desc: (desc || '用于生成方案').slice(0, 30),
  };
}

function isOptionSetUsable(options: Array<{ value: string; label: string; desc: string }>) {
  if (options.length < 2) return false;
  const labels = options.map((o) => o.label.trim()).filter(Boolean);
  if (labels.length < 2) return false;
  const unique = new Set(labels).size;
  if (unique < 2) return false;
  // Only reject if ALL labels are placeholder-style garbage
  const genericPattern = /^(选项|方案|方式|方向|偏好)[A-D\d一二三四五六七八九十]*$/;
  const tooGeneric = labels.every((label) => genericPattern.test(label) || label.length <= 1);
  if (tooGeneric) return false;
  return true;
}

// Removed overly strict optionsMatchQuestionType — it was rejecting valid AI options
// and forcing all questions to use hardcoded fallback options.

function isTooSimilarToPrevious(
  options: Array<{ value: string; label: string; desc: string }>,
  previousLabelSets: string[][],
) {
  const labels = options.map((o) => o.label.trim()).filter(Boolean);
  if (labels.length < 2) return true;

  // Only reject if the MAJORITY of labels are duplicated from a single previous question
  return previousLabelSets.some((prev) => {
    const overlap = labels.filter((l) => prev.includes(l)).length;
    return overlap >= Math.ceil(labels.length * 0.7);
  });
}

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

function buildFallbackQuestionnaire(): DynamicQuestion[] {
  const templates: Array<{
    question: string;
    options: Array<{ value: string; label: string; desc: string }>;
    allowMultiple?: boolean;
  }> = [
    {
      question: '这个房间你最常用来做什么？',
      options: [
        { value: 'sleep', label: '休息睡眠', desc: '更放松更助眠' },
        { value: 'work', label: '工作学习', desc: '更专注更高效' },
        { value: 'mixed', label: '两者都要', desc: '兼顾休息与办公' },
      ],
      allowMultiple: true,
    },
    {
      question: '你更想要哪种整体感觉？',
      options: [
        { value: 'warm', label: '温暖治愈', desc: '放松、柔和、有安全感' },
        { value: 'calm', label: '安静克制', desc: '干净、沉稳、不吵闹' },
        { value: 'vivid', label: '有氛围感', desc: '更有层次、更出片' },
      ],
    },
    {
      question: '你更喜欢什么色彩方向？',
      options: [
        { value: 'light_wood', label: '浅木米白', desc: '明亮自然，耐看' },
        { value: 'warm_earth', label: '大地暖色', desc: '焦糖、棕调、柔和' },
        { value: 'contrast', label: '黑白灰点缀', desc: '更现代有对比' },
      ],
    },
    {
      question: '这次你想小改，还是希望变化明显？',
      options: [
        { value: 'light_touch', label: '小改就好', desc: '保守升级，风险低' },
        { value: 'medium_change', label: '中等改动', desc: '看得出变化' },
        { value: 'bold_change', label: '明显改造', desc: '希望焕然一新' },
      ],
    },
    {
      question: '看这张图，你最想先处理哪一块？',
      options: [
        { value: 'bed_zone', label: '床区', desc: '床品和床边氛围' },
        { value: 'desk_zone', label: '桌面/工作区', desc: '更整洁更有质感' },
        { value: 'window_zone', label: '窗边与灯光', desc: '提高层次和氛围' },
      ],
    },
    {
      question: '有你不喜欢、想弱化或替换的东西吗？',
      options: [
        { value: 'dislike_desk', label: '桌子存在感太强', desc: '想弱化或重新协调' },
        { value: 'dislike_clutter', label: '杂乱感明显', desc: '想更干净有秩序' },
        { value: 'dislike_light', label: '光线单一', desc: '想要更有层次' },
      ],
    },
  ];

  return QUESTION_FRAMEWORK.map((frame, idx) => {
    const t = templates[idx] || templates[0];
    return {
      id: frame.id,
      question: t.question,
      purpose: frame.prompt,
      options: [...t.options, AI_DECIDE_OPTION],
      allowMultiple: Boolean(t.allowMultiple),
      fallbackOption: '你来决定',
    };
  });
}

function buildFallbackPlanningPackage(): PlanningPackage {
  return {
    sceneAnalysis: {
      roomType: '卧室/一体空间',
      estimatedSize: '小户型',
      existingFurniture: ['床', '桌子', '椅子', '窗帘'],
      layout: '保持原有布局，围绕床区与工作区建立视觉层次',
      lightCondition: '自然光一般，夜间需要补充暖光层次',
      clutterLevel: 'medium',
      keyAreas: ['床区', '桌面', '窗边'],
    },
    designStrategy: {
      focalPoint: '床区与床侧灯光',
      lightingApproach: '主灯+辅助灯+氛围灯，形成局部亮、局部暗',
      softFurnishingApproach: '用床品、毯子、地毯和小件软装统一材质与色系',
      colorDirection: '米白、木色、低饱和暖色点缀',
      risks: ['避免装饰堆叠', '避免过冷光源'],
      styleMapping: {
        calm_warm: 'warm_healing',
        clean_simple: 'clean_minimal',
        dark_focus: 'dark_moody',
        natural_light: 'light_natural',
      },
    },
    dynamicQuestionnaire: buildFallbackQuestionnaire(),
    generationGuidance: {
      targetAtmosphere: '温暖、安静、克制、有生活感',
      focalPointHint: '优先让床区成为第一视觉中心',
      lightingHint: '保留自然光，同时增加暖光侧光与局部氛围光',
      mustAvoid: ['不改硬装结构', '不刷墙', '不大动家具'],
      qualityBaseline: QUALITY_BASELINE,
    },
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
    const baseUrl = (process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1').replace(/\/$/, '');
    // Vision call needs a vision-capable model; text retry uses the text model
    const visionModel = process.env.KIMI_VISION_MODEL || 'kimi-k2.5';
    const textModel = process.env.KIMI_PLAN_MODEL || process.env.KIMI_TEXT_MODEL || 'kimi-k2-turbo-preview';
    const prompt = buildPlanPrompt();
    const imageData = parseDataUrl(image);
    let aiOutput: PlanAIOutput | null = null;
    let fallbackReason: string | null = null;
    let visionError: string | null = null;
    let kimiMode: 'vision' | 'text_retry' | 'none' = 'none';

    if (!apiKey) {
      fallbackReason = 'Missing KIMI_API_KEY (or MOONSHOT_API_KEY)';
    } else {
      try {
        const { response, raw: rawApiBody, json: result } = await fetchMoonshotJson({
          url: `${baseUrl}/chat/completions`,
          apiKey,
          timeoutMs: 25_000,
          body: {
            model: visionModel,
            max_tokens: 2048,
            messages: [
              {
                role: 'system',
                content: '你是资深室内设计规划助手，只输出有效 JSON，不要输出任何其他内容。',
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${imageData.mimeType};base64,${imageData.data}`,
                    },
                  },
                  {
                    type: 'text',
                    text: prompt,
                  },
                ],
              },
            ],
          },
        });

        if (!response.ok) {
          throw new Error(moonshotErrorMessage(result, rawApiBody, 'Plan generation failed'));
        }

        const rawContent = moonshotMessageText(result);
        if (!rawContent) {
          throw new Error('No text response from model');
        }

        const parsed = parseFirstJSONObject<PlanAIOutput>(rawContent);
        if (!parsed) {
          throw new Error(`Failed to parse JSON: ${rawContent.slice(0, 120)}`);
        }
        if (!parsed.sceneAnalysis || !parsed.designStrategy || !parsed.generationGuidance) {
          throw new Error('Incomplete response from model');
        }

        aiOutput = parsed;
        kimiMode = 'vision';
      } catch (error) {
        visionError = error instanceof Error ? error.message : 'Plan generation failed';
        fallbackReason = visionError;
      }
    }

    // Retry with text-only Kimi if vision attempt failed (still prefer Kimi over local fallback)
    if (!aiOutput && apiKey) {
      try {
        const { response, raw: rawApiBody, json: result } = await fetchMoonshotJson({
          url: `${baseUrl}/chat/completions`,
          apiKey,
          timeoutMs: 18_000,
          body: {
            model: textModel,
            max_tokens: 1500,
            response_format: {
              type: 'json_object',
            },
            messages: [
              {
                role: 'system',
                content: '你是资深室内设计规划助手，只输出有效 JSON。',
              },
              {
                role: 'user',
                content: `${prompt}

Note: If image understanding is limited, infer a safe rental-room plan with clear assumptions.`,
              },
            ],
          },
        });

        if (!response.ok) {
          throw new Error(moonshotErrorMessage(result, rawApiBody, 'Plan text retry failed'));
        }

        const rawContent = moonshotMessageText(result);
        if (!rawContent) {
          throw new Error('No text response from model (text retry)');
        }
        const parsed = parseFirstJSONObject<PlanAIOutput>(rawContent);
        if (!parsed || !parsed.sceneAnalysis || !parsed.designStrategy || !parsed.generationGuidance) {
          throw new Error('Invalid JSON in text retry');
        }
        aiOutput = parsed;
        kimiMode = 'text_retry';
      } catch (error) {
        fallbackReason = `${fallbackReason || 'plan_failed'} | retry: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    if (!aiOutput) {
      const planningPackage = buildFallbackPlanningPackage();
      return NextResponse.json({
        planningPackage,
        modelProvider: 'local_fallback',
        model: `vision=${visionModel}, text=${textModel}`,
        modelRequestPrompt: prompt,
        fallbackReason,
        degraded: true,
        kimiMode,
      });
    }

    // ── Assemble final PlanningPackage ──

    // Normalize AI questions into 4-6 items, keep framework order when possible.
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

    const defaultOptionsByQuestion = buildDefaultOptionsByQuestion(aiOutput.sceneAnalysis);
    const usedSignatures = new Set<string>();
    const previousLabelSets: string[][] = [];

    const normalizedQuestions: DynamicQuestion[] = orderedQuestions.slice(0, 6).map((aiQ, i) => {
      const frame = QUESTION_FRAMEWORK[i] || QUESTION_FRAMEWORK[0];
      const questionId = frame.id;
      const aiOptions = (aiQ.options || [])
        .slice(0, 5)
        .filter((o) => o.value !== 'ai_decide')
        .map((o, index) => normalizeOption(o, index));
      const aiSignature = aiOptions.map((o) => o.label).join('|');

      let optionsCore = aiOptions;
      const shouldFallback =
        !isOptionSetUsable(aiOptions) ||
        isTooSimilarToPrevious(aiOptions, previousLabelSets) ||
        !aiSignature ||
        usedSignatures.has(aiSignature);

      if (shouldFallback) {
        optionsCore = defaultOptionsByQuestion[questionId] || aiOptions;
      }

      const finalSignature = optionsCore.map((o) => o.label).join('|');
      if (finalSignature) usedSignatures.add(finalSignature);
      previousLabelSets.push(optionsCore.map((o) => o.label.trim()).filter(Boolean));

      return {
        id: questionId,
        question: aiQ.question || `关于${frame.label}你更偏向哪种？`,
        purpose: aiQ.purpose || frame.prompt,
        options: [...optionsCore.slice(0, 5), AI_DECIDE_OPTION],
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

    // Debug: track which questions used AI options vs fallback
    const optionSources: Record<string, string> = {};
    for (const q of dynamicQuestionnaire) {
      const defaultOpts = defaultOptionsByQuestion[q.id];
      if (!defaultOpts) {
        optionSources[q.id] = 'ai';
      } else {
        const defaultLabels = defaultOpts.map((o) => o.label).sort().join('|');
        const actualLabels = q.options.filter((o) => o.value !== 'ai_decide').map((o) => o.label).sort().join('|');
        optionSources[q.id] = actualLabels === defaultLabels ? 'fallback' : 'ai';
      }
    }

    return NextResponse.json({
      planningPackage,
      modelProvider: 'moonshot',
      model: kimiMode === 'vision' ? visionModel : textModel,
      modelRequestPrompt: prompt,
      kimiMode,
      degraded: kimiMode === 'text_retry',
      fallbackReason: kimiMode === 'text_retry' ? (visionError || fallbackReason) : null,
      _debug: {
        visionModel,
        visionError,
        optionSources,
        rawQuestionCount: rawQuestions.length,
        rawQuestionIds: rawQuestions.map((q) => q.id),
        rawQ1OptionsCount: rawQuestions[0]?.options?.length ?? 0,
        rawQ1OptionsSample: (rawQuestions[0]?.options || []).slice(0, 2),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
