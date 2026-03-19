'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Copy, Download, Plus, RefreshCw, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadResult, type StoredResult } from '../lib/imageStore';

type Category =
  | 'Ambient lighting'
  | 'Bedding & soft textiles'
  | 'Floor soft furnishings'
  | 'Wall decor'
  | 'Plants'
  | 'Functional accessories';

type Necessity = 'Must-have' | 'Recommended' | 'Optional';

type FilterKey = 'all' | 'must' | 'recommended' | 'optional';

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
    width: number;
    height: number;
    confidence: number;
    hasAnchor: boolean;
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
  'Ambient lighting',
  'Bedding & soft textiles',
  'Floor soft furnishings',
  'Wall decor',
  'Plants',
  'Functional accessories',
];

const CATEGORY_LABEL: Record<Category, string> = {
  'Ambient lighting': '灯光',
  'Bedding & soft textiles': '床品布艺',
  'Floor soft furnishings': '地面软装',
  'Wall decor': '墙面装饰',
  Plants: '绿植',
  'Functional accessories': '功能型小物',
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'must', label: '必买' },
  { key: 'recommended', label: '建议' },
  { key: 'optional', label: '可选' },
];

const NECESSITY_LABEL: Record<Necessity, string> = {
  'Must-have': '必买',
  Recommended: '建议买',
  Optional: '可选',
};

const NECESSITY_STYLE: Record<Necessity, string> = {
  'Must-have': 'border-red-200 bg-red-50 text-red-700',
  Recommended: 'border-amber-200 bg-amber-50 text-amber-700',
  Optional: 'border-stone-200 bg-stone-100 text-stone-600',
};

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33 + input.charCodeAt(i)) >>> 0;
  }
  return String(hash);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hasChinese(text: string) {
  return /[\u4e00-\u9fff]/.test(text);
}

function mapNameToChinese(rawName: string) {
  const name = rawName.trim();
  if (!name) return '软装单品';
  if (hasChinese(name)) return name;

  const lower = name.toLowerCase();
  if (lower.includes('floor lamp')) return '暖光落地灯';
  if (lower.includes('desk lamp') || lower.includes('table lamp')) return '桌面台灯';
  if (lower.includes('string light') || lower.includes('light strip')) return '窗帘灯串';
  if (lower.includes('rug') || lower.includes('carpet')) return '圆形地毯';
  if (lower.includes('bedding') || lower.includes('duvet')) return '亚麻床品';
  if (lower.includes('pillow')) return '装饰抱枕';
  if (lower.includes('blanket') || lower.includes('throw')) return '针织披毯';
  if (lower.includes('wall art') || lower.includes('poster') || lower.includes('painting')) return '免打孔挂画';
  if (lower.includes('plant') || lower.includes('greenery')) return '中型绿植';
  if (lower.includes('projector')) return '投影仪';
  if (lower.includes('side table')) return '小边几';
  if (lower.includes('tray') || lower.includes('storage')) return '桌面收纳盘';
  return name;
}

function mapPlacementToChinese(rawPlacement: string) {
  const value = rawPlacement.trim();
  if (!value) return '放在不挡动线的位置';
  if (hasChinese(value)) return value;

  const lower = value.toLowerCase();
  if (lower.includes('sofa') && lower.includes('right')) return '沙发右侧';
  if (lower.includes('sofa')) return '沙发附近';
  if (lower.includes('bedside') || lower.includes('bed side')) return '床侧边';
  if (lower.includes('desk')) return '书桌一角';
  if (lower.includes('wall')) return '床头或沙发背墙';
  if (lower.includes('window')) return '窗边';
  if (lower.includes('corner')) return '房间角落';
  if (lower.includes('center')) return '空间中部';
  return value;
}

function mapReasonToChinese(rawReason: string) {
  const value = rawReason.trim();
  if (!value) return '提升氛围最直接';
  if (hasChinese(value)) return value;

  const lower = value.toLowerCase();
  if (lower.includes('warm') || lower.includes('light')) return '补充暖光后房间更有层次';
  if (lower.includes('cozy')) return '让空间更放松舒适';
  if (lower.includes('focus')) return '快速形成视觉焦点';
  if (lower.includes('texture')) return '增加软装质感';
  return '提升空间完成度';
}

function fallbackBoxByCategory(category: Category) {
  if (category === 'Ambient lighting') return { width: 12, height: 20 };
  if (category === 'Bedding & soft textiles') return { width: 24, height: 18 };
  if (category === 'Floor soft furnishings') return { width: 30, height: 20 };
  if (category === 'Wall decor') return { width: 20, height: 16 };
  if (category === 'Plants') return { width: 14, height: 22 };
  return { width: 16, height: 14 };
}

function normalizeGuideItem(item: GuideItem, index: number): GuideItem {
  const category = CATEGORY_ORDER.includes(item.category) ? item.category : 'Functional accessories';
  const necessity: Necessity = ['Must-have', 'Recommended', 'Optional'].includes(item.necessity)
    ? item.necessity
    : 'Recommended';

  const quantity = Math.round(clamp(Number(item.quantity || 1), 1, 3));
  const minPrice = Math.round(clamp(Number(item.priceMin || 99), 39, 4999));
  const maxPrice = Math.round(clamp(Number(item.priceMax || minPrice + 60), minPrice + 20, minPrice + 120));

  const hasAnchor = Boolean(item.imageTarget?.hasAnchor);
  const confidence = Number.isFinite(item.imageTarget?.confidence)
    ? clamp(Number(item.imageTarget.confidence), 0, 1)
    : 0;

  const x = Number.isFinite(item.imageTarget?.x) ? clamp(item.imageTarget.x, 4, 96) : 50;
  const y = Number.isFinite(item.imageTarget?.y) ? clamp(item.imageTarget.y, 6, 94) : 50;
  const fallbackBox = fallbackBoxByCategory(category);
  const width = Number.isFinite(item.imageTarget?.width)
    ? clamp(Number(item.imageTarget.width), 6, 56)
    : fallbackBox.width;
  const height = Number.isFinite(item.imageTarget?.height)
    ? clamp(Number(item.imageTarget.height), 6, 56)
    : fallbackBox.height;
  const safeX = clamp(x, width / 2 + 1, 100 - width / 2 - 1);
  const safeY = clamp(y, height / 2 + 1, 100 - height / 2 - 1);

  return {
    ...item,
    id: item.id || index + 1,
    name: mapNameToChinese(item.name || ''),
    category,
    necessity,
    quantity,
    priceMin: minPrice,
    priceMax: maxPrice,
    priceRange: `¥${minPrice}-${maxPrice}`,
    placement: mapPlacementToChinese(item.placement || ''),
    reason: mapReasonToChinese(item.reason || ''),
    imageTarget: {
      x: safeX,
      y: safeY,
      width,
      height,
      confidence,
      hasAnchor,
      hasPoint: Boolean(item.imageTarget?.hasPoint && hasAnchor && confidence >= 0.63),
    },
  };
}

function buildChecklistText(items: GuideItem[]) {
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    list: items.filter((item) => item.category === category),
  })).filter((group) => group.list.length > 0);

  const lines: string[] = ['NookAI 购物清单', ''];

  for (const group of groups) {
    lines.push(`[${CATEGORY_LABEL[group.category]}]`);
    for (const item of group.list) {
      lines.push(
        `- ${item.name} | ${item.priceRange} | 数量x${item.quantity} | 摆放: ${item.placement} | ${NECESSITY_LABEL[item.necessity]}`
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

function passFilter(item: GuideItem, filter: FilterKey) {
  if (filter === 'all') return true;
  if (filter === 'must') return item.necessity === 'Must-have';
  if (filter === 'recommended') return item.necessity === 'Recommended';
  return item.necessity === 'Optional';
}

function getLabelStyle(target: GuideItem['imageTarget']) {
  const rightEdge = target.x + target.width / 2;
  const leftEdge = target.x - target.width / 2;
  const topEdge = target.y - target.height / 2;
  const placeRight = rightEdge <= 78;
  const x = placeRight ? clamp(rightEdge + 1.8, 4, 95) : clamp(leftEdge - 1.8, 5, 96);
  const y = clamp(topEdge - 1.5, 7, 94);

  return {
    left: `${x}%`,
    top: `${y}%`,
    transform: placeRight ? 'translate(0, -100%)' : 'translate(-100%, -100%)',
  } as const;
}

function getHighlightStyle(target: GuideItem['imageTarget']) {
  const left = clamp(target.x - target.width / 2, 0, 100 - target.width);
  const top = clamp(target.y - target.height / 2, 0, 100 - target.height);
  return {
    left: `${left}%`,
    top: `${top}%`,
    width: `${target.width}%`,
    height: `${target.height}%`,
  } as const;
}

export default function ResultPage() {
  const router = useRouter();

  const sliderRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<number, HTMLElement | null>>({});

  const [originalUrl, setOriginalUrl] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [theme, setTheme] = useState('日式原木风');

  const [summary, setSummary] = useState('');
  const [items, setItems] = useState<GuideItem[]>([]);
  const [loadingGuide, setLoadingGuide] = useState(false);
  const [guideError, setGuideError] = useState('');

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [cartIds, setCartIds] = useState<number[]>([]);

  const [filter, setFilter] = useState<FilterKey>('all');
  const [expandedCategory, setExpandedCategory] = useState<Category | null>(null);

  const [notice, setNotice] = useState('');

  const [comparePercent, setComparePercent] = useState(72);
  const [isDragging, setIsDragging] = useState(false);
  const [baseNatural, setBaseNatural] = useState<{ w: number; h: number } | null>(null);
  const [frame, setFrame] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const hasImage = Boolean(generatedUrl || originalUrl);
  const detectImage = generatedUrl || originalUrl;
  const canCompare = Boolean(generatedUrl && originalUrl);

  const filteredItems = useMemo(() => items.filter((item) => passFilter(item, filter)), [items, filter]);

  const activeId = selectedId ?? hoverId;
  const activeItem = useMemo(
    () => filteredItems.find((item) => item.id === activeId) || null,
    [filteredItems, activeId]
  );

  const groupedItems = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      list: filteredItems.filter((item) => item.category === category),
    })).filter((group) => group.list.length > 0);
  }, [filteredItems]);

  const selectedItems = useMemo(() => items.filter((item) => cartIds.includes(item.id)), [items, cartIds]);

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

  const updateCompareByX = useCallback(
    (clientX: number) => {
      const container = sliderRef.current;
      if (!container || !frame.width) return;
      const rect = container.getBoundingClientRect();
      const imageLeftInViewport = rect.left + frame.left;
      const raw = ((clientX - imageLeftInViewport) / frame.width) * 100;
      setComparePercent(clamp(raw, 0, 100));
    },
    [frame.width, frame.left]
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
          // fallback
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

  useEffect(() => {
    const container = sliderRef.current;
    if (!container || !baseNatural) return;

    const recalc = () => {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const ratioW = rect.width / baseNatural.w;
      const ratioH = rect.height / baseNatural.h;
      const scale = Math.min(ratioW, ratioH);

      const width = baseNatural.w * scale;
      const height = baseNatural.h * scale;
      const left = (rect.width - width) / 2;
      const top = (rect.height - height) / 2;

      setFrame({ left, top, width, height });
    };

    recalc();
    const observer = new ResizeObserver(recalc);
    observer.observe(container);
    window.addEventListener('resize', recalc);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recalc);
    };
  }, [baseNatural]);

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (event: PointerEvent) => updateCompareByX(event.clientX);
    const onUp = () => setIsDragging(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isDragging, updateCompareByX]);

  const fetchGuide = useCallback(async () => {
    if (!detectImage) return;

    setLoadingGuide(true);
    setGuideError('');

    const cacheKey = `nookai_guide_v5_${hashString(`${theme}__${detectImage.slice(0, 256)}`)}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as GuideResponse;
        if (parsed.items?.length) {
          const normalized = parsed.items.map(normalizeGuideItem).slice(0, 16);
          setItems(normalized);
          setSummary(parsed.summary || '已从当前效果图识别可购买项。');
          setLoadingGuide(false);
          return;
        }
      } catch {
        // continue
      }
    }

    let lastError = '当前效果图识别失败';

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch('/api/explainer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: detectImage, theme }),
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

        const normalized = data.items.map(normalizeGuideItem).slice(0, 16);
        setItems(normalized);
        setSummary(data.summary || '已从当前效果图识别可购买项。');

        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({
            summary: data.summary,
            items: normalized,
          })
        );

        setLoadingGuide(false);
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
    setLoadingGuide(false);
  }, [detectImage, theme]);

  useEffect(() => {
    if (!detectImage) return;
    setSelectedId(null);
    setHoverId(null);
    setCartIds([]);
    setFilter('all');
    void fetchGuide();
  }, [detectImage, fetchGuide]);

  useEffect(() => {
    if (groupedItems.length === 0) {
      setExpandedCategory(null);
      return;
    }

    if (!expandedCategory || !groupedItems.some((group) => group.category === expandedCategory)) {
      setExpandedCategory(groupedItems[0].category);
    }
  }, [groupedItems, expandedCategory]);

  useEffect(() => {
    const visibleIds = new Set(filteredItems.map((item) => item.id));

    if (selectedId !== null && !visibleIds.has(selectedId)) {
      setSelectedId(null);
    }
    if (hoverId !== null && !visibleIds.has(hoverId)) {
      setHoverId(null);
    }
  }, [filteredItems, selectedId, hoverId]);

  const handleSelectItem = (id: number, category: Category) => {
    setExpandedCategory(category);
    setSelectedId((prev) => (prev === id ? null : id));
    setHoverId(null);
  };

  const handleHoverStart = (id: number) => {
    if (selectedId === null) {
      setHoverId(id);
    }
  };

  const handleHoverEnd = () => {
    if (selectedId === null) {
      setHoverId(null);
    }
  };

  const toggleCart = (id: number) => {
    setCartIds((prev) => {
      if (prev.includes(id)) {
        setNotice('已从清单移除');
        return prev.filter((x) => x !== id);
      }
      setNotice('已加入购物清单');
      return [...prev, id];
    });
  };

  const addAllVisibleToCart = () => {
    if (filteredItems.length === 0) {
      setNotice('当前列表没有可加入物件');
      return;
    }

    setCartIds((prev) => {
      const next = new Set(prev);
      let addedCount = 0;
      for (const item of filteredItems) {
        if (!next.has(item.id)) {
          next.add(item.id);
          addedCount += 1;
        }
      }
      setNotice(addedCount > 0 ? `已一键加入 ${addedCount} 件` : '当前列表已全部加入');
      return Array.from(next);
    });
  };

  const saveResult = () => {
    const target = generatedUrl || originalUrl;
    if (!target) return;

    const a = document.createElement('a');
    a.href = target;
    a.download = `nookai-result-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyChecklist = async () => {
    if (selectedItems.length === 0) {
      setNotice('请先加入至少 1 件物品');
      return;
    }

    try {
      await navigator.clipboard.writeText(buildChecklistText(selectedItems));
      setNotice('购物清单已复制');
    } catch {
      setNotice('复制失败');
    }
  };

  const exportChecklistImage = () => {
    if (selectedItems.length === 0) {
      setNotice('请先加入至少 1 件物品');
      return;
    }

    const width = 1120;
    const rowHeight = 122;
    const headerHeight = 176;
    const footerHeight = 72;
    const height = headerHeight + selectedItems.length * rowHeight + footerHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      setNotice('导出失败');
      return;
    }

    ctx.fillStyle = '#FDF9F1';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#1c1917';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('NookAI 购物清单', 58, 78);

    ctx.fillStyle = '#57534e';
    ctx.font = '23px sans-serif';
    ctx.fillText(`已选 ${selectedItems.length} 件`, 58, 118);
    ctx.fillText(`最低预算 ¥${budget.min} / 最高预算 ¥${budget.max}`, 58, 150);

    selectedItems.forEach((item, idx) => {
      const y = headerHeight + idx * rowHeight;
      drawRoundRect(ctx, 38, y, width - 76, rowHeight - 16, 18);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.fillStyle = '#1c1917';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(`${idx + 1}. ${item.name}`, 62, y + 40);

      ctx.fillStyle = '#57534e';
      ctx.font = '20px sans-serif';
      ctx.fillText(`${CATEGORY_LABEL[item.category]} · ${item.priceRange} · 数量x${item.quantity}`, 62, y + 74);
      ctx.fillText(`摆放：${item.placement} · ${NECESSITY_LABEL[item.necessity]}`, 62, y + 102);
    });

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `nookai-shopping-list-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setNotice('清单图片已导出');
  };

  if (!hasImage) {
    return (
      <div className="min-h-screen bg-[#FDF9F1] px-5 py-10">
        <div className="mx-auto w-full max-w-[1680px] rounded-[28px] bg-white p-10 text-center shadow-sm ring-1 ring-stone-100">
          <p className="text-sm text-stone-500">未找到效果图，请先完成生成。</p>
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

  const afterClip = `inset(0 ${100 - comparePercent}% 0 0)`;

  return (
    <div className="min-h-screen bg-[#FDF9F1] px-5 py-7 text-stone-800 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-[1680px] space-y-5">
        <motion.header
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={spring}
          className="rounded-[28px] bg-white px-7 py-6 shadow-sm ring-1 ring-stone-100"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-stone-400">RESULT + PURCHASE GUIDE</p>
              <h1 className="mt-1 text-3xl font-semibold text-stone-900">效果图与购物指南</h1>
              <p className="mt-2 text-sm text-stone-500">{summary || '已从当前效果图识别关键可购买物件。'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveResult}
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-4 py-2 text-sm text-stone-700"
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

        <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <motion.section
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...spring, delay: 0.03 }}
            className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-100 lg:p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-stone-700">改造前后对比</p>
              <p className="text-xs text-stone-400">默认展示干净效果图，选择右侧物件后高亮对应区域</p>
            </div>

            <div
              ref={sliderRef}
              className="relative min-h-[500px] overflow-hidden rounded-[24px] bg-stone-100 lg:min-h-[620px]"
              onClick={(event) => updateCompareByX(event.clientX)}
            >
              <div
                className="absolute"
                style={{
                  left: `${frame.left}px`,
                  top: `${frame.top}px`,
                  width: `${frame.width}px`,
                  height: `${frame.height}px`,
                }}
              >
                <img src={originalUrl || generatedUrl} alt="原图" className="h-full w-full object-contain" />

                <img
                  src={generatedUrl || originalUrl}
                  alt="效果图"
                  onLoad={(event) => {
                    if (baseNatural) return;
                    setBaseNatural({
                      w: event.currentTarget.naturalWidth || 1,
                      h: event.currentTarget.naturalHeight || 1,
                    });
                  }}
                  className="absolute inset-0 h-full w-full object-contain"
                  style={{ clipPath: canCompare ? afterClip : 'inset(0 0 0 0)' }}
                />

                {activeItem?.imageTarget.hasAnchor ? (
                  <div className="absolute inset-0" style={{ clipPath: canCompare ? afterClip : 'inset(0 0 0 0)' }}>
                    <div className="absolute inset-0 bg-black/28" />
                    <div
                      className="absolute rounded-[20px] border border-amber-100/90 bg-amber-200/22 shadow-[0_0_42px_rgba(251,191,36,0.46)]"
                      style={getHighlightStyle(activeItem.imageTarget)}
                    />
                    <div
                      className="pointer-events-none absolute z-30 rounded-full border border-stone-200 bg-white/95 px-3 py-1 text-xs text-stone-700 shadow-sm"
                      style={getLabelStyle(activeItem.imageTarget)}
                    >
                      {activeItem.name}
                    </div>
                  </div>
                ) : null}
              </div>

              {canCompare ? (
                <motion.div
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setIsDragging(true);
                    updateCompareByX(event.clientX);
                  }}
                  className="absolute z-20 w-11 -translate-x-1/2 cursor-ew-resize select-none touch-none"
                  style={{
                    left: `${frame.left + (frame.width * comparePercent) / 100}px`,
                    top: `${frame.top}px`,
                    height: `${frame.height}px`,
                  }}
                >
                  <div className="mx-auto h-full w-[2px] bg-white/95" />
                  <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-white shadow-lg" />
                </motion.div>
              ) : null}

            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
              <span>原图</span>
              <span>拖动中线查看对比</span>
              <span>效果图</span>
            </div>
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...spring, delay: 0.06 }}
            className="h-full"
          >
            <section className="flex h-full min-h-[500px] flex-col rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-100 lg:min-h-[720px]">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-stone-900">购物指南</h2>
                <button
                  type="button"
                  onClick={() => void fetchGuide()}
                  className="rounded-full border border-stone-200 px-3 py-1 text-xs text-stone-600"
                >
                  刷新识别
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-stone-50 p-3">
                  <p className="text-xs text-stone-400">已加入</p>
                  <p className="mt-1 text-2xl font-semibold text-stone-900">{selectedItems.length}</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-3">
                  <p className="text-xs text-stone-400">预算范围</p>
                  <p className="mt-1 text-sm font-semibold text-stone-900">最低 ¥{budget.min} · 最高 ¥{budget.max}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {FILTERS.map((item) => {
                  const active = filter === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setFilter(item.key)}
                      className={`rounded-full px-3 py-1.5 text-xs transition ${
                        active ? 'bg-stone-900 text-white' : 'border border-stone-200 bg-white text-stone-600'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                {loadingGuide ? (
                  <p className="py-10 text-center text-sm text-stone-500">正在识别当前效果图中的可购买物件...</p>
                ) : guideError ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700">
                    {guideError}
                  </div>
                ) : groupedItems.length === 0 ? (
                  <p className="rounded-2xl bg-stone-50 px-3 py-5 text-center text-sm text-stone-500">当前筛选下暂无可展示物件</p>
                ) : (
                  <div className="space-y-2">
                    {groupedItems.map((group) => {
                      const open = expandedCategory === group.category;
                      return (
                        <div key={group.category} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
                          <button
                            type="button"
                            onClick={() => setExpandedCategory((prev) => (prev === group.category ? null : group.category))}
                            className="flex w-full items-center justify-between px-3.5 py-3 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-stone-800">{CATEGORY_LABEL[group.category]}</span>
                              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">{group.list.length}</span>
                            </div>
                            <ChevronDown
                              size={15}
                              className={`text-stone-400 transition-transform ${open ? 'rotate-180' : 'rotate-0'}`}
                            />
                          </button>

                          <AnimatePresence initial={false}>
                            {open ? (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22 }}
                                className="space-y-2 overflow-hidden px-3.5 pb-3"
                              >
                                {group.list.map((item) => {
                                  const selected = selectedId === item.id;
                                  const preview = hoverId === item.id && selectedId === null;
                                  const added = cartIds.includes(item.id);

                                  return (
                                    <article
                                      key={item.id}
                                      ref={(node) => {
                                        cardRefs.current[item.id] = node;
                                      }}
                                      onClick={() => handleSelectItem(item.id, group.category)}
                                      onMouseEnter={() => handleHoverStart(item.id)}
                                      onMouseLeave={handleHoverEnd}
                                      className={`cursor-pointer rounded-xl border px-3 py-2.5 transition ${
                                        selected
                                          ? 'border-amber-300 bg-amber-50/70 shadow-sm'
                                          : preview
                                            ? 'border-stone-300 bg-stone-50'
                                            : 'border-stone-200 bg-white'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                          <h3 className="text-sm font-medium text-stone-900">{item.name}</h3>
                                          <p className="mt-0.5 text-xs text-stone-500">{item.priceRange}</p>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            toggleCart(item.id);
                                          }}
                                          className={`inline-flex h-7 min-w-[62px] items-center justify-center gap-1 rounded-full border px-2 text-xs transition ${
                                            added
                                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                              : 'border-stone-200 bg-white text-stone-600'
                                          }`}
                                        >
                                          {added ? <Check size={12} /> : <Plus size={12} />}
                                          <span>{added ? '已加入' : '加入'}</span>
                                        </button>
                                      </div>

                                      <AnimatePresence initial={false}>
                                        {selected ? (
                                          <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.18 }}
                                            className="mt-2 overflow-hidden"
                                          >
                                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                              <span className={`rounded-full border px-2 py-0.5 ${NECESSITY_STYLE[item.necessity]}`}>
                                                {NECESSITY_LABEL[item.necessity]}
                                              </span>
                                              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600">
                                                数量 x{item.quantity}
                                              </span>
                                            </div>

                                            <p className="mt-2 text-xs text-stone-600">摆放：{item.placement}</p>
                                            <p className="mt-1 text-xs text-stone-500">{item.reason}</p>
                                          </motion.div>
                                        ) : null}
                                      </AnimatePresence>
                                    </article>
                                  );
                                })}
                              </motion.div>
                            ) : null}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-3 border-t border-stone-100 pt-3">
                <div className="grid grid-cols-2 gap-2">
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
                    onClick={exportChecklistImage}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-stone-900 px-3 py-2.5 text-sm text-white"
                  >
                    <Download size={14} />
                    导出清单
                  </button>
                </div>

                <button
                  type="button"
                  onClick={addAllVisibleToCart}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
                >
                  <Plus size={14} />
                  一键加入购物车
                </button>

                {notice ? <p className="mt-2 text-xs text-stone-500">{notice}</p> : null}
              </div>
            </section>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
