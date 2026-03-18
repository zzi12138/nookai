'use client';

import { motion } from 'framer-motion';
import { Check, Copy, Download, Plus, RefreshCw, Save } from 'lucide-react';
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

function normalizeGuideItem(item: GuideItem, index: number): GuideItem {
  const category = CATEGORY_ORDER.includes(item.category) ? item.category : 'Functional accessories';
  const necessity: Necessity = ['Must-have', 'Recommended', 'Optional'].includes(item.necessity)
    ? item.necessity
    : 'Recommended';

  const quantity = Math.round(clamp(Number(item.quantity || 1), 1, 3));
  const minPrice = Math.round(clamp(Number(item.priceMin || 99), 39, 4999));
  const maxPrice = Math.round(clamp(Number(item.priceMax || minPrice + 80), minPrice + 20, minPrice + 140));

  const hasAnchor = Boolean(item.imageTarget?.hasAnchor);
  const confidence = Number.isFinite(item.imageTarget?.confidence)
    ? clamp(Number(item.imageTarget.confidence), 0, 1)
    : 0;

  const x = Number.isFinite(item.imageTarget?.x) ? clamp(item.imageTarget.x, 4, 96) : 50;
  const y = Number.isFinite(item.imageTarget?.y) ? clamp(item.imageTarget.y, 6, 94) : 50;

  return {
    ...item,
    id: item.id || index + 1,
    category,
    necessity,
    quantity,
    priceMin: minPrice,
    priceMax: maxPrice,
    priceRange: `¥${minPrice}-${maxPrice}`,
    placement: item.placement || 'Place where it does not block movement',
    reason: item.reason || 'Improves the room quickly',
    imageTarget: {
      x,
      y,
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

  const lines: string[] = ['NookAI Shopping List', ''];

  for (const group of groups) {
    lines.push(`[${group.category}]`);
    for (const item of group.list) {
      lines.push(
        `- ${item.name} | ${item.priceRange} | qty x${item.quantity} | placement: ${item.placement} | ${item.necessity}`
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

  const sliderRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<number, HTMLElement | null>>({});

  const [originalUrl, setOriginalUrl] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [theme, setTheme] = useState('Japandi');

  const [summary, setSummary] = useState('');
  const [items, setItems] = useState<GuideItem[]>([]);
  const [loadingGuide, setLoadingGuide] = useState(false);
  const [guideError, setGuideError] = useState('');

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [cartIds, setCartIds] = useState<number[]>([]);

  const [notice, setNotice] = useState('');

  const [comparePercent, setComparePercent] = useState(72);
  const [isDragging, setIsDragging] = useState(false);
  const [baseNatural, setBaseNatural] = useState<{ w: number; h: number } | null>(null);
  const [frame, setFrame] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const hasImage = Boolean(generatedUrl || originalUrl);
  const detectImage = generatedUrl || originalUrl;
  const canCompare = Boolean(generatedUrl && originalUrl);

  const activeId = selectedId ?? hoverId;
  const activeItem = useMemo(() => items.find((item) => item.id === activeId) || null, [items, activeId]);

  const groupedItems = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      list: items.filter((item) => item.category === category),
    })).filter((group) => group.list.length > 0);
  }, [items]);

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
    const timer = window.setTimeout(() => setNotice(''), 2300);
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
      setTheme(data.theme || 'Japandi');
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

    const cacheKey = `nookai_guide_v2_${hashString(`${theme}__${detectImage.slice(0, 256)}`)}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as GuideResponse;
        if (parsed.items?.length) {
          const normalized = parsed.items.map(normalizeGuideItem).slice(0, 6);
          setItems(normalized);
          setSummary(parsed.summary || 'Recognized from the current generated image.');
          setLoadingGuide(false);
          return;
        }
      } catch {
        // continue
      }
    }

    let lastError = 'Could not analyze current generated image';

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch('/api/explainer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: detectImage, theme }),
        });

        const data = (await response.json().catch(() => null)) as GuideResponse | null;

        if (!response.ok || !data?.items?.length) {
          lastError = data?.error || `Recognition failed (${attempt})`;
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 900 * attempt));
            continue;
          }
          throw new Error(lastError);
        }

        const normalized = data.items.map(normalizeGuideItem).slice(0, 6);
        setItems(normalized);
        setSummary(data.summary || 'Recognized from the current generated image.');

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
        lastError = error instanceof Error ? error.message : 'Recognition failed';
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 900 * attempt));
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
    void fetchGuide();
  }, [detectImage, fetchGuide]);

  const handleSelectItem = (id: number) => {
    setSelectedId((prev) => (prev === id ? null : id));
    setHoverId(null);
  };

  const handleHoverStart = (id: number) => {
    if (selectedId === null) setHoverId(id);
  };

  const handleHoverEnd = () => {
    if (selectedId === null) setHoverId(null);
  };

  const handleHotspotClick = (id: number) => {
    setSelectedId(id);
    const node = cardRefs.current[id];
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const toggleCart = (id: number) => {
    setCartIds((prev) => {
      if (prev.includes(id)) {
        setNotice('Removed from list');
        return prev.filter((x) => x !== id);
      }
      setNotice('Added to list');
      return [...prev, id];
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
      setNotice('Please add at least 1 item first');
      return;
    }

    try {
      await navigator.clipboard.writeText(buildChecklistText(selectedItems));
      setNotice('Shopping list copied');
    } catch {
      setNotice('Copy failed');
    }
  };

  const exportChecklistImage = () => {
    if (selectedItems.length === 0) {
      setNotice('Please add at least 1 item first');
      return;
    }

    const width = 1220;
    const rowHeight = 134;
    const headerHeight = 190;
    const footerHeight = 84;
    const height = headerHeight + selectedItems.length * rowHeight + footerHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      setNotice('Export failed');
      return;
    }

    ctx.fillStyle = '#FDF9F1';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#1c1917';
    ctx.font = 'bold 46px sans-serif';
    ctx.fillText('NookAI Shopping List', 64, 84);

    ctx.fillStyle = '#57534e';
    ctx.font = '24px sans-serif';
    ctx.fillText(`Selected: ${selectedItems.length}`, 64, 128);
    ctx.fillText(`Budget min ¥${budget.min} / max ¥${budget.max}`, 64, 162);

    selectedItems.forEach((item, idx) => {
      const y = headerHeight + idx * rowHeight;
      drawRoundRect(ctx, 46, y, width - 92, rowHeight - 18, 20);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.fillStyle = '#1c1917';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText(`${idx + 1}. ${item.name}`, 72, y + 44);

      ctx.fillStyle = '#57534e';
      ctx.font = '22px sans-serif';
      ctx.fillText(`${item.category} · ${item.priceRange} · qty x${item.quantity} · ${item.necessity}`, 72, y + 80);
      ctx.fillText(`Placement: ${item.placement}`, 72, y + 112);
    });

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `nookai-shopping-list-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setNotice('List image exported');
  };

  if (!hasImage) {
    return (
      <div className="min-h-screen bg-[#FDF9F1] px-5 py-10">
        <div className="mx-auto w-full max-w-[1680px] rounded-[28px] bg-white p-10 text-center shadow-sm ring-1 ring-stone-100">
          <p className="text-sm text-stone-500">No result image found. Please generate first.</p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="mt-5 rounded-full bg-stone-900 px-6 py-3 text-sm text-white"
          >
            Back to Home
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
              <p className="text-xs uppercase tracking-[0.24em] text-stone-400">RESULT + PURCHASE DECISION</p>
              <h1 className="mt-1 text-3xl font-semibold text-stone-900">Your Makeover Result</h1>
              <p className="mt-2 text-sm text-stone-500">{summary || 'Recognized from the current generated image.'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveResult}
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-4 py-2 text-sm text-stone-700"
              >
                <Save size={15} />
                Save Image
              </button>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm text-white"
              >
                <RefreshCw size={15} />
                Regenerate
              </button>
            </div>
          </div>
        </motion.header>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <motion.section
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...spring, delay: 0.03 }}
            className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-100 lg:p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-stone-700">Before / After Proof</p>
              <p className="text-xs text-stone-400">After is the primary view</p>
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
                <img
                  src={originalUrl || generatedUrl}
                  alt="Before"
                  className="h-full w-full object-contain"
                />

                <img
                  src={generatedUrl || originalUrl}
                  alt="After"
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
                    <div className="absolute inset-0 bg-black/24" />
                    <div
                      className="absolute h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/45 blur-2xl"
                      style={{ left: `${activeItem.imageTarget.x}%`, top: `${activeItem.imageTarget.y}%` }}
                    />
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

              {activeItem?.imageTarget.hasPoint ? (
                <button
                  type="button"
                  onClick={() => handleHotspotClick(activeItem.id)}
                  className="absolute z-30 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-400 bg-amber-100 text-xs font-semibold text-amber-700 shadow-md"
                  style={{
                    left: `${frame.left + (frame.width * activeItem.imageTarget.x) / 100}px`,
                    top: `${frame.top + (frame.height * activeItem.imageTarget.y) / 100}px`,
                  }}
                >
                  {activeItem.id}
                </button>
              ) : null}

              {activeItem?.imageTarget.hasAnchor ? (
                <div
                  className="pointer-events-none absolute z-30 rounded-full bg-stone-900/92 px-3 py-1 text-xs text-white"
                  style={{
                    left: `${frame.left + (frame.width * activeItem.imageTarget.x) / 100}px`,
                    top: `${Math.max(18, frame.top + (frame.height * activeItem.imageTarget.y) / 100 - 34)}px`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  {activeItem.name}
                </div>
              ) : null}
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
              <span>Before</span>
              <span>Drag to compare</span>
              <span>After</span>
            </div>
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...spring, delay: 0.06 }}
            className="space-y-4"
          >
            <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-100">
              <h2 className="text-base font-semibold text-stone-900">Decision Summary</h2>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-stone-50 p-3">
                  <p className="text-xs text-stone-400">Selected Items</p>
                  <p className="mt-1 text-2xl font-semibold text-stone-900">{selectedItems.length}</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-3">
                  <p className="text-xs text-stone-400">Budget</p>
                  <p className="mt-1 text-sm font-semibold text-stone-900">Min ¥{budget.min} / Max ¥{budget.max}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={copyChecklist}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-200 px-3 py-2.5 text-sm text-stone-700"
                >
                  <Copy size={14} />
                  Copy
                </button>
                <button
                  type="button"
                  onClick={exportChecklistImage}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-stone-900 px-3 py-2.5 text-sm text-white"
                >
                  <Download size={14} />
                  Export
                </button>
              </div>

              {notice ? <p className="mt-2 text-xs text-stone-500">{notice}</p> : null}
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-100">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-stone-900">AI Purchase Guide</h2>
                <button
                  type="button"
                  onClick={() => void fetchGuide()}
                  className="rounded-full border border-stone-200 px-3 py-1 text-xs text-stone-600"
                >
                  Refresh
                </button>
              </div>

              {loadingGuide ? (
                <p className="py-10 text-center text-sm text-stone-500">Recognizing items from current generated image...</p>
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
                          const preview = hoverId === item.id && selectedId === null;
                          const added = cartIds.includes(item.id);

                          return (
                            <article
                              key={item.id}
                              ref={(node) => {
                                cardRefs.current[item.id] = node;
                              }}
                              onClick={() => handleSelectItem(item.id)}
                              onMouseEnter={() => handleHoverStart(item.id)}
                              onMouseLeave={handleHoverEnd}
                              className={`cursor-pointer rounded-2xl border px-3.5 py-3 transition ${
                                selected
                                  ? 'border-amber-300 bg-amber-50/70 shadow-sm'
                                  : preview
                                    ? 'border-stone-300 bg-stone-50'
                                    : 'border-stone-200 bg-white'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h3 className="text-sm font-medium text-stone-900">{item.name}</h3>
                                  <p className="mt-0.5 text-xs text-stone-500">
                                    {item.priceRange} · qty x{item.quantity}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleCart(item.id);
                                  }}
                                  className={`inline-flex h-8 min-w-[70px] items-center justify-center gap-1 rounded-full border px-2 text-xs transition ${
                                    added
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                      : 'border-stone-200 bg-white text-stone-600'
                                  }`}
                                >
                                  {added ? <Check size={13} /> : <Plus size={13} />}
                                  <span>{added ? 'Added' : 'Add'}</span>
                                </button>
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                <span className={`rounded-full border px-2.5 py-1 ${NECESSITY_STYLE[item.necessity]}`}>
                                  {item.necessity}
                                </span>
                                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-600">
                                  {item.placement}
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
