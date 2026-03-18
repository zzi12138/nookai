'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Copy,
  ExternalLink,
  Palette,
  RefreshCw,
  Save,
  ShoppingBag,
} from 'lucide-react';
import { loadResult, type StoredResult } from '../lib/imageStore';

type InsightCard = {
  title: string;
  changed: string;
  value: string;
};

type PlanStep = {
  step: number;
  title: string;
  action: string;
  reason: string;
  priority: '高优先级' | '中优先级' | '可选';
};

type Recommendation = {
  name: string;
  category: 'Lighting' | 'Textiles' | 'Furniture' | 'Decor';
  keywords: string[];
  min: number;
  max: number;
  why: string;
  placement: string;
  relatedStep: number;
};

type BudgetBucket = {
  title: string;
  min: number;
  max: number;
  note: string;
};

const spring = { type: 'spring', stiffness: 120, damping: 20 } as const;

const fallbackInsights: InsightCard[] = [
  {
    title: '减少视觉杂乱',
    changed: '台面和地面可视杂物明显减少',
    value: '空间第一眼更清爽，房间会立刻显得更大。',
  },
  {
    title: '增加暖光氛围',
    changed: '从单一顶灯变成了分层暖光',
    value: '夜间更放松，照片和肉眼都更有“家”的感觉。',
  },
  {
    title: '统一软装色调',
    changed: '床品、抱枕、地毯颜色被统一到同一体系',
    value: '整体更协调，不会有“拼凑感”。',
  },
  {
    title: '补充装饰焦点',
    changed: '墙面和角落增加了小而精的视觉重点',
    value: '房间有记忆点，但又不会显得拥挤。',
  },
];

const fallbackSteps: PlanStep[] = [
  {
    step: 1,
    title: '先做 15 分钟快速整理',
    action: '先清空台面、床面和地面零碎物，保留每天会用的 20% 物品。',
    reason: '这是最省钱但最显著的一步，先把视觉噪音降下来。',
    priority: '高优先级',
  },
  {
    step: 2,
    title: '补一盏暖光落地灯',
    action: '先在沙发旁或床边加一盏 2700K-3000K 暖光落地灯。',
    reason: '灯光决定氛围上限，是最快感知变化的一步。',
    priority: '高优先级',
  },
  {
    step: 3,
    title: '用地毯和织物统一色温',
    action: '铺一块浅暖色地毯，再补 2-3 个同色系抱枕或软毯。',
    reason: '软装统一后，房间会从“散”变“整”。',
    priority: '中优先级',
  },
  {
    step: 4,
    title: '加一个轻量装饰焦点',
    action: '在床头或沙发上方放一幅可移除挂画，旁边配小绿植。',
    reason: '有焦点后，空间会更有层次，不会平。',
    priority: '中优先级',
  },
  {
    step: 5,
    title: '完善放松角落',
    action: '如果预算允许，补一个边几或投影小角落，形成“可停留”区域。',
    reason: '这一步不是刚需，但会明显提升生活幸福感。',
    priority: '可选',
  },
];

const fallbackRecommendations: Recommendation[] = [
  {
    name: '暖光落地灯',
    category: 'Lighting',
    keywords: ['暖白光', '简约', '细杆'],
    min: 159,
    max: 399,
    why: '最快建立氛围层次，替代只开顶灯的生硬感。',
    placement: '放在沙发右侧或床侧后方，灯罩高于坐姿视线。',
    relatedStep: 2,
  },
  {
    name: '床头氛围台灯',
    category: 'Lighting',
    keywords: ['奶油风', '磨砂灯罩', '暖光'],
    min: 89,
    max: 229,
    why: '补低位光源，让夜间环境更柔和。',
    placement: '放在床头柜靠内侧，避免直照眼睛。',
    relatedStep: 2,
  },
  {
    name: '浅色地毯',
    category: 'Textiles',
    keywords: ['原木风', '低饱和', '短绒'],
    min: 199,
    max: 499,
    why: '快速分区并提升脚感，降低地面空旷感。',
    placement: '铺在沙发前区或床尾，建议压住家具前脚。',
    relatedStep: 3,
  },
  {
    name: '米色床品四件套',
    category: 'Textiles',
    keywords: ['亚麻感', '奶油色', '纯色'],
    min: 179,
    max: 459,
    why: '统一大面积视觉色块，稳定空间气质。',
    placement: '床面颜色尽量和窗帘/抱枕相邻色。',
    relatedStep: 3,
  },
  {
    name: '窄边几',
    category: 'Furniture',
    keywords: ['小户型', '轻量', '原木色'],
    min: 129,
    max: 289,
    why: '补充实用台面，同时承接灯光和小摆件。',
    placement: '放在沙发扶手旁，距离约 10-15cm。',
    relatedStep: 5,
  },
  {
    name: '可移除装饰画',
    category: 'Decor',
    keywords: ['简约挂画', '暖色调', '抽象'],
    min: 69,
    max: 199,
    why: '建立视线焦点，让空间更“完整”。',
    placement: '建议挂在床头中线或沙发上方中线。',
    relatedStep: 4,
  },
  {
    name: '中型绿植',
    category: 'Decor',
    keywords: ['自然感', '好养护', '耐阴'],
    min: 79,
    max: 259,
    why: '增加自然层次，平衡家具硬线条。',
    placement: '放在窗边、书桌旁或房间角落过渡位。',
    relatedStep: 4,
  },
];

const placementAdvice = [
  '落地灯建议放在沙发右侧，灯光从侧后方打出层次，不会刺眼。',
  '地毯优先铺在“坐下停留”的区域，比如沙发前或床尾，强化分区。',
  '挂画尽量挂在床头中间或沙发中间，视觉焦点会更稳定。',
  '绿植放在书桌边或角落，避免挡住动线和开门路径。',
  '边几靠近主要坐位，保证随手放杯子和小物更顺手。',
];

function formatRange(min: number, max: number) {
  return `¥${min}-${max}`;
}

function priorityBadge(priority: PlanStep['priority']) {
  if (priority === '高优先级') {
    return 'bg-rose-50 text-rose-700';
  }
  if (priority === '中优先级') {
    return 'bg-amber-50 text-amber-700';
  }
  return 'bg-stone-100 text-stone-600';
}

export default function PlanPage() {
  const router = useRouter();
  const [notice, setNotice] = useState('');
  const [theme, setTheme] = useState('日式原木风');
  const [evaluation, setEvaluation] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [requirements, setRequirements] = useState<string[]>([]);
  const [constraints, setConstraints] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    let isActive = true;

    const hydrate = (data: Partial<StoredResult>) => {
      if (!isActive) return;
      setTheme(data.theme || '日式原木风');
      setEvaluation(data.evaluation || '');
      setSuggestions(data.suggestions || '');
      setRequirements(data.requirements || []);
      setConstraints(data.constraints || []);
    };

    const load = async () => {
      if (id) {
        try {
          const stored = await loadResult(id);
          if (stored) {
            hydrate(stored);
            return;
          }
        } catch {
          // fallback below
        }
      }

      const cached = sessionStorage.getItem('nookai_result_image');
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Partial<StoredResult>;
          hydrate(parsed);
        } catch {
          // ignore invalid cache
        }
      }
    };

    load();
    return () => {
      isActive = false;
    };
  }, []);

  const heroSummary = useMemo(() => {
    if (evaluation) return evaluation;
    return '这个空间之所以更好看，核心不是“堆东西”，而是先降低杂乱感，再用暖光和统一软装把氛围拉起来。你会感受到房间更整洁、更温暖，也更像一个可以真正放松的小窝。';
  }, [evaluation]);

  const insights = useMemo(() => fallbackInsights, []);
  const steps = useMemo(() => fallbackSteps, []);
  const recommendations = useMemo(() => fallbackRecommendations, []);

  const groupedItems = useMemo(() => {
    return {
      Lighting: recommendations.filter((item) => item.category === 'Lighting'),
      Textiles: recommendations.filter((item) => item.category === 'Textiles'),
      Furniture: recommendations.filter((item) => item.category === 'Furniture'),
      Decor: recommendations.filter((item) => item.category === 'Decor'),
    };
  }, [recommendations]);

  const basicBudget = useMemo(() => {
    const high = recommendations.filter((item) =>
      steps.find((step) => step.step === item.relatedStep)?.priority === '高优先级'
    );
    return {
      min: high.reduce((sum, item) => sum + item.min, 0),
      max: high.reduce((sum, item) => sum + item.max, 0),
    };
  }, [recommendations, steps]);

  const mediumBudget = useMemo(() => {
    const medium = recommendations.filter((item) =>
      steps.find((step) => step.step === item.relatedStep)?.priority !== '可选'
    );
    return {
      min: medium.reduce((sum, item) => sum + item.min, 0),
      max: medium.reduce((sum, item) => sum + item.max, 0),
    };
  }, [recommendations, steps]);

  const totalBudget = useMemo(() => {
    return {
      min: recommendations.reduce((sum, item) => sum + item.min, 0),
      max: recommendations.reduce((sum, item) => sum + item.max, 0),
    };
  }, [recommendations]);

  const budgetBuckets: BudgetBucket[] = useMemo(
    () => [
      {
        title: '基础改造预算',
        min: basicBudget.min,
        max: basicBudget.max,
        note: '先做高优先级动作，最省钱也最有效。',
      },
      {
        title: '进阶改造预算',
        min: mediumBudget.min,
        max: mediumBudget.max,
        note: '把中优先级补齐，空间完整度会明显提升。',
      },
      {
        title: '可选加购预算',
        min: totalBudget.min,
        max: totalBudget.max,
        note: '包含可选项，用于打造更强的个性化氛围。',
      },
    ],
    [basicBudget, mediumBudget, totalBudget]
  );

  const copyText = useMemo(() => {
    const lines: string[] = [];
    lines.push('AI改造指南');
    lines.push(`风格方向：${theme}`);
    lines.push('');
    lines.push('【执行步骤】');
    steps.forEach((step) => {
      lines.push(`${step.step}. ${step.title}（${step.priority}）`);
      lines.push(`- 要做什么：${step.action}`);
      lines.push(`- 为什么：${step.reason}`);
    });
    lines.push('');
    lines.push('【建议购买】');
    recommendations.forEach((item) => {
      lines.push(
        `- ${item.name}｜${item.category}｜${formatRange(item.min, item.max)}｜放置：${item.placement}`
      );
    });
    return lines.join('\n');
  }, [theme, steps, recommendations]);

  const handleSave = () => {
    try {
      localStorage.setItem(
        'nookai_smart_plan',
        JSON.stringify({
          theme,
          insights,
          steps,
          recommendations,
          budgetBuckets,
          savedAt: Date.now(),
        })
      );
      setNotice('方案已保存到本地');
    } catch {
      setNotice('保存失败，请稍后再试');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setNotice('清单已复制，发给朋友或自己备忘都可以');
    } catch {
      setNotice('复制失败，请稍后再试');
    }
  };

  const handleShop = () => {
    window.open('https://www.taobao.com', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[#FDF9F1] px-4 py-12 text-stone-800">
      <div className="mx-auto w-full max-w-6xl space-y-12">
        <motion.section
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={spring}
          className="rounded-3xl bg-white/95 p-10 shadow-xl shadow-stone-200/40"
        >
          <p className="text-xs uppercase tracking-[0.28em] text-stone-400">SMART GUIDE</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
            你的空间改造方案
          </h1>
          <p className="mt-5 max-w-4xl text-sm leading-8 text-stone-600">{heroSummary}</p>
          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-stone-500">
            <span className="rounded-full bg-amber-50 px-3 py-1">当前风格：{theme}</span>
            {constraints.length > 0 ? (
              <span className="rounded-full bg-stone-100 px-3 py-1">
                约束：{constraints.join(' / ')}
              </span>
            ) : null}
            {requirements.length > 0 ? (
              <span className="rounded-full bg-stone-100 px-3 py-1">
                目标：{requirements.slice(0, 3).join(' / ')}
              </span>
            ) : null}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.03 }}
          className="space-y-5"
        >
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-semibold text-stone-900">关键变化点</h2>
            <p className="text-sm text-stone-500">先理解为什么更好看，再开始执行</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {insights.map((card) => (
              <article
                key={card.title}
                className="rounded-2xl bg-white p-5 shadow-lg shadow-stone-200/40"
              >
                <h3 className="text-lg font-medium text-stone-900">{card.title}</h3>
                <p className="mt-3 text-sm leading-7 text-stone-600">变化：{card.changed}</p>
                <p className="mt-2 text-sm leading-7 text-stone-500">意义：{card.value}</p>
              </article>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.06 }}
          className="rounded-3xl bg-white p-10 shadow-xl shadow-stone-200/40"
        >
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-semibold text-stone-900">一步一步执行</h2>
            <p className="text-sm text-stone-500">先做容易且见效快的，再做加分项</p>
          </div>
          <div className="mt-7 space-y-5">
            {steps.map((step) => (
              <article
                key={step.step}
                className="rounded-2xl border border-stone-100 bg-stone-50/60 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-900 text-sm text-white">
                      {step.step}
                    </span>
                    <h3 className="text-lg font-medium text-stone-900">{step.title}</h3>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${priorityBadge(step.priority)}`}
                  >
                    {step.priority}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-7 text-stone-700">要做什么：{step.action}</p>
                <p className="mt-2 text-sm leading-7 text-stone-500">为什么：{step.reason}</p>
              </article>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.09 }}
          className="space-y-7"
        >
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-semibold text-stone-900">推荐购买方向</h2>
            <p className="text-sm text-stone-500">不是乱买，而是按步骤精准补齐</p>
          </div>

          {(['Lighting', 'Textiles', 'Furniture', 'Decor'] as const).map((group) => (
            <div key={group} className="space-y-3">
              <h3 className="text-lg font-medium text-stone-800">{group}</h3>
              <div className="space-y-3">
                {groupedItems[group].map((item) => (
                  <article
                    key={item.name}
                    className="rounded-2xl bg-white p-5 shadow-lg shadow-stone-200/40"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start">
                      <div className="h-28 w-full rounded-2xl bg-gradient-to-br from-amber-100 to-stone-100 md:w-40" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-lg font-medium text-stone-900">{item.name}</h4>
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                            {formatRange(item.min, item.max)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-stone-500">
                          类型：{item.category} ｜ 关键词：{item.keywords.join(' / ')}
                        </p>
                        <p className="mt-2 text-sm leading-7 text-stone-700">
                          为什么需要：{item.why}
                        </p>
                        <p className="mt-1 text-sm leading-7 text-stone-600">
                          放哪里：{item.placement}
                        </p>
                        <p className="mt-1 text-xs text-stone-400">对应步骤：Step {item.relatedStep}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleShop}
                        className="inline-flex shrink-0 items-center gap-2 rounded-full border border-stone-200 px-4 py-2 text-sm text-stone-700 hover:shadow-sm"
                      >
                        <ShoppingBag size={14} />
                        查看购买
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.12 }}
          className="rounded-3xl bg-white p-10 shadow-xl shadow-stone-200/40"
        >
          <h2 className="text-2xl font-semibold text-stone-900">摆放建议</h2>
          <ul className="mt-6 space-y-4 text-sm leading-7 text-stone-600">
            {placementAdvice.map((advice) => (
              <li key={advice} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>{advice}</span>
              </li>
            ))}
          </ul>
          {suggestions ? (
            <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm leading-7 text-stone-600">
              AI 补充建议：{suggestions}
            </p>
          ) : null}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.15 }}
          className="rounded-3xl bg-white p-10 shadow-xl shadow-stone-200/40"
        >
          <h2 className="text-2xl font-semibold text-stone-900">预算摘要</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {budgetBuckets.map((bucket) => (
              <article key={bucket.title} className="rounded-2xl bg-stone-50 p-5">
                <p className="text-sm text-stone-500">{bucket.title}</p>
                <p className="mt-2 text-2xl font-semibold text-stone-900">
                  ¥{bucket.min}-¥{bucket.max}
                </p>
                <p className="mt-3 text-sm leading-6 text-stone-500">{bucket.note}</p>
              </article>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.18 }}
          className="rounded-3xl bg-white p-8 shadow-xl shadow-stone-200/40"
        >
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white"
            >
              <Save size={16} />
              保存方案
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-6 py-3 text-sm text-stone-700"
            >
              <Copy size={16} />
              复制清单
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-6 py-3 text-sm text-stone-700"
            >
              <RefreshCw size={16} />
              重新生成
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-6 py-3 text-sm text-stone-700"
            >
              <Palette size={16} />
              换种风格
            </button>
            <button
              type="button"
              onClick={handleShop}
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-6 py-3 text-sm text-stone-700"
            >
              <ExternalLink size={16} />
              去购买
            </button>
            <button
              type="button"
              onClick={handleShop}
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-6 py-3 text-sm text-stone-700"
            >
              <ExternalLink size={16} />
              查看平价替代
            </button>
          </div>
          {notice ? <p className="mt-4 text-sm text-stone-500">{notice}</p> : null}
        </motion.section>
      </div>
    </div>
  );
}
