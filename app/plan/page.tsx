'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Copy, RefreshCw, Save } from 'lucide-react';
import { loadResult, type StoredResult } from '../lib/imageStore';

type GuideItem = {
  id: number;
  markerLabel: string;
  name: string;
  category: 'lighting' | 'textile' | 'decor' | 'plant' | 'furniture';
  imageTarget: {
    targetName: string;
    x: number;
    y: number;
  };
  card: {
    buy: string;
    priceRange: string;
    placement: string;
    why: string;
  };
};

const spring = { type: 'spring', stiffness: 120, damping: 20 } as const;

function toMarker(index: number) {
  const markers = ['①', '②', '③', '④', '⑤', '⑥'];
  return markers[index - 1] || `${index}`;
}

function buildGuideItems(theme: string): GuideItem[] {
  const styleHint =
    theme.includes('原木') || theme.toLowerCase().includes('japandi')
      ? '原木风 / 暖白光 / 亚麻材质'
      : theme.includes('奶油')
        ? '奶油风 / 暖白光 / 软质面料'
        : theme.includes('复古')
          ? '复古风 / 暖黄光 / 木质细节'
          : '简约风 / 暖白光 / 低饱和';

  return [
    {
      id: 1,
      markerLabel: toMarker(1),
      name: '暖光落地灯',
      category: 'lighting',
      imageTarget: { targetName: 'floor lamp near sofa', x: 74, y: 59 },
      card: {
        buy: `简约暖光落地灯（${styleHint}）`,
        priceRange: '¥159-399',
        placement: '沙发右侧或沙发后方',
        why: '这是最快让房间变温暖的一步',
      },
    },
    {
      id: 2,
      markerLabel: toMarker(2),
      name: '浅色地毯',
      category: 'textile',
      imageTarget: { targetName: 'rug under table', x: 52, y: 76 },
      card: {
        buy: '浅米色短绒地毯（几何或纯色）',
        priceRange: '¥199-499',
        placement: '沙发前区或床尾，压住家具前脚',
        why: '能立刻把空间分区做清楚',
      },
    },
    {
      id: 3,
      markerLabel: toMarker(3),
      name: '简约挂画',
      category: 'decor',
      imageTarget: { targetName: 'wall art above sofa', x: 67, y: 33 },
      card: {
        buy: '免打孔简约挂画（单幅优先）',
        priceRange: '¥69-199',
        placement: '沙发上方中线位置',
        why: '有了视觉焦点，房间不再空',
      },
    },
    {
      id: 4,
      markerLabel: toMarker(4),
      name: '中型绿植',
      category: 'plant',
      imageTarget: { targetName: 'plant at right corner', x: 84, y: 57 },
      card: {
        buy: '中型耐养绿植（龟背竹/虎尾兰）',
        priceRange: '¥79-259',
        placement: '窗边或角落过渡位',
        why: '增加自然感，空间会更有生气',
      },
    },
    {
      id: 5,
      markerLabel: toMarker(5),
      name: '米色床品',
      category: 'textile',
      imageTarget: { targetName: 'bedding area', x: 24, y: 83 },
      card: {
        buy: '米色纯色床品（可加 1-2 个抱枕）',
        priceRange: '¥179-459',
        placement: '床面主色统一为浅暖色',
        why: '床面面积最大，统一后整体最完整',
      },
    },
  ];
}

export default function PlanPage() {
  const router = useRouter();
  const [theme, setTheme] = useState('日式原木风');
  const [originalUrl, setOriginalUrl] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');

  const items = useMemo(() => buildGuideItems(theme), [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    let isActive = true;

    const hydrate = (data: Partial<StoredResult>) => {
      if (!isActive) return;
      setTheme(data.theme || '日式原木风');
      setOriginalUrl(data.original || '');
      setGeneratedUrl(data.generated || '');
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

  const guideCopy = useMemo(() => {
    return items
      .map(
        (item) =>
          `${item.markerLabel} ${item.name}\n买什么：${item.card.buy}\n价格：${item.card.priceRange}\n放哪里：${item.card.placement}\n为什么：${item.card.why}`
      )
      .join('\n\n');
  }, [items]);

  const handleSave = () => {
    try {
      localStorage.setItem(
        'nookai_plan_ssot',
        JSON.stringify({
          theme,
          items,
          updatedAt: Date.now(),
        })
      );
      setNotice('方案已保存');
    } catch {
      setNotice('保存失败，请重试');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(guideCopy);
      setNotice('编号清单已复制');
    } catch {
      setNotice('复制失败，请重试');
    }
  };

  if (!generatedUrl && !originalUrl) {
    return (
      <div className="min-h-screen bg-[#FDF9F1] px-4 py-12">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-10 text-center shadow-xl shadow-stone-200/40">
          <p className="text-sm text-stone-500">还没有可用结果图，请先完成生成。</p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="mt-5 rounded-full bg-stone-900 px-6 py-3 text-sm text-white"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDF9F1] px-4 py-12 text-stone-800">
      <div className="mx-auto w-full max-w-6xl space-y-10">
        <motion.section
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={spring}
          className="rounded-3xl bg-white p-8 shadow-xl shadow-stone-200/35 md:p-10"
        >
          <p className="text-xs uppercase tracking-[0.28em] text-stone-400">AI GUIDE</p>
          <h1 className="mt-3 text-3xl font-semibold text-stone-900">AI改造指南</h1>
          <p className="mt-3 text-sm leading-7 text-stone-500">
            先看讲解图，再按编号执行。你只要补齐这 5 个关键物品，就能更接近效果图。
          </p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 22, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.04 }}
          className="rounded-3xl bg-white p-6 shadow-xl shadow-stone-200/35 md:p-8"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-stone-900">改造讲解图</h2>
            <p className="text-xs text-stone-400">图上编号与下方卡片一一对应</p>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-stone-100">
            <img
              src={generatedUrl || originalUrl}
              alt="改造讲解图"
              className="h-[520px] w-full object-contain grayscale-[65%] contrast-[0.88] brightness-[1.08] saturate-[0.35]"
            />
            <div className="pointer-events-none absolute inset-0 bg-white/28" />

            {items.map((item) => {
              const highlighted = activeId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActiveId(item.id)}
                  onMouseLeave={() => setActiveId(null)}
                  onFocus={() => setActiveId(item.id)}
                  onBlur={() => setActiveId(null)}
                  className={`absolute z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-sm font-semibold transition ${
                    highlighted
                      ? 'border-orange-400 bg-orange-100 text-orange-700 shadow-lg shadow-orange-200'
                      : 'border-stone-300 bg-white text-stone-700 shadow-md'
                  }`}
                  style={{ left: `${item.imageTarget.x}%`, top: `${item.imageTarget.y}%` }}
                  aria-label={`${item.markerLabel} ${item.name}`}
                >
                  {item.markerLabel}
                </button>
              );
            })}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 22, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.08 }}
          className="rounded-3xl bg-white p-6 shadow-xl shadow-stone-200/35 md:p-8"
        >
          <h2 className="text-2xl font-semibold text-stone-900">编号执行指南</h2>
          <p className="mt-2 text-sm text-stone-500">从 ① 开始做，按顺序执行最省力。</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {items.map((item) => {
              const highlighted = activeId === item.id;
              return (
                <article
                  key={item.id}
                  onMouseEnter={() => setActiveId(item.id)}
                  onMouseLeave={() => setActiveId(null)}
                  className={`rounded-2xl border p-5 transition ${
                    highlighted
                      ? 'border-orange-300 bg-orange-50/60 shadow-lg shadow-orange-100'
                      : 'border-stone-200 bg-stone-50/70'
                  }`}
                >
                  <h3 className="text-lg font-medium text-stone-900">
                    {item.markerLabel} {item.name}
                  </h3>
                  <p className="mt-2 text-sm text-stone-700">买什么：{item.card.buy}</p>
                  <p className="mt-1 text-sm text-stone-600">价格：{item.card.priceRange}</p>
                  <p className="mt-1 text-sm text-stone-600">放哪里：{item.card.placement}</p>
                  <p className="mt-1 text-sm text-stone-500">为什么：{item.card.why}</p>
                </article>
              );
            })}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 22, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.12 }}
          className="rounded-3xl bg-white p-6 shadow-xl shadow-stone-200/35 md:p-8"
        >
          <h2 className="text-xl font-semibold text-stone-900">改造前后对比</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-stone-100 p-3">
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-stone-400">Before</p>
              <img
                src={originalUrl || generatedUrl}
                alt="改造前"
                className="h-48 w-full rounded-xl object-contain"
              />
            </div>
            <div className="rounded-2xl bg-stone-100 p-3">
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-stone-400">After</p>
              <img
                src={generatedUrl || originalUrl}
                alt="改造后"
                className="h-48 w-full rounded-xl object-contain"
              />
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 22, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.16 }}
          className="rounded-3xl bg-white p-6 shadow-xl shadow-stone-200/35 md:p-8"
        >
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-6 py-3 text-sm text-white"
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
          </div>
          {notice ? <p className="mt-4 text-sm text-stone-500">{notice}</p> : null}
        </motion.section>
      </div>
    </div>
  );
}
