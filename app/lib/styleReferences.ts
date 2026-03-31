import type { PlanningPackage } from '../api/plan/route';

export type StyleReference = {
  id: string;
  url: string;
  label: string;
  category: 'modern_minimal' | 'warm_healing' | 'vintage_artsy' | 'colorful_playful' | 'dark_moody';
  signals: string[];
};

export const STYLE_REFERENCES: StyleReference[] = [
  {
    id: 'ref-763',
    url: '/style-references/ref-763.jpg',
    label: '浅色现代温馨客厅',
    category: 'modern_minimal',
    signals: ['浅色', '米白', '暖色', '整洁', '自然光', '原木', '通透', '克制'],
  },
  {
    id: 'ref-764',
    url: '/style-references/ref-764.jpg',
    label: '深色对比现代客厅',
    category: 'dark_moody',
    signals: ['深色', '黑色', '蓝色', '高对比', '电影感', '氛围灯', '现代'],
  },
  {
    id: 'ref-765',
    url: '/style-references/ref-765.jpg',
    label: '暖棕文艺角落',
    category: 'warm_healing',
    signals: ['暖色', '奶油', '木色', '温柔', '治愈', '松弛', '软装'],
  },
  {
    id: 'ref-766',
    url: '/style-references/ref-766.jpg',
    label: '通透极简卧室',
    category: 'modern_minimal',
    signals: ['明亮', '浅色', '极简', '清爽', '干净', '通透', '留白'],
  },
  {
    id: 'ref-767',
    url: '/style-references/ref-767.jpg',
    label: '复古暖调卧室',
    category: 'vintage_artsy',
    signals: ['复古', '棕色', '暖黄', '个性', '文艺', '故事感', '氛围'],
  },
  {
    id: 'ref-768',
    url: '/style-references/ref-768.jpg',
    label: '彩色玩趣客厅',
    category: 'colorful_playful',
    signals: ['跳色', '彩色', '活力', '明快', '趣味', '社交感'],
  },
  {
    id: 'ref-771',
    url: '/style-references/ref-771.jpg',
    label: '现代简约客厅 A',
    category: 'modern_minimal',
    signals: ['现代', '简洁', '中性色', '轻质感', '清爽', '收纳'],
  },
  {
    id: 'ref-772',
    url: '/style-references/ref-772.jpg',
    label: '现代简约客厅 B',
    category: 'modern_minimal',
    signals: ['现代', '简约', '克制', '轻暖', '平衡', '通透'],
  },
  {
    id: 'ref-773',
    url: '/style-references/ref-773.jpg',
    label: '现代简约客厅 C',
    category: 'modern_minimal',
    signals: ['极简', '浅色', '留白', '柔光', '整齐', '质感'],
  },
  {
    id: 'ref-774',
    url: '/style-references/ref-774.jpg',
    label: '现代简约客厅 D',
    category: 'modern_minimal',
    signals: ['现代', '几何', '中性', '干净', '结构感'],
  },
  {
    id: 'ref-775',
    url: '/style-references/ref-775.jpg',
    label: '现代简约客厅 E',
    category: 'modern_minimal',
    signals: ['简约', '浅暖', '舒适', '低预算高级感', '统一'],
  },
  {
    id: 'ref-776',
    url: '/style-references/ref-776.jpg',
    label: '现代简约客厅 F',
    category: 'modern_minimal',
    signals: ['现代', '层次', '秩序', '克制', '自然'],
  },
];

function getSelectedAnswerText(
  planningPackage: PlanningPackage,
  userAnswers: Record<string, string | string[]>
) {
  const chunks: string[] = [];
  for (const q of planningPackage.dynamicQuestionnaire) {
    const raw = userAnswers[q.id];
    if (!raw) continue;
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      const opt = q.options.find((item) => item.value === value);
      if (!opt || value === 'ai_decide') continue;
      chunks.push(`${q.question} ${opt.label} ${opt.desc}`);
    }
  }
  return chunks.join(' | ');
}

function getPlanSignalText(
  planningPackage: PlanningPackage,
  userAnswers: Record<string, string | string[]>
) {
  const guidance = planningPackage.generationGuidance;
  const visual = guidance.visualImpactRules;
  return [
    planningPackage.sceneAnalysis.roomType,
    planningPackage.sceneAnalysis.lightCondition,
    planningPackage.designStrategy.focalPoint,
    planningPackage.designStrategy.lightingApproach,
    planningPackage.designStrategy.softFurnishingApproach,
    planningPackage.designStrategy.colorDirection,
    guidance.targetAtmosphere,
    guidance.focalPointHint,
    guidance.lightingHint,
    visual.lightingContrast,
    visual.focalPriority,
    visual.emotionalTone,
    visual.minimalismDiscipline,
    visual.livedInFeeling,
    getSelectedAnswerText(planningPackage, userAnswers),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function scoreReference(reference: StyleReference, signalText: string) {
  let score = 0;
  for (const signal of reference.signals) {
    if (signalText.includes(signal.toLowerCase())) {
      score += 2;
    }
  }
  if (signalText.includes('电影') && reference.category === 'dark_moody') score += 2;
  if (signalText.includes('复古') && reference.category === 'vintage_artsy') score += 2;
  if (signalText.includes('跳色') && reference.category === 'colorful_playful') score += 2;
  if (
    (signalText.includes('极简') || signalText.includes('简约') || signalText.includes('克制')) &&
    reference.category === 'modern_minimal'
  ) {
    score += 2;
  }
  if (
    (signalText.includes('温暖') || signalText.includes('治愈') || signalText.includes('柔和')) &&
    reference.category === 'warm_healing'
  ) {
    score += 2;
  }
  return score;
}

export function selectReferenceImages(
  planningPackage: PlanningPackage,
  userAnswers: Record<string, string | string[]>,
  maxCount = 1
) {
  const signalText = getPlanSignalText(planningPackage, userAnswers);
  const ranked = STYLE_REFERENCES.map((ref) => ({
    ref,
    score: scoreReference(ref, signalText),
  }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, maxCount));

  const selected = ranked.filter((item) => item.score > 0).map((item) => item.ref);
  if (selected.length > 0) return selected.slice(0, maxCount);

  // Stable fallback set for consistent style anchoring.
  const fallbackIds = ['ref-763', 'ref-765', 'ref-766', 'ref-771'];
  const fallback = STYLE_REFERENCES.filter((ref) => fallbackIds.includes(ref.id));
  return fallback.slice(0, maxCount);
}
