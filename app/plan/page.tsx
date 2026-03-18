'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, ExternalLink, Save } from 'lucide-react';

type PlanItem = {
  name: string;
  min: number;
  max: number;
  desc: string;
  tone: string;
};

type PlanGroup = {
  title: 'Lighting' | 'Textiles' | 'Furniture' | 'Decor';
  subtitle: string;
  items: PlanItem[];
};

const spring = { type: 'spring', stiffness: 120, damping: 20 } as const;

const groups: PlanGroup[] = [
  {
    title: 'Lighting',
    subtitle: '分层照明是低成本提升质感的第一步',
    items: [
      {
        name: '暖光落地灯',
        min: 159,
        max: 399,
        desc: '放在沙发侧后方，形成“背景光”层次，夜间氛围更柔和。',
        tone: 'from-amber-100 to-orange-100',
      },
      {
        name: '床头氛围台灯',
        min: 89,
        max: 229,
        desc: '补充低位点光源，避免只开顶灯的平面感。',
        tone: 'from-rose-100 to-orange-100',
      },
    ],
  },
  {
    title: 'Textiles',
    subtitle: '用织物统一色温与触感',
    items: [
      {
        name: '大面积地毯',
        min: 199,
        max: 499,
        desc: '覆盖原地面，快速建立视觉分区并提升舒适度。',
        tone: 'from-stone-100 to-amber-100',
      },
      {
        name: '亚麻抱枕 + 软毯',
        min: 119,
        max: 299,
        desc: '在沙发和床上建立温暖触感，增加生活感。',
        tone: 'from-yellow-100 to-amber-100',
      },
    ],
  },
  {
    title: 'Furniture',
    subtitle: '保持轻量、可移动、好维护',
    items: [
      {
        name: '窄深度边几',
        min: 129,
        max: 289,
        desc: '靠沙发摆放，兼顾收纳和放灯，适配小空间。',
        tone: 'from-orange-100 to-amber-100',
      },
      {
        name: '开放式轻书架',
        min: 199,
        max: 459,
        desc: '用来放书、香薰和小装饰，形成稳定视觉重心。',
        tone: 'from-amber-100 to-lime-100',
      },
    ],
  },
  {
    title: 'Decor',
    subtitle: '少而精，避免堆砌',
    items: [
      {
        name: '可移除装饰画',
        min: 69,
        max: 199,
        desc: '在视线高度形成焦点，不破坏墙面即可出效果。',
        tone: 'from-stone-100 to-orange-100',
      },
      {
        name: '绿植组合（2-3盆）',
        min: 99,
        max: 299,
        desc: '增加自然层次，平衡硬朗家具线条。',
        tone: 'from-green-100 to-emerald-100',
      },
    ],
  },
];

const layoutAdvice = [
  '落地灯放在沙发后侧约 20-30cm，形成柔和背光，减少直射眩光。',
  '地毯建议压住沙发前脚，茶几置于地毯中轴，视觉关系会更稳定。',
  '书架和边几分布在房间同一侧，保证动线清晰，不阻挡门窗开合。',
  '装饰画中心高度约 145cm，优先对齐沙发中心线，画面会更“整”。',
  '绿植放置在窗边和角落，避免集中一处导致视觉失衡。',
];

function formatPrice(min: number, max: number) {
  return `¥${min} - ¥${max}`;
}

export default function PlanPage() {
  const [notice, setNotice] = useState('');

  const allItems = useMemo(() => groups.flatMap((group) => group.items), []);
  const totalMin = useMemo(
    () => allItems.reduce((sum, item) => sum + item.min, 0),
    [allItems]
  );
  const totalMax = useMemo(
    () => allItems.reduce((sum, item) => sum + item.max, 0),
    [allItems]
  );

  const checklistText = useMemo(() => {
    const lines: string[] = [];
    groups.forEach((group) => {
      lines.push(`${group.title}`);
      group.items.forEach((item) => {
        lines.push(`- ${item.name} (${formatPrice(item.min, item.max)})`);
      });
      lines.push('');
    });
    lines.push(`预算预估: ¥${totalMin} - ¥${totalMax}`);
    return lines.join('\n');
  }, [totalMin, totalMax]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(checklistText);
      setNotice('清单已复制到剪贴板');
    } catch {
      setNotice('复制失败，请稍后重试');
    }
  };

  const handleSave = () => {
    try {
      localStorage.setItem(
        'nookai_transformation_plan',
        JSON.stringify({
          groups,
          totalMin,
          totalMax,
          updatedAt: Date.now(),
        })
      );
      setNotice('方案已保存到本地');
    } catch {
      setNotice('保存失败，请稍后再试');
    }
  };

  const handleShop = () => {
    window.open('https://www.taobao.com', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[#FDF9F1] px-4 py-12 text-stone-800">
      <div className="mx-auto w-full max-w-5xl space-y-12">
        <motion.section
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="rounded-3xl bg-white/95 p-10 shadow-xl shadow-stone-200/40"
        >
          <p className="text-xs uppercase tracking-[0.28em] text-stone-400">TRANSFORMATION PLAN</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
            你的空间改造方案
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-500">
            我们将本次 AI 生成结果转换为可落地执行的采购与摆放计划。整体策略是
            “不动硬装、优先软装、低预算高质感”，让你可以按优先级逐步完成改造。
          </p>
        </motion.section>

        <motion.section
          id="shopping-list"
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.04 }}
          className="space-y-9"
        >
          {groups.map((group) => (
            <div key={group.title} className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <h2 className="text-2xl font-semibold text-stone-900">{group.title}</h2>
                <p className="text-sm text-stone-500">{group.subtitle}</p>
              </div>

              <div className="space-y-4">
                {group.items.map((item) => (
                  <motion.article
                    key={item.name}
                    whileHover={{ y: -2 }}
                    transition={spring}
                    className="rounded-2xl bg-white p-4 shadow-lg shadow-stone-200/40"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div
                        className={`h-28 w-full shrink-0 rounded-2xl bg-gradient-to-br ${item.tone} sm:w-40`}
                      >
                        <div className="flex h-full items-end rounded-2xl bg-white/25 p-3 text-xs text-stone-600">
                          商品示意图
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-lg font-medium text-stone-800">{item.name}</h3>
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                            {formatPrice(item.min, item.max)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-7 text-stone-500">{item.desc}</p>
                      </div>

                      <button
                        type="button"
                        onClick={handleShop}
                        className="rounded-full border border-stone-200 px-4 py-2 text-sm text-stone-700 transition hover:shadow-sm"
                      >
                        查看购买
                      </button>
                    </div>
                  </motion.article>
                ))}
              </div>
            </div>
          ))}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.08 }}
          className="rounded-3xl bg-white p-10 shadow-xl shadow-stone-200/40"
        >
          <h2 className="text-2xl font-semibold text-stone-900">布局建议</h2>
          <ul className="mt-6 space-y-5 text-sm leading-7 text-stone-600">
            {layoutAdvice.map((advice) => (
              <li key={advice} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>{advice}</span>
              </li>
            ))}
          </ul>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.12 }}
          className="rounded-3xl bg-white p-10 shadow-xl shadow-stone-200/40"
        >
          <h2 className="text-2xl font-semibold text-stone-900">预算预估</h2>
          <p className="mt-4 text-sm leading-7 text-stone-500">
            预算按基础可执行组合测算，包含灯具、织物、轻量家具与装饰，不含硬装施工。
          </p>
          <div className="mt-6 inline-flex items-end gap-3 rounded-2xl bg-amber-50 px-5 py-4">
            <span className="text-sm text-stone-500">总预算区间</span>
            <span className="text-2xl font-semibold text-stone-900">
              ¥{totalMin} - ¥{totalMax}
            </span>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.16 }}
          className="rounded-3xl bg-white p-8 shadow-xl shadow-stone-200/40"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white shadow-sm"
            >
              <Save size={16} />
              保存方案
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-200 px-6 py-3 text-sm text-stone-700"
            >
              <Copy size={16} />
              复制清单
            </button>
            <button
              type="button"
              onClick={handleShop}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-200 px-6 py-3 text-sm text-stone-700"
            >
              <ExternalLink size={16} />
              去购买
            </button>
          </div>
          {notice ? <p className="mt-4 text-sm text-stone-500">{notice}</p> : null}
        </motion.section>
      </div>
    </div>
  );
}
