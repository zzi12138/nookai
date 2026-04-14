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

// Fixed question type framework — logical progression from understanding to action
// Flow: 了解用途 → 找到痛点 → 确定方向 → 聚焦重点 → 明确边界 → 最后定调
const QUESTION_FRAMEWORK = [
  { id: 'q1', type: 'usage', label: '日常用途', prompt: '这个房间平时主要用来做什么？选项必须贴合房间类型和图中可见的功能区。' },
  { id: 'q2', type: 'painpoint', label: '最大痛点', prompt: '你觉得这个房间目前最大的问题是什么？选项必须是图中可见的具体问题（如灯光太平、桌面太乱、配色不搭、空间显小等）。' },
  { id: 'q3', type: 'focus', label: '重点区域', prompt: '你最想先改哪个区域？选项必须是图中实际可见的具体区域或家具（如床区、书桌周围、窗边、墙面等）。' },
  { id: 'q4', type: 'mood', label: '想要的感觉', prompt: '改完之后你希望房间给你什么感觉？选项要具体，不要泛泛的形容词。' },
  { id: 'q5', type: 'intensity', label: '改动程度', prompt: '你想大改还是小改？选项从保守到大胆，并说明每个程度大概意味着什么变化。' },
  { id: 'q6', type: 'dislike', label: '不想要的', prompt: '有什么是你明确不想要或想去掉的？选项必须引用图中可见的具体东西（如某个颜色、某个物件、某种感觉）。' },
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

严格按以下 JSON 结构输出（所有值都必须根据你看到的图片填写，禁止照抄示例）：

{
  “sceneAnalysis”: {
    “roomType”: “(根据图片判断)”,
    “estimatedSize”: “(估算面积)”,
    “existingFurniture”: [“(图中实际可见的家具)”],
    “layout”: “(描述图中实际布局)”,
    “lightCondition”: “(描述图中实际光线)”,
    “clutterLevel”: “low/medium/high”,
    “keyAreas”: [“(图中有改造潜力的区域)”]
  },
  “designStrategy”: {
    “focalPoint”: “(根据图片选择焦点)”,
    “lightingApproach”: “(根据现有光线建议)”,
    “softFurnishingApproach”: “(根据现有软装建议)”,
    “colorDirection”: “(根据现有颜色建议)”,
    “risks”: [“(针对这个房间的风险)”],
    “styleMapping”: {“组合1”: “${STYLE_TAGS[0]}”, “组合2”: “${STYLE_TAGS[1]}”}
  },
  “dynamicQuestions”: [
    {
      “id”: “q1”,
      “question”: “(根据房间类型写问题)”,
      “purpose”: “(这题要了解什么)”,
      “options”: [
        {“value”: “opt_a”, “label”: “(2-6字)”, “desc”: “(4-10字说明)”},
        {“value”: “opt_b”, “label”: “(2-6字)”, “desc”: “(4-10字说明)”},
        {“value”: “opt_c”, “label”: “(2-6字)”, “desc”: “(4-10字说明)”},
        {“value”: “ai_decide”, “label”: “你来决定”, “desc”: “交给 AI 自动判断”}
      ],
      “allowMultiple”: true
    }
  ],
  “generationGuidance”: {
    “targetAtmosphere”: “(根据图片写氛围)”,
    “focalPointHint”: “(根据图片写焦点提示)”,
    “lightingHint”: “(根据图片写灯光提示)”,
    “mustAvoid”: [“(针对这个房间的禁忌)”]
  }
}

重要：以上括号内的内容是填写说明，不是答案！你必须根据图片内容自己生成，不要复制括号里的文字。

dynamicQuestions 要求（最重要！！！）：

必须生成恰好 6 题，按以下顺序：
q1 日常用途 → q2 最大痛点 → q3 重点区域 → q4 想要的感觉 → q5 改动程度 → q6 不想要的

这个顺序是刻意设计的：先了解怎么用、哪里不好 → 再决定改哪里、改成什么样 → 最后确认改多少、不要什么。

每题格式：
- options 数组 3-5 个选项，最后一个固定为 {“value”:”ai_decide”,”label”:”你来决定”,”desc”:”交给 AI 自动判断”}
- 每个 option 必须有 value, label, desc 三个字段
- label 用直白的词，2-6个中文字
- desc 用简单说明，4-10个中文字

各题具体要求：
q1（用途）：选项要贴合房间类型。卧室就问睡觉/工作/追剧，不要问”会客”。
q2（痛点）：选项必须是图中能看到的具体问题！比如”灯光只有一盏顶灯”、”桌面东西太多”、”颜色不搭”、”空间显得挤”。不要写”缺少美感”这种空话。
q3（重点区域）：选项必须是图中可见的具体位置！比如”床头那面墙”、”书桌周围”、”窗帘和窗边”。
q4（感觉）：要具体。不要”温馨”，要”下班回来想直接瘫在床上的放松感”。不要”简约”，要”东西少、看着清爽”。
q5（改动程度）：从小到大，每个选项说明具体意味着什么。比如”只加灯和抱枕”、”换床品加地毯加灯”、”软装全换风格统一”。
q6（不想要的）：选项必须是图中实际存在的东西！比如”那个XX颜色太突兀”、”桌上的杂物”、”现在的窗帘”。

检验标准：如果把这些选项给10个不同的房间用，应该只适合这一个房间。通用选项 = 失败。
禁止文艺比喻！不要”云朵””微风””森林”这类词。

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
      question: '这个房间你平时主要拿来干嘛？',
      options: [
        { value: 'sleep', label: '睡觉休息', desc: '回来就想躺平' },
        { value: 'work', label: '工作学习', desc: '需要安静专注' },
        { value: 'mixed', label: '都有', desc: '睡觉工作都在这' },
      ],
      allowMultiple: true,
    },
    {
      question: '你觉得这个房间目前最大的问题是？',
      options: [
        { value: 'flat_light', label: '灯光太平', desc: '就一盏大灯，没层次' },
        { value: 'messy', label: '看着比较乱', desc: '东西多，不够整洁' },
        { value: 'no_vibe', label: '没什么氛围', desc: '像毛坯房，冷冰冰' },
      ],
    },
    {
      question: '你最想先改哪个区域？',
      options: [
        { value: 'bed_zone', label: '床周围', desc: '床品、床头、床边' },
        { value: 'desk_zone', label: '桌面区域', desc: '更整洁更好用' },
        { value: 'overall', label: '整体氛围', desc: '灯光和软装一起改' },
      ],
    },
    {
      question: '改完之后你希望是什么感觉？',
      options: [
        { value: 'cozy', label: '回家就放松', desc: '暖暖的窝在里面' },
        { value: 'clean', label: '清爽干净', desc: '东西少看着舒服' },
        { value: 'aesthetic', label: '好看能出片', desc: '朋友来了会夸' },
      ],
    },
    {
      question: '你想改多少？',
      options: [
        { value: 'light', label: '小改就好', desc: '加点灯和抱枕' },
        { value: 'medium', label: '中等改动', desc: '换床品加地毯加灯' },
        { value: 'bold', label: '大变样', desc: '软装全换风格统一' },
      ],
    },
    {
      question: '有什么是你明确不想要的？',
      options: [
        { value: 'no_clutter', label: '杂物太多', desc: '想要更干净的桌面' },
        { value: 'no_cold', label: '冷白光', desc: '不想要办公室的感觉' },
        { value: 'no_boring', label: '太单调', desc: '墙面空空的没生气' },
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
    const visionModel = process.env.KIMI_VISION_MODEL || 'moonshot-v1-8k-vision-preview';
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
          timeoutMs: 35_000,
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
