'use client';

import { motion } from 'framer-motion';
import { Check, Copy, Download, Plus, RefreshCw, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadResult, type StoredResult } from '../lib/imageStore';

type GuideCategory = 'lighting' | 'textile' | 'decor' | 'plant' | 'functional';
type Necessity = '必买' | '建议买' | '可选';

type GuideItem = {
  id: number;
  name: string;
  category: GuideCategory;
  quantity: number;
  priceRange: string;
  placement: string;
  necessity: Necessity;
  reason: string;
  imageTarget: {
    x: number;
    y: number;
  };
};

const spring = { type: 'spring', stiffness: 120, damping: 20 } as const;

const CATEGORY_META: Record<GuideCategory, string> = {
  lighting: '灯光',
  textile: '软装布艺',
  decor: '装饰',
  plant: '绿植',
  functional: '功能区物件',
};

const CATEGORY_ORDER: GuideCategory[] = ['lighting', 'textile', 'decor', 'plant', 'functional'];

const NECESSITY_STYLE: Record<Necessity, string> = {
  必买: 'bg-red-50 text-red-700 border-red-200',
  建议买: 'bg-amber-50 text-amber-700 border-amber-200',
  可选: 'bg-stone-100 text-stone-600 border-stone-200',
};

function getStyleHint(theme: string) {
  if (theme.includes('原木') || theme.toLowerCase().includes('japandi')) {
    return '原木 / 亚麻 / 暖白光';
  }
  if (theme.includes('奶油')) {
    return '奶油 / 低饱和 / 暖白光';
  }
  if (theme.includes('复古')) {
    return '复古 / 木质 / 暖黄光';
  }
  if (theme.includes('极简')) {
    return '极简 / 线条干净 / 低饱和';
  }
  return '简约 / 暖白光 / 中性织物';
}

function buildGuideItems(theme: string): GuideItem[] {
  const hint = getStyleHint(theme);

  return [
    {
      id: 1,
      name: '暖光落地灯',
      category: 'lighting',
      quantity: 1,
      priceRange: '¥159-399',
      placement: '沙发右侧或后方',
      necessity: '必买',
      reason: '最快提升氛围层次',
      imageTarget: { x: 73, y: 58 },
    },
    {
      id: 2,
      name: '浅色地毯',
      category: 'textile',
      quantity: 1,
      priceRange: '¥199-499',
      placement: '沙发前或床尾',
      necessity: '必买',
      reason: '划分区域，减少空散感',
      imageTarget: { x: 52, y: 75 },
    },
    {
      id: 3,
      name: '米色床品',
      category: 'textile',
      quantity: 1,
      priceRange: '¥179-459',
      placement: '床面主色统一',
      necessity: '建议买',
      reason: '大面积软装统一风格',
      imageTarget: { x: 24, y: 84 },
    },
    {
      id: 4,
      name: '免打孔挂画',
      category: 'decor',
      quantity: 1,
      priceRange: '¥69-199',
      placement: '沙发或床上方中线',
      necessity: '建议买',
      reason: '形成视觉焦点',
      imageTarget: { x: 67, y: 33 },
    },
    {
      id: 5,
      name: '中型绿植',
      category: 'plant',
      quantity: 1,
      priceRange: '¥79-259',
      placement: '窗边或角落过渡区',
      necessity: '建议买',
      reason: '提升空间生气与自然感',
      imageTarget: { x: 84, y: 56 },
    },
    {
      id: 6,
      name: `桌面收纳托盘（${hint}）`,
      category: 'functional',
      quantity: 1,
      priceRange: '¥39-129',
      placement: '书桌左上或床边台面',
      necessity: '可选',
      reason: '减少杂物外露，维持整洁',
      imageTarget: { x: 12, y: 58 },
    },
  ];
}

function parsePriceRange(range: string) {
  const nums = (range.match(/\d+/g) || []).map((n) => Number(n));
  if (nums.length === 0) return { min: 0, max: 0 };
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: nums[0], max: nums[1] };
}

function formatChecklist(items: GuideItem[]) {
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    list: items.filter((item) => item.category === category),
  })).filter((group) => group.list.length > 0);

  const lines: string[] = ['NookAI 购物清单', ''];

  groups.forEach((group) => {
    lines.push(`【${CATEGORY_META[group.category]}】`);
    group.list.forEach((item) => {
      lines.push(
        `- ${item.name} | 数量 x${item.quantity} | ${item.priceRange} | 摆放：${item.placement} | ${item.necessity}`
      );
    });
    lines.push('');
  });

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
  const [notice, setNotice] = useState('');

  const [viewMode, setViewMode] = useState<'after' | 'compare'>('after');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [cartIds, setCartIds] = useState<number[]>([]);

  const hasImage = Boolean(generatedUrl || originalUrl);

  const items = useMemo(() => buildGuideItems(theme), [theme]);
  const activeId = hoveredId ?? selectedId;
  const activeItem = useMemo(() => items.find((item) => item.id === activeId) || null, [activeId, items]);

  const selectedItems = useMemo(
    () => items.filter((item) => cartIds.includes(item.id)),
    [items, cartIds]
  );

  const groupedItems = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        list: items.filter((item) => item.category === category),
      })).filter((group) => group.list.length > 0),
    [items]
  );

  const budget = useMemo(() => {
    return selectedItems.reduce(
      (acc, item) => {
        const range = parsePriceRange(item.priceRange);
        return {
          min: acc.min + range.min * item.quantity,
          max: acc.max + range.max * item.quantity,
        };
      },
      { min: 0, max: 0 }
    );
  }, [selectedItems]);

  useEffect(() => {
    if (!selectedId && items.length > 0) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    let isActive = true;

    const hydrate = (data: Partial<StoredResult>) => {
      if (!isActive) return;
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
      isActive = false;
    };
  }, []);

  const scrollToCard = (id: number) => {
    const node = cardRefs.current[id];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleHotspotClick = (id: number) => {
    setViewMode('after');
    setSelectedId(id);
    scrollToCard(id);
  };

  const handleToggleCart = (id: number) => {
    setCartIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((itemId) => itemId !== id) : [...prev, id];
      setNotice(exists ? '已从购物清单移除' : '已加入购物清单');
      return next;
    });
  };

  const handleSaveResult = () => {
    const target = generatedUrl || originalUrl;
    if (!target) return;

    const link = document.createElement('a');
    link.href = target;
    link.download = `nookai-result-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyChecklist = async () => {
    if (selectedItems.length === 0) {
      setNotice('请先加入至少 1 件到购物清单');
      return;
    }

    try {
      await navigator.clipboard.writeText(formatChecklist(selectedItems));
      setNotice('购物清单已复制');
    } catch {
      setNotice('复制失败，请重试');
    }
  };

  const handleDownloadChecklistImage = () => {
    if (selectedItems.length === 0) {
      setNotice('请先加入至少 1 件到购物清单');
      return;
    }

    const width = 1120;
    const rowHeight = 132;
    const headerHeight = 180;
    const footerHeight = 96;
    const height = headerHeight + selectedItems.length * rowHeight + footerHeight;

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
    ctx.fillText(`已加入 ${selectedItems.length} 件`, 64, 122);
    ctx.fillText(`预算约 ¥${budget.min} - ¥${budget.max}`, 64, 156);

    let y = headerHeight - 16;
    selectedItems.forEach((item, index) => {
      const cardY = y + index * rowHeight;
      drawRoundRect(ctx, 48, cardY, width - 96, rowHeight - 18, 20);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.fillStyle = '#1c1917';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText(`${index + 1}. ${item.name}`, 74, cardY + 46);

      ctx.fillStyle = '#57534e';
      ctx.font = '22px sans-serif';
      ctx.fillText(`分类：${CATEGORY_META[item.category]}  数量：x${item.quantity}  ${item.priceRange}`, 74, cardY + 82);
      ctx.fillText(`摆放：${item.placement}  必要程度：${item.necessity}`, 74, cardY + 112);
    });

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `nookai-shopping-list-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setNotice('清单图片已下载');
  };

  if (!hasImage) {
    return (
      <div className="min-h-screen bg-[#FDF9F1] px-4 py-12">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-10 text-center shadow-sm">
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
    <div className="min-h-screen bg-[#FDF9F1] px-4 py-8 text-stone-800 md:py-10">
      <div className="mx-auto w-full max-w-[1280px] space-y-6">
        <motion.header
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={spring}
          className="rounded-3xl bg-white p-6 shadow-sm md:p-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-stone-400">NOOKAI RESULT</p>
              <h1 className="mt-1 text-3xl font-semibold text-stone-900">效果图与购物指南</h1>
              <p className="mt-2 text-sm text-stone-500">{theme}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveResult}
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

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,1fr)]">
          <motion.section
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...spring, delay: 0.02 }}
            className="rounded-3xl bg-white p-4 shadow-sm md:p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-stone-700">改造效果联动预览</p>
              <div className="inline-flex rounded-full bg-stone-100 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setViewMode('after')}
                  className={`rounded-full px-4 py-1.5 transition ${
                    viewMode === 'after' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
                  }`}
                >
                  效果图
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('compare')}
                  className={`rounded-full px-4 py-1.5 transition ${
                    viewMode === 'compare' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
                  }`}
                >
                  Before / After
                </button>
              </div>
            </div>

            {viewMode === 'after' ? (
              <div className="relative overflow-hidden rounded-2xl bg-stone-100">
                <img
                  src={generatedUrl || originalUrl}
                  alt="效果图"
                  className="block w-full h-auto object-contain"
                />

                {activeItem ? <div className="pointer-events-none absolute inset-0 bg-black/30" /> : null}

                {activeItem ? (
                  <div
                    className="pointer-events-none absolute z-10 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/35 blur-2xl"
                    style={{ left: `${activeItem.imageTarget.x}%`, top: `${activeItem.imageTarget.y}%` }}
                  />
                ) : null}

                {items.map((item) => {
                  const highlighted = item.id === activeId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleHotspotClick(item.id)}
                      onMouseEnter={() => setHoveredId(item.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={`absolute z-20 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-xs font-semibold transition ${
                        highlighted
                          ? 'border-amber-400 bg-amber-100 text-amber-700 shadow-md shadow-amber-200'
                          : 'border-stone-300 bg-white/95 text-stone-700 shadow-sm'
                      }`}
                      style={{ left: `${item.imageTarget.x}%`, top: `${item.imageTarget.y}%` }}
                      aria-label={item.name}
                    >
                      {item.id}
                    </button>
                  );
                })}

                {activeItem ? (
                  <div
                    className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-full bg-stone-900/92 px-3 py-1 text-xs text-white"
                    style={{ left: `${activeItem.imageTarget.x}%`, top: `${activeItem.imageTarget.y - 4}%` }}
                  >
                    {activeItem.name}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-stone-100 p-3">
                  <p className="mb-2 text-xs uppercase tracking-[0.16em] text-stone-400">Before</p>
                  <img
                    src={originalUrl || generatedUrl}
                    alt="改造前"
                    className="block w-full h-auto rounded-xl object-contain"
                  />
                </div>
                <div className="rounded-2xl bg-stone-100 p-3">
                  <p className="mb-2 text-xs uppercase tracking-[0.16em] text-stone-400">After</p>
                  <img
                    src={generatedUrl || originalUrl}
                    alt="改造后"
                    className="block w-full h-auto rounded-xl object-contain"
                  />
                </div>
              </div>
            )}

            <p className="mt-3 text-xs text-stone-500">点击图中数字可定位到右侧对应物件。</p>
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...spring, delay: 0.05 }}
            className="space-y-4"
          >
            <section className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-lg font-semibold text-stone-900">购物清单汇总</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-stone-50 p-3">
                  <p className="text-stone-400">已加入</p>
                  <p className="mt-1 text-xl font-semibold text-stone-900">{selectedItems.length} 件</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-3">
                  <p className="text-stone-400">预算范围</p>
                  <p className="mt-1 text-xl font-semibold text-stone-900">¥{budget.min}-{budget.max}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                <button
                  type="button"
                  onClick={handleCopyChecklist}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-200 px-4 py-2.5 text-sm text-stone-700"
                >
                  <Copy size={15} />
                  复制清单
                </button>
                <button
                  type="button"
                  onClick={handleDownloadChecklistImage}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-stone-900 px-4 py-2.5 text-sm text-white"
                >
                  <Download size={15} />
                  下载清单图片
                </button>
              </div>
              {notice ? <p className="mt-3 text-xs text-stone-500">{notice}</p> : null}
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-lg font-semibold text-stone-900">购物指南</h2>
              <div className="mt-4 max-h-[62vh] space-y-5 overflow-y-auto pr-1">
                {groupedItems.map((group) => (
                  <div key={group.category} className="space-y-2">
                    <p className="text-sm font-medium text-stone-700">{CATEGORY_META[group.category]}</p>
                    <div className="space-y-2">
                      {group.list.map((item) => {
                        const added = cartIds.includes(item.id);
                        const focused = item.id === activeId;

                        return (
                          <article
                            key={item.id}
                            ref={(node) => {
                              cardRefs.current[item.id] = node;
                            }}
                            onClick={() => {
                              setViewMode('after');
                              setSelectedId(item.id);
                            }}
                            onMouseEnter={() => setHoveredId(item.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            className={`cursor-pointer rounded-2xl border p-3.5 transition ${
                              focused
                                ? 'border-amber-300 bg-amber-50/65 shadow-sm'
                                : 'border-stone-200 bg-white hover:border-stone-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
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
                                  handleToggleCart(item.id);
                                }}
                                className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs transition ${
                                  added
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-stone-200 bg-white text-stone-600'
                                }`}
                              >
                                {added ? <Check size={14} /> : <Plus size={14} />}
                                <span className="ml-1">{added ? '已加入' : '加入'}</span>
                              </button>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
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
            </section>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
