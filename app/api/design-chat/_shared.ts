import type { DynamicQuestion, PlanningPackage } from '../plan/route';
import {
  EMPTY_SLOTS,
  countFilledSlots,
  type ChatSlots,
  type DesignChatState,
} from '../../lib/designChat';
import {
  moonshotErrorMessage,
  moonshotMessageText,
  parseFirstJSONObject,
  readMoonshotResponse,
} from '../../lib/server/moonshot';

const DISLIKE_KEYWORDS = [
  '不喜欢',
  '讨厌',
  '弱化',
  '替换',
  '移除',
  '遮盖',
  '换掉',
  '不要',
];

const CHANGE_KEYWORDS = [
  '大改',
  '明显改',
  '彻底改',
  '改造',
  '重做',
];

const FOCUS_KEYWORDS = [
  '床',
  '沙发',
  '桌',
  '书桌',
  '窗帘',
  '墙面',
  '角落',
  '工作区',
];

type KimiConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export function getKimiConfig(): KimiConfig {
  const apiKey = process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY;
  if (!apiKey) {
    throw new Error('Missing KIMI_API_KEY (or MOONSHOT_API_KEY)');
  }
  return {
    apiKey,
    baseUrl: (process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1').replace(/\/$/, ''),
    model: process.env.KIMI_TEXT_MODEL || 'kimi-k2.5',
  };
}

function toAnswerLabel(question: DynamicQuestion, answer: string | string[]) {
  const values = Array.isArray(answer) ? answer : [answer];
  const labels = values.map((value) => {
    const option = question.options.find((opt) => opt.value === value);
    return option?.label || value;
  });
  return labels.join('、');
}

export function appendUserAnswerToHistory(
  history: DesignChatState['history'],
  question: DynamicQuestion,
  answer: string | string[],
) {
  return [
    ...history,
    {
      role: 'user' as const,
      content: `${question.question} -> ${toAnswerLabel(question, answer)}`,
    },
  ];
}

export function pickFirstQuestion(pkg: PlanningPackage) {
  return pkg.dynamicQuestionnaire[0] || null;
}

export function pickNextQuestion(pkg: PlanningPackage, askedQuestionIds: string[]) {
  const askedSet = new Set(askedQuestionIds);
  return pkg.dynamicQuestionnaire.find((q) => !askedSet.has(q.id)) || null;
}

function hitAny(text: string, keywords: string[]) {
  return keywords.some((kw) => text.includes(kw));
}

export function mergeSlotUpdates(
  prevSlots: ChatSlots,
  question: DynamicQuestion,
  answer: string | string[],
) {
  const values = Array.isArray(answer) ? answer : [answer];
  const answerText = values
    .map((value) => question.options.find((opt) => opt.value === value)?.label || value)
    .join(' ');
  const mergedText = `${question.question} ${question.purpose} ${answerText}`;

  const next: ChatSlots = { ...prevSlots };

  if (question.id === 'q1') next.usage = true;
  if (question.id === 'q2') next.emotion = true;
  if (question.id === 'q3' || question.id === 'q4') next.colorDepth = true;
  if (question.id === 'q5' || hitAny(mergedText, CHANGE_KEYWORDS)) next.changeIntensity = true;
  if (question.id === 'q6' || hitAny(mergedText, FOCUS_KEYWORDS)) next.focusArea = true;
  if (hitAny(mergedText, DISLIKE_KEYWORDS) || question.id === 'q5') next.dislikeReplace = true;

  return next;
}

export function shouldFinalize(state: DesignChatState, totalQuestions: number): {
  done: boolean;
  reason?: 'enough_info' | 'max_rounds' | 'question_exhausted';
} {
  const filled = countFilledSlots(state.slots);
  if (filled >= 4 && state.slots.dislikeReplace) {
    return { done: true, reason: 'enough_info' };
  }
  if (state.rounds >= 6) {
    return { done: true, reason: 'max_rounds' };
  }
  if (state.askedQuestionIds.length >= totalQuestions) {
    return { done: true, reason: 'question_exhausted' };
  }
  return { done: false };
}

export function summarizeCollectedInfo(state: DesignChatState) {
  const latestUserMessages = state.history
    .filter((item) => item.role === 'user')
    .slice(-3)
    .map((item) => item.content.replace(/\s+/g, ' ').trim());

  if (!latestUserMessages.length) {
    return '已完成偏好采集，准备进入生图阶段。';
  }
  return `已收集到核心偏好：${latestUserMessages.join('；')}`;
}

export async function rewriteQuestionWithKimi(
  pkg: PlanningPackage,
  templateQuestion: DynamicQuestion,
  history: DesignChatState['history'],
) {
  const { apiKey, baseUrl, model } = getKimiConfig();
  const recentHistory = history
    .slice(-4)
    .map((item) => `${item.role === 'assistant' ? '你' : '用户'}: ${item.content}`)
    .join('\n');

  const prompt = `你是 NookAI 的提问助手。请把“模板问题”改写成更自然、有温度、像聊天的一句话。

要求：
- 只问一个问题
- 简洁口语化，避免专业术语
- 保留问题目标，不改变含义
- 不要输出解释
- 输出 JSON：{"question":"..."}

房间信息：
- 房间类型：${pkg.sceneAnalysis.roomType}
- 布局：${pkg.sceneAnalysis.layout}
- 光线：${pkg.sceneAnalysis.lightCondition}
- 焦点：${pkg.designStrategy.focalPoint}
- 情绪方向：${pkg.generationGuidance.targetAtmosphere}

历史对话（最近几轮）：
${recentHistory || '无'}

模板问题：
${templateQuestion.question}

选项（仅供你理解意图）：
${templateQuestion.options.map((opt) => `${opt.label}（${opt.desc}）`).join('；')}`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: '你是温暖且高审美的室内设计访谈助手，只输出有效 JSON。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  const { raw: rawApiBody, json: result } = await readMoonshotResponse(response);
  if (!response.ok) {
    throw new Error(moonshotErrorMessage(result, rawApiBody, 'Kimi question rewrite failed'));
  }

  const raw = moonshotMessageText(result);

  if (!raw) return templateQuestion.question;
  const parsed = parseFirstJSONObject<{ question?: string }>(raw);
  if (typeof parsed?.question === 'string' && parsed.question.trim()) {
    return parsed.question.trim();
  }

  // fallback: if model accidentally returns plain question sentence
  const plain = raw.replace(/^["'\s]+|["'\s]+$/g, '').trim();
  if (plain && plain.length <= 80 && !plain.includes('{') && !plain.includes('}')) {
    return plain;
  }

  return templateQuestion.question;
}

export function createInitialChatState(firstQuestionId: string): DesignChatState {
  return {
    askedQuestionIds: [firstQuestionId],
    history: [],
    slots: { ...EMPTY_SLOTS },
    rounds: 1,
  };
}

export function progressOf(state: DesignChatState, total: number) {
  return {
    asked: state.askedQuestionIds.length,
    total,
    filledSlots: countFilledSlots(state.slots),
  };
}
