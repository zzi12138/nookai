import { NextResponse } from 'next/server';
import {
  fetchMoonshotJson,
  moonshotErrorMessage,
  moonshotMessageText,
  parseFirstJSONObject,
} from '../../lib/server/moonshot';

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

目标：给出“可用于后续生图”的简洁规划，不要写成长文档。

请输出：
1) sceneAnalysis
- roomType, estimatedSize
- existingFurniture（4-8个中文名词）
- layout（1句中文）
- lightCondition（1句中文）
- clutterLevel, keyAreas（1-3个）

2) designStrategy
- focalPoint（明确主角区域）
- lightingApproach（简洁可执行）
- softFurnishingApproach
- colorDirection
- risks（最多2条）
- styleMapping（4项，值仅可用：${STYLE_TAGS.join(', ')}）

3) dynamicQuestions（4-6题）
- 问法口语化、有温度、像聊天
- 每题只问一件事，选项简短实用
- 必须覆盖：使用目的、想要感觉、颜色/深浅、改动强度、反感或想替换的具体物件/区域
- 至少1题明确问“不喜欢什么/想弱化或替换什么”
- 每题都保留 ai_decide 选项
- 每一题的 options 必须和该题主题强相关，且不同题之间不要重复同一组选项
- q5/q6 需要尽量引用图中真实可见物件或区域（如床、桌、窗边、沙发、墙面空区）

4) generationGuidance
- targetAtmosphere, focalPointHint, lightingHint, mustAvoid（2-4条）

边界：
- 仅做租房友好改造，不改结构，不改硬装布局。

只返回纯 JSON。`;
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
    label: (label || `选项${index + 1}`).slice(0, 10),
    desc: (desc || '用于生成方案').slice(0, 24),
  };
}

function isOptionSetUsable(options: Array<{ value: string; label: string; desc: string }>) {
  if (options.length < 3) return false;
  const labels = options.map((o) => o.label.trim()).filter(Boolean);
  if (labels.length < 3) return false;
  const unique = new Set(labels).size;
  if (unique < 3) return false;
  const genericPattern = /^(选项|方案|方式|方向|偏好)[A-D\d一二三四五六七八九十]*$/;
  const tooGeneric = labels.every((label) => genericPattern.test(label) || label.length <= 1);
  if (tooGeneric) return false;
  return true;
}

function containsAny(text: string, keywords: string[]) {
  return keywords.some((kw) => text.includes(kw));
}

function optionsMatchQuestionType(
  questionId: string,
  options: Array<{ value: string; label: string; desc: string }>,
  scene: Pick<SceneAnalysis, 'existingFurniture' | 'keyAreas'> | undefined,
) {
  const joined = options.map((o) => `${o.label} ${o.desc}`).join(' ');
  const matched = options.filter((o) => {
    const text = `${o.label} ${o.desc}`;
    switch (questionId) {
      case 'q1':
        return containsAny(text, ['休息', '睡眠', '工作', '学习', '阅读', '社交', '放松']);
      case 'q2':
        return containsAny(text, ['温暖', '治愈', '安静', '沉稳', '活力', '氛围', '清爽']);
      case 'q3':
        return containsAny(text, ['暖光', '明亮', '通透', '电影', '对比', '层次', '照明']);
      case 'q4':
        return containsAny(text, ['暖色', '冷色', '黑白灰', '木色', '米色', '灰蓝', '跳色']);
      case 'q5':
        return containsAny(text, ['保留', '弱化', '替换', '重做', '改造']) || containsAny(text, ['床', '桌', '窗', '沙发', '墙']);
      case 'q6':
        return containsAny(text, ['收纳', '桌面', '窗边', '床品', '细节', '角落', '地毯', '装饰']);
      default:
        return text.length > 0;
    }
  }).length;

  if (matched < 2) return false;

  if (questionId === 'q5' || questionId === 'q6') {
    const roomTokens = [...(scene?.existingFurniture || []), ...(scene?.keyAreas || [])]
      .map((s) => s.trim())
      .filter((s) => s.length >= 1);
    if (roomTokens.length > 0) {
      const hasRoomMention = roomTokens.some((token) => joined.includes(token));
      if (!hasRoomMention) return false;
    }
  }

  return true;
}

function isTooSimilarToPrevious(
  options: Array<{ value: string; label: string; desc: string }>,
  previousLabelSets: string[][],
) {
  const labels = options.map((o) => o.label.trim()).filter(Boolean);
  if (labels.length < 3) return true;

  return previousLabelSets.some((prev) => {
    const overlap = labels.filter((l) => prev.includes(l)).length;
    return overlap >= 2;
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
    const model = process.env.KIMI_PLAN_MODEL || process.env.KIMI_TEXT_MODEL || 'kimi-latest';
    const prompt = buildPlanPrompt();
    const imageData = parseDataUrl(image);
    let aiOutput: PlanAIOutput | null = null;
    let fallbackReason: string | null = null;
    let kimiMode: 'vision' | 'text_retry' | 'none' = 'none';

    if (!apiKey) {
      fallbackReason = 'Missing KIMI_API_KEY (or MOONSHOT_API_KEY)';
    } else {
      try {
        const { response, raw: rawApiBody, json: result } = await fetchMoonshotJson({
          url: `${baseUrl}/chat/completions`,
          apiKey,
          timeoutMs: 18_000,
          body: {
            model,
            max_tokens: 1200,
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
        fallbackReason = error instanceof Error ? error.message : 'Plan generation failed';
      }
    }

    // Retry with text-only Kimi if vision attempt failed (still prefer Kimi over local fallback)
    if (!aiOutput && apiKey) {
      try {
        const { response, raw: rawApiBody, json: result } = await fetchMoonshotJson({
          url: `${baseUrl}/chat/completions`,
          apiKey,
          timeoutMs: 10_000,
          body: {
            model,
            max_tokens: 1000,
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
        model,
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
        !optionsMatchQuestionType(questionId, aiOptions, aiOutput.sceneAnalysis) ||
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

    return NextResponse.json({
      planningPackage,
      modelProvider: 'moonshot',
      model,
      modelRequestPrompt: prompt,
      kimiMode,
      degraded: kimiMode === 'text_retry',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
