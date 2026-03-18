'use client';

import { motion } from 'framer-motion';
import { Check, Copy, Download, Plus, RefreshCw, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadResult, type StoredResult } from '../lib/imageStore';

type Category =
  | '主照明'
  | '氛围照明'
  | '地面软装'
  | '床品布艺'
  | '墙面装饰'
  | '绿植'
  | '功能型小物';

type Necessity = '必买' | '建议买' | '可选';

type GuideItem = {
  id: number;
  name: string;
  category: Category;
  quantity: number;
  priceMin: number;
  priceMax: number;
  priceRange: string;
  placement: string;
  necessity: Necessity;
  reason: string;
  imageTarget: {
    x: number;
    y: number;
    confidence: number;
    hasPoint: boolean;
  };
};

type GuideResponse = {
  summary?: string;
  items?: GuideItem[];
  error?: string;
};

const spring = { type: 'spring', stiffness: 120, damping: 20 } as const;

const CATEGORY_ORDER: Category[] = [
  '主照明',
  '氛围照明',
  '地面软装',
  '床品布艺',
  '墙面装饰',
  '绿植',
  '功能型小物',
];

const NECESSITY_STYLE: Record<Necessity, string> = {
  必买: 'border-red-200 bg-red-50 text-red-700',
  建议买: 'border-amber-200 bg-amber-50 text-amber-700',
  可选: 'border-stone-200 bg-stone-100 text-stone-600',
};

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return String(hash);
}

function normalizeItem(item: GuideItem, index: number): GuideItem {
  const min = Number.isFinite(item.priceMin) ? Math.max(39, Math.round(item.priceMin)) : 99;
  const maxRaw = Number.isFinite(item.priceMax) ? Math.round(item.priceMax) : min + 80;
  const max = Math.max(min + 20, Math.min(maxRaw, min + 260));
  const qty = Math.max(1, Math.min(3, Math.round(item.quantity || 1)));

  const hasX = Number.isFinite(item.imageTarget?.x);
  const hasY = Number.isFinite(item.imageTarget?.y);
  const confidence = Number.isFinite(item.imageTarget?.confidence)
    ? Math.max(0, Math.min(1, item.imageTarget.confidence))
    : 0;

  const x = hasX ? Math.max(4, Math.min(96, item.imageTarget.x)) : 50;
  const y = hasY ? Math.max(6, Math.min(94, item.imageTarget.y)) : 50;
  const hasPoint = Boolean(item.imageTarget?.hasPoint && hasX && hasY && confidence >= 0.55);

  const category = CATEGORY_ORDER.includes(item.category) ? item.category : '功能型小物';
  const necessity: Necessity = ['必买', '建议买', '可选'].includes(item.necessity)
    ? item.necessity
    : '建议买';

  return {
    ...item,
    id: item.id || index + 1,
    category,
    necessity,
    quantity: qty,
    priceMin: min,
    priceMax: max,
    priceRange: `¥${min}-${max}`,
    placement: item.placement || '放在不影响通行的主视觉区域',
    reason: item.reason || '提升空间完成度',
    imageTarget: {
      x,
      y,
      confidence,
      hasPoint,
    },
  };
}

function buildTextChecklist(items: GuideItem[]) {
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: items.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);

  const lines: string[] = ['NookAI 购物清单', ''];

  for (const group of groups) {
    lines.push(`【${group.category}】`);
    for (const item of group.items) {
      lines.push(
        `- ${item.name} | ${item.priceRange} | 数量x${item.quantity} | 摆放：${item.placement} | ${item.necessity}`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export default function ResultPage() {
  const router = useRouter();
  const cardRefs = useRef<Record<number, HTMLElement | null>>({});

  const [originalUrl, setOriginalUrl] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [theme, setTheme] = useState('日式原木风');

  const [viewMode, setViewMode] = useState<'after' | 'compare'>('after');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const [items, setItems] = useState<GuideItem[]>([]);
  const [guideSummary, setGuideSummary] = useState('');
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideError, setGuideError] = useState('');

  const [cartIds, setCartIds] = useState<number[]>([]);
  const [notice, setNotice] = useState('');

  const hasImage = Boolean(generatedUrl || originalUrl);
  const sourceImage = generatedUrl || originalUrl;

  const activeId = hoveredId ?? selectedId;
  const activeItem = useMemo(() => items.find((item) => item.id === activeId) || null, [items, activeId]);

  const groupedItems = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      list: items.filter((item) => item.category === category),
    })).filter((group) => group.list.length > 0);
  }, [items]);

  const selectedItems = useMemo(
    () => items.filter((item) => cartIds.includes(item.id)),
    [items, cartIds]
  );

  const budget = useMemo(
    () =>
      selectedItems.reduce(
        (acc, item) => ({
          min: acc.min + item.priceMin * item.quantity,
          max: acc.max + item.priceMax * item.quantity,
        }),
        { min: 0, max: 0 }
      ),
    [selectedItems]
  );

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    let active = true;

    const hydrate = (data: Partial<StoredResult>) => {
      if (!active) return;
      setOriginalUrl(data.original || '');
      setGeneratedUrl(data.generated || '');
      setTheme(data.theme || '日式原木风');
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
          return;
        } catch {
          // fallback below
        }
      }

      const img = params.get('img');
      if (img) {
        setGeneratedUrl(decodeURIComponent(img));
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const fetchGuide = useCallback(async () => {
    if (!sourceImage) return;

    setGuideLoading(true);
    setGuideError('');

    const cacheKey = `nookai_guide_${hashString(`${theme}__${sourceImage.slice(0, 96)}`)}`;
    const cached = sessionStorage.getItem(cacheKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached) as GuideResponse;
        if (parsed.items && parsed.items.length > 0) {
          const normalized = parsed.items.slice(0, 6).map(normalizeItem);
          setItems(normalized);
          setGuideSummary(parsed.summary || '根据当前效果图识别了可执行购买清单。');
          setGuideLoading(false);
          return;
        }
      } catch {
        // continue
      }
    }

    let lastError = '识别失败，请稍后重试';

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch('/api/explainer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: sourceImage, theme }),
        });

        const data = (await response.json().catch(() => null)) as GuideResponse | null;

        if (!response.ok || !data?.items?.length) {
          lastError = data?.error || `识别失败（第 ${attempt} 次）`;
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
            continue;
          }
          throw new Error(lastError);
        }

        const normalized = data.items.slice(0, 6).map(normalizeItem);
        setItems(normalized);
        setGuideSummary(data.summary || '根据当前效果图识别了可执行购买清单。');
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({
            summary: data.summary,
            items: normalized,
          })
        );
        setGuideLoading(false);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : '识别失败';
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
          continue;
        }
      }
    }

    setGuideError(lastError);
    setGuideLoading(false);
  }, [sourceImage, theme]);

  useEffect(() => {
    if (!sourceImage) return;
    setSelectedId(null);
    setHoveredId(null);
    setCartIds([]);
    void fetchGuide();
  }, [sourceImage, theme, fetchGuide]);

  const scrollToCard = (id: number) => {
    const node = cardRefs.current[id];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleCardSelect = (id: number) => {
    setViewMode('after');
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const handleHotspotClick = (id: number) => {
    setSelectedId(id);
    scrollToCard(id);
  };

  const toggleCart = (id: number) => {
    setCartIds((prev) => {
      if (prev.includes(id)) {
        setNotice('已从购物清单移除');
        return prev.filter((v) => v !== id);
      }
      setNotice('已加入购物清单');
      return [...prev, id];
    });
  };

  const saveResult = () => {
    if (!sourceImage) return;
    const link = document.createElement('a');
    link.href = sourceImage;
    link.download = `nookai-result-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyChecklist = async () => {
    if (selectedItems.length === 0) {
      setNotice('请先加入至少 1 件');
      return;
    }

    try {
      await navigator.clipboard.writeText(buildTextChecklist(selectedItems));
      setNotice('购物清单已复制');
    } catch {
      setNotice('复制失败，请重试');
    }
  };

  const downloadChecklistImage = () => {
    if (selectedItems.length === 0) {
      setNotice('请先加入至少 1 件');
      return;
    }

    const width = 1120;
    const rowHeight = 132;
    const headerHeight = 178;
    const footerHeight = 86;
    const height = headerHeight + rowHeight * selectedItems.length + footerHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      setNotice('导出失败，请重试');
      return;
    }

    ctx.fillStyle = '#FDF9F1';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#1c1917';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('NookAI 购物清单', 64, 78);

    ctx.fillStyle = '#57534e';
    ctx.font = '24px sans-serif';
    ctx.fillText(`已加入 ${selectedItems.length} 件`, 64, 120);
    ctx.fillText(`最低预算 ¥${budget.min}  最高预算 ¥${budget.max}`, 64, 152);

    selectedItems.forEach((item, i) => {
      const y = headerHeight + i * rowHeight;
      drawRoundRect(ctx, 48, y, width - 96, rowHeight - 18, 20);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.fillStyle = '#1c1917';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText(`${i + 1}. ${item.name}`, 72, y + 44);

      ctx.fillStyle = '#57534e';
      ctx.font = '22px sans-serif';
      ctx.fillText(
        `${item.category}  ·  ${item.priceRange}  ·  数量x${item.quantity}  ·  ${item.necessity}`,
        72,
        y + 79
      );
      ctx.fillText(`摆放：${item.placement}`, 72, y + 111);
    });

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `nookai-shopping-list-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setNotice('清单图片已下载');
  };

  if (!hasImage) {
    return (
      <div className="min-h-screen bg-[#FDF9F1] px-4 py-12">
        <div className="mx-auto max-w-[1280px] rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-stone-100">
          <p className="text-sm text-stone-500">还没有可展示的效果图，请先返回首页生成。</p>
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
    <div className="min-h-screen bg-[#FDF9F1] px-4 py-8 text-stone-800">
      <div className="mx-auto w-full max-w-[1280px] space-y-5">
        <motion.header
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={spring}
          className="rounded-3xl bg-white px-6 py-6 shadow-sm ring-1 ring-stone-100"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-stone-400">NOOKAI RESULT</p>
              <h1 className="mt-1 text-3xl font-semibold text-stone-900">效果图与购物指南</h1>
              <p className="mt-2 text-sm text-stone-500">{guideSummary || '基于当前效果图自动生成可执行购物清单'}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveResult}
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700"
              >
                <Save size={15} />
                保存效果图
              </button>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm text-white"
              >
                <RefreshCw size={15} />
                重新生成
              </button>
            </div>
          </div>
        </motion.header>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.48fr)_minmax(360px,1fr)]">
          <motion.section
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...spring, delay: 0.03 }}
            className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-100"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-stone-700">视觉联动区</p>
              <div className="inline-flex rounded-full bg-stone-100 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setViewMode('after')}
                  className={`rounded-full px-3.5 py-1.5 transition ${
                    viewMode === 'after' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
                  }`}
                >
                  效果图
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('compare')}
                  className={`rounded-full px-3.5 py-1.5 transition ${
                    viewMode === 'compare' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
                  }`}
                >
                  Before / After
                </button>
              </div>
            </div>

            {viewMode === 'after' ? (
              <div className="relative overflow-hidden rounded-2xl bg-stone-100">
                <img src={generatedUrl || originalUrl} alt="效果图" className="block w-full h-auto object-contain" />

                {activeItem ? <div className="pointer-events-none absolute inset-0 bg-black/28" /> : null}

                {activeItem ? (
                  <div
                    className="pointer-events-none absolute z-10 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/35 blur-2xl"
                    style={{ left: `${activeItem.imageTarget.x}%`, top: `${activeItem.imageTarget.y}%` }}
                  />
                ) : null}

                {activeItem?.imageTarget.hasPoint ? (
                  <button
                    type="button"
                    onClick={() => handleHotspotClick(activeItem.id)}
                    className="absolute z-20 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-400 bg-amber-100 text-xs font-semibold text-amber-700 shadow-md shadow-amber-200"
                    style={{ left: `${activeItem.imageTarget.x}%`, top: `${activeItem.imageTarget.y}%` }}
                  >
                    {activeItem.id}
                  </button>
                ) : null}

                {activeItem ? (
                  <div
                    className="pointer-events-none absolute z-20 -translate-x-1/2 rounded-full bg-stone-900/92 px-3 py-1 text-xs text-white"
                    style={{
                      left: `${activeItem.imageTarget.x}%`,
                      top: activeItem.imageTarget.hasPoint
                        ? `${Math.max(4, activeItem.imageTarget.y - 7)}%`
                        : '8%',
                      transform: activeItem.imageTarget.hasPoint
                        ? 'translate(-50%, -100%)'
                        : 'translateX(-50%)',
                    }}
                  >
                    {activeItem.name}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-stone-100 p-3">
                  <p className="mb-2 text-xs uppercase tracking-[0.16em] text-stone-400">Before</p>
                  <img src={originalUrl || generatedUrl} alt="改造前" className="block w-full h-auto rounded-xl object-contain" />
                </div>
                <div className="rounded-2xl bg-stone-100 p-3">
                  <p className="mb-2 text-xs uppercase tracking-[0.16em] text-stone-400">After</p>
                  <img src={generatedUrl || originalUrl} alt="改造后" className="block w-full h-auto rounded-xl object-contain" />
                </div>
              </div>
            )}

            <p className="mt-3 text-xs text-stone-500">默认不展示点位。点击右侧物件卡片后，只显示当前物件高亮与单个点位。</p>
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...spring, delay: 0.05 }}
            className="space-y-4"
          >
            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
              <h2 className="text-base font-semibold text-stone-900">购物清单汇总</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-stone-50 p-3">
                  <p className="text-stone-400">已加入</p>
                  <p className="mt-1 text-lg font-semibold text-stone-900">{selectedItems.length} 件</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-3">
                  <p className="text-stone-400">预算</p>
                  <p className="mt-1 text-sm font-semibold text-stone-900">最低 ¥{budget.min} / 最高 ¥{budget.max}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <button
                  type="button"
                  onClick={copyChecklist}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-200 px-3 py-2.5 text-sm text-stone-700"
                >
                  <Copy size={14} />
                  复制清单
                </button>
                <button
                  type="button"
                  onClick={downloadChecklistImage}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-stone-900 px-3 py-2.5 text-sm text-white"
                >
                  <Download size={14} />
                  导出清单
                </button>
              </div>
              {notice ? <p className="mt-2 text-xs text-stone-500">{notice}</p> : null}
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-stone-900">购物指南</h2>
                <button
                  type="button"
                  onClick={() => void fetchGuide()}
                  className="rounded-full border border-stone-200 px-3 py-1 text-xs text-stone-600"
                >
                  重新识别
                </button>
              </div>

              {guideLoading ? (
                <p className="py-8 text-center text-sm text-stone-500">正在识别当前效果图中的可执行物件...</p>
              ) : guideError ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700">
                  {guideError}
                </div>
              ) : (
                <div className="max-h-[66vh] space-y-5 overflow-y-auto pr-1">
                  {groupedItems.map((group) => (
                    <div key={group.category} className="space-y-2">
                      <p className="text-sm font-medium text-stone-700">{group.category}</p>
                      <div className="space-y-2">
                        {group.list.map((item) => {
                          const selected = selectedId === item.id;
                          const previewing = hoveredId === item.id;
                          const added = cartIds.includes(item.id);

                          return (
                            <article
                              key={item.id}
                              ref={(node) => {
                                cardRefs.current[item.id] = node;
                              }}
                              onClick={() => handleCardSelect(item.id)}
                              onMouseEnter={() => setHoveredId(item.id)}
                              onMouseLeave={() => setHoveredId(null)}
                              className={`cursor-pointer rounded-2xl border p-3 transition ${
                                selected
                                  ? 'border-amber-300 bg-amber-50/65 shadow-sm'
                                  : previewing
                                    ? 'border-stone-300 bg-stone-50'
                                    : 'border-stone-200 bg-white'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h3 className="text-sm font-medium text-stone-900">{item.name}</h3>
                                  <p className="mt-0.5 text-xs text-stone-500">
                                    {item.priceRange} · 数量 x{item.quantity}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleCart(item.id);
                                  }}
                                  className={`inline-flex h-8 items-center gap-1 rounded-full border px-2 text-xs transition ${
                                    added
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                      : 'border-stone-200 bg-white text-stone-600'
                                  }`}
                                >
                                  {added ? <Check size={13} /> : <Plus size={13} />}
                                  <span>{added ? '已加入' : '加入'}</span>
                                </button>
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                <span
                                  className={`rounded-full border px-2.5 py-1 ${NECESSITY_STYLE[item.necessity]}`}
                                >
                                  {item.necessity}
                                </span>
                                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-600">
                                  摆放：{item.placement}
                                </span>
                              </div>

                              <p className="mt-2 text-xs text-stone-500">{item.reason}</p>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
