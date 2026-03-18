'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadResult, type StoredResult } from '../lib/imageStore';

type PlanItem = {
  id: number;
  markerLabel: string;
  name: string;
  imageTarget: {
    x: number;
    y: number;
  };
  module: string;
  buy: string;
  priceRange: string;
  placement: string;
  value: string;
};

type ExplainerResponse = {
  explainerImageUrl?: string;
  summary?: string;
  items?: PlanItem[];
  error?: string;
};

const spring = { type: 'spring', stiffness: 120, damping: 20 } as const;

function toMarker(index: number) {
  const markers = ['①', '②', '③', '④', '⑤', '⑥'];
  return markers[index - 1] || String(index);
}

function getStyleHint(theme: string) {
  if (theme.includes('原木') || theme.toLowerCase().includes('japandi')) {
    return {
      buyTone: '原木 / 亚麻 / 暖白光',
      summary: '房间更舒服，核心是暖光、浅色织物和自然材质统一了视觉重心。',
    };
  }
  if (theme.includes('奶油')) {
    return {
      buyTone: '奶油 / 软糯面料 / 暖白光',
      summary: '房间更柔和，核心是统一浅暖色并补齐柔软织物与氛围照明。',
    };
  }
  if (theme.includes('复古')) {
    return {
      buyTone: '复古 / 木质细节 / 暖黄光',
      summary: '房间更有故事感，核心是暖色灯光与有记忆点的装饰焦点。',
    };
  }
  if (theme.includes('极简')) {
    return {
      buyTone: '极简 / 低饱和 / 线条干净',
      summary: '房间更干净，核心是减少杂乱并用少量关键软装完成点睛。',
    };
  }
  return {
    buyTone: '简约 / 低饱和 / 暖白光',
    summary: '房间更完整，核心是先补光，再统一软装颜色和材质。',
  };
}

function buildFallbackItems(theme: string): PlanItem[] {
  const hint = getStyleHint(theme);

  return [
    {
      id: 1,
      markerLabel: toMarker(1),
      name: '暖光落地灯',
      imageTarget: { x: 73, y: 58 },
      module: '补一层侧向暖光，让房间从“亮”变成“有氛围”。',
      buy: `简约落地灯（${hint.buyTone}，建议 3000K）`,
      priceRange: '¥159-399',
      placement: '放在沙发右侧或沙发后方，灯光朝向休息区。',
      value: '这是提升氛围感最快、最稳的一步。',
    },
    {
      id: 2,
      markerLabel: toMarker(2),
      name: '浅色地毯',
      imageTarget: { x: 52, y: 75 },
      module: '用地毯把休息区框出来，空间会更有层次。',
      buy: '浅米色地毯（短绒、易打理）',
      priceRange: '¥199-499',
      placement: '铺在沙发前或床尾，压住家具前脚更稳定。',
      value: '可以快速减少“空”和“散”的感觉。',
    },
    {
      id: 3,
      markerLabel: toMarker(3),
      name: '简约挂画',
      imageTarget: { x: 67, y: 33 },
      module: '给墙面一个视觉焦点，不用刷墙也能提升完成度。',
      buy: '免打孔简约挂画（单幅优先）',
      priceRange: '¥69-199',
      placement: '挂在沙发上方中线，距沙发背约 20-30cm。',
      value: '让空间不再空白，照片质感提升明显。',
    },
    {
      id: 4,
      markerLabel: toMarker(4),
      name: '中型绿植',
      imageTarget: { x: 84, y: 56 },
      module: '补自然元素，软化硬边界，让房间更有生气。',
      buy: '中型室内绿植（龟背竹/虎尾兰）',
      priceRange: '¥79-259',
      placement: '放在窗边或角落过渡位，避开主要通道。',
      value: '低预算就能拉高空间“生活感”。',
    },
    {
      id: 5,
      markerLabel: toMarker(5),
      name: '米色床品',
      imageTarget: { x: 24, y: 84 },
      module: '统一大面积软装主色，让视觉更干净。',
      buy: '米色纯色床品 + 1-2 个抱枕',
      priceRange: '¥179-459',
      placement: '床面以浅暖色为主，深色仅保留小面积点缀。',
      value: '床面面积最大，改对后整体立刻更协调。',
    },
  ];
}

function normalizeItems(raw: PlanItem[] | undefined, theme: string) {
  const fallback = buildFallbackItems(theme);
  if (!Array.isArray(raw) || raw.length === 0) return fallback;

  return raw
    .slice(0, 6)
    .map((item, index) => {
      const base = fallback[index] || fallback[fallback.length - 1];
      const id = Number.isFinite(item?.id) ? Number(item.id) : index + 1;
      const x = Math.min(96, Math.max(4, Number(item?.imageTarget?.x || base.imageTarget.x)));
      const y = Math.min(94, Math.max(6, Number(item?.imageTarget?.y || base.imageTarget.y)));
      return {
        id,
        markerLabel: item?.markerLabel || toMarker(id),
        name: item?.name || base.name,
        imageTarget: { x, y },
        module: item?.module || base.module,
        buy: item?.buy || base.buy,
        priceRange: item?.priceRange || base.priceRange,
        placement: item?.placement || base.placement,
        value: item?.value || base.value,
      };
    })
    .sort((a, b) => a.id - b.id);
}

export default function PlanPage() {
  const router = useRouter();

  const [theme, setTheme] = useState('日式原木风');
  const [originalUrl, setOriginalUrl] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [explainerImageUrl, setExplainerImageUrl] = useState('');
  const [summary, setSummary] = useState('');
  const [items, setItems] = useState<PlanItem[]>([]);

  const [activeId, setActiveId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [isBooting, setIsBooting] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const requestedRef = useRef(false);

  const hint = useMemo(() => getStyleHint(theme), [theme]);

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
      try {
        if (id) {
          const cachedPlan = sessionStorage.getItem(`nookai_plan_${id}`);
          if (cachedPlan) {
            try {
              const parsed = JSON.parse(cachedPlan) as ExplainerResponse;
              if (parsed.explainerImageUrl) {
                setExplainerImageUrl(parsed.explainerImageUrl);
                setSummary(parsed.summary || '');
                setItems(normalizeItems(parsed.items, theme));
              }
            } catch {
              // ignore invalid cache
            }
          }

          const stored = await loadResult(id);
          if (stored) {
            hydrate(stored);
            return;
          }
        }

        const cached = sessionStorage.getItem('nookai_result_image');
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as Partial<StoredResult>;
            hydrate(parsed);
            return;
          } catch {
            // ignore invalid cache
          }
        }
      } finally {
        if (isActive) setIsBooting(false);
      }
    };

    void load();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const source = generatedUrl || originalUrl;
    if (!source || requestedRef.current) return;

    requestedRef.current = true;
    setIsGenerating(true);
    setError('');

    const request = async () => {
      try {
        const response = await fetch('/api/explainer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: source, theme }),
        });

        const data = (await response.json().catch(() => null)) as ExplainerResponse | null;

        if (!response.ok || !data?.explainerImageUrl) {
          throw new Error(data?.error || '讲解图生成失败，请稍后重试');
        }

        setExplainerImageUrl(data.explainerImageUrl);
        setSummary(data.summary || hint.summary);

        const normalized = normalizeItems(data.items, theme);
        setItems(normalized);

        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (id) {
          sessionStorage.setItem(
            `nookai_plan_${id}`,
            JSON.stringify({
              explainerImageUrl: data.explainerImageUrl,
              summary: data.summary || hint.summary,
              items: normalized,
            })
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '讲解图生成失败，请稍后重试');
        setExplainerImageUrl(source);
        setSummary(hint.summary);
        setItems(buildFallbackItems(theme));
      } finally {
        setIsGenerating(false);
      }
    };

    void request();
  }, [generatedUrl, originalUrl, theme, hint.summary]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  );

  const displayImage = explainerImageUrl || generatedUrl || originalUrl;

  if (isBooting) {
    return (
      <div className="min-h-screen bg-[#FDF9F1] px-4 py-16">
        <div className="mx-auto max-w-5xl rounded-3xl bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-stone-500">正在载入改造方案...</p>
        </div>
      </div>
    );
  }

  if (!generatedUrl && !originalUrl) {
    return (
      <div className="min-h-screen bg-[#FDF9F1] px-4 py-16">
        <div className="mx-auto max-w-5xl rounded-3xl bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-stone-500">还没有可用效果图，请先返回生成页面。</p>
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
    <div className="min-h-screen bg-[#FDF9F1] px-4 py-8 md:py-12">
      <div className="mx-auto w-full max-w-6xl space-y-6 md:space-y-8">
        <section className="rounded-3xl bg-white px-6 py-6 shadow-sm md:px-8 md:py-8">
          <p className="text-xs uppercase tracking-[0.22em] text-stone-400">NookAI Plan</p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-900">AI改造指南</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-500">
            {summary || hint.summary}
          </p>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm md:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-stone-900 md:text-2xl">改造讲解图</h2>
            <p className="text-xs text-stone-400">点击图中编号查看建议</p>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-stone-100">
            <img
              src={displayImage}
              alt="改造讲解图"
              className="block max-h-[72vh] w-full object-contain"
            />

            {items.map((item) => {
              const highlighted = activeId === item.id || selectedId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  onMouseEnter={() => setActiveId(item.id)}
                  onMouseLeave={() => setActiveId(null)}
                  onFocus={() => setActiveId(item.id)}
                  onBlur={() => setActiveId(null)}
                  className={`absolute z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-sm font-semibold transition ${
                    highlighted
                      ? 'border-amber-400 bg-amber-100 text-amber-700 shadow-md shadow-amber-200'
                      : 'border-stone-300 bg-white/95 text-stone-700 shadow-sm'
                  }`}
                  style={{ left: `${item.imageTarget.x}%`, top: `${item.imageTarget.y}%` }}
                  aria-label={`${item.markerLabel} ${item.name}`}
                >
                  {item.markerLabel}
                </button>
              );
            })}

            {isGenerating ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
                <div className="rounded-2xl bg-white/90 px-5 py-3 text-sm text-stone-600 shadow-sm">
                  正在生成主体线稿与编号建议...
                </div>
              </div>
            ) : null}
          </div>

          {error ? <p className="mt-3 text-sm text-amber-700">{error}</p> : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {items.map((item) => {
              const highlighted = activeId === item.id || selectedId === item.id;
              return (
                <button
                  key={`chip-${item.id}`}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  onMouseEnter={() => setActiveId(item.id)}
                  onMouseLeave={() => setActiveId(null)}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    highlighted
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {item.markerLabel} {item.name}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-2.5 text-sm text-stone-700"
            >
              <RefreshCw size={15} />
              重新生成
            </button>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {selectedItem ? (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedId(null)}
              className="fixed inset-0 z-40 bg-black/30"
              aria-label="关闭模块详情"
            />

            <motion.section
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={spring}
              className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-4xl rounded-t-3xl bg-white p-6 shadow-2xl md:p-7"
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-stone-200" />
              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-stone-900">
                  {selectedItem.markerLabel} {selectedItem.name}
                </h3>
                <p className="text-sm text-stone-600">模块作用：{selectedItem.module}</p>
                <p className="text-sm text-stone-600">购买建议：{selectedItem.buy}</p>
                <p className="text-sm text-stone-600">价格区间：{selectedItem.priceRange}</p>
                <p className="text-sm text-stone-600">摆放位置：{selectedItem.placement}</p>
                <p className="text-sm text-stone-600">为什么值得买：{selectedItem.value}</p>
              </div>
            </motion.section>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
