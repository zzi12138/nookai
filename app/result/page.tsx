'use client';

import { motion } from 'framer-motion';
import {
  Bug,
  Check,
  Copy,
  Download,
  Layers3,
  MoveHorizontal,
  Plus,
  Share2,
  ShoppingCart,
  Sparkles,
  UserCircle2,
  Wand2,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBoardCellBySlot, getDefaultBoardCellForIndex, type BoardCell } from '../lib/itemsBoard';
import { loadResult, type StoredResult } from '../lib/imageStore';

type Necessity = 'Must-have' | 'Recommended' | 'Optional';
type FilterKey = 'all' | 'must' | 'recommended' | 'optional';

type Category =
  | 'Ambient lighting'
  | 'Bedding & soft textiles'
  | 'Floor soft furnishings'
  | 'Wall decor'
  | 'Plants'
  | 'Functional accessories';

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
  boardCell?: BoardCell;
  imageTarget?: {
    x?: number;
    y?: number;
  };
};

type GuideResponse = {
  summary?: string;
  items?: GuideItem[];
  itemsBoardImageUrl?: string;
  extractedBoardStatus?: string;
  fallbackReason?: string | null;
  extractedBoardDebug?: {
    status?: string;
    generationAttempted?: boolean;
    generationSucceeded?: boolean;
    rawImageKind?: string;
    rawImageRef?: string;
    rawImageLength?: number;
    cleanupAttempted?: boolean;
    cleanupSucceeded?: boolean;
    cleanedImageKind?: string;
    cleanedImageRef?: string;
    cleanedImageLength?: number;
    failureCode?: string | null;
    failureReason?: string | null;
    fallbackReason?: string | null;
    thumbnailSource?: 'extracted_board' | 'main_image_fallback';
    validation?: {
      checked?: boolean;
      valid?: boolean;
      hasText?: boolean;
      hasGridOrFrames?: boolean;
      whiteBackgroundScore?: number;
      backgroundMostlyWhite?: boolean;
      reasons?: string[];
      failureCode?: string | null;
    };
  };
  error?: string;
};

type MiniGameToken = {
  id: number;
  x: number;
  y: number;
  vx: number;
  kind: 'lamp' | 'rug' | 'plant' | 'art' | 'pillow' | 'basket' | 'clutter';
  rotate: number;
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
  'Ambient lighting': '灯具',
  'Bedding & soft textiles': '布艺织物',
  'Floor soft furnishings': '地毯地垫',
  'Wall decor': '装饰物',
  Plants: '绿植',
  'Functional accessories': '功能小物',
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'must', label: '必买' },
  { key: 'recommended', label: '建议' },
  { key: 'optional', label: '可选' },
];

const NECESSITY_LABEL: Record<Necessity, string> = {
  'Must-have': '必买',
  Recommended: '建议',
  Optional: '可选',
};

const defaultSummary =
  '基于你的房间结构，我们优先推荐了更容易落地的灯光、布艺和装饰单品。整体目标是用低预算完成高体感升级。';

const TOKEN_META: Record<
  MiniGameToken['kind'],
  { label: string; score: number; className: string }
> = {
  lamp: { label: '灯', score: 12, className: 'bg-amber-100 text-amber-700' },
  rug: { label: '毯', score: 10, className: 'bg-stone-100 text-stone-700' },
  plant: { label: '植', score: 14, className: 'bg-emerald-100 text-emerald-700' },
  art: { label: '画', score: 11, className: 'bg-orange-100 text-orange-700' },
  pillow: { label: '枕', score: 9, className: 'bg-rose-100 text-rose-700' },
  basket: { label: '筐', score: 13, className: 'bg-yellow-100 text-yellow-700' },
  clutter: { label: '杂', score: -12, className: 'bg-zinc-200 text-zinc-700' },
};

const GOOD_TOKEN_KINDS: MiniGameToken['kind'][] = [
  'lamp',
  'rug',
  'plant',
  'art',
  'pillow',
  'basket',
];

function normalizeNecessity(value?: string): Necessity {
  const v = (value || '').toLowerCase();
  if (v.includes('must') || v.includes('必')) return 'Must-have';
  if (v.includes('optional') || v.includes('可选')) return 'Optional';
  return 'Recommended';
}

function normalizeCategory(value?: string): Category {
  const input = (value || '').toLowerCase();
  if (input.includes('light') || input.includes('灯')) return 'Ambient lighting';
  if (input.includes('bedding') || input.includes('textile') || input.includes('床品') || input.includes('抱枕') || input.includes('毯')) {
    return 'Bedding & soft textiles';
  }
  if (input.includes('floor') || input.includes('rug') || input.includes('地毯')) return 'Floor soft furnishings';
  if (input.includes('wall') || input.includes('画') || input.includes('poster')) return 'Wall decor';
  if (input.includes('plant') || input.includes('绿植')) return 'Plants';
  return 'Functional accessories';
}

function getFallbackItems(): GuideItem[] {
  return [
    {
      id: 1,
      name: '复古百褶落地灯',
      category: 'Ambient lighting',
      quantity: 1,
      priceMin: 159,
      priceMax: 239,
      priceRange: '¥159-239',
      placement: '沙发右侧或沙发后方',
      necessity: 'Must-have',
      reason: '最快提升房间氛围层次',
    },
    {
      id: 2,
      name: '原木氛围台灯',
      category: 'Ambient lighting',
      quantity: 1,
      priceMin: 69,
      priceMax: 119,
      priceRange: '¥69-119',
      placement: '书桌右上角',
      necessity: 'Recommended',
      reason: '补充夜间柔光，减少顶灯压迫感',
    },
    {
      id: 3,
      name: '水洗棉麻四件套',
      category: 'Bedding & soft textiles',
      quantity: 1,
      priceMin: 179,
      priceMax: 259,
      priceRange: '¥179-259',
      placement: '床面整体替换',
      necessity: 'Must-have',
      reason: '统一空间主视觉色调',
    },
    {
      id: 4,
      name: '简约挂画',
      category: 'Wall decor',
      quantity: 1,
      priceMin: 79,
      priceMax: 129,
      priceRange: '¥79-129',
      placement: '床头背景墙中心',
      necessity: 'Recommended',
      reason: '补足视觉焦点，画面更完整',
    },
  ];
}

function normalizeItems(raw: GuideItem[] | undefined): GuideItem[] {
  if (!raw || raw.length === 0) return getFallbackItems();

  return raw.slice(0, 14).map((item, index) => {
    const id = Number.isFinite(item.id) ? item.id : index + 1;
    const quantity = Math.max(1, Math.min(3, Math.round(Number(item.quantity || 1))));
    const priceMin = Math.max(39, Math.round(Number(item.priceMin || 99)));
    const priceMax = Math.max(priceMin + 10, Math.round(Number(item.priceMax || priceMin + 80)));

    return {
      id,
      name: item.name || `软装单品 ${id}`,
      category: normalizeCategory(item.category),
      quantity,
      priceMin,
      priceMax,
      priceRange: `¥${priceMin}-${priceMax}`,
      placement: item.placement || '放在不影响动线的位置',
      necessity: normalizeNecessity(item.necessity),
      reason: item.reason || '提升空间完成度',
      boardCell: item.boardCell,
      imageTarget: item.imageTarget,
    };
  });
}

function itemMatchesFilter(item: GuideItem, filter: FilterKey) {
  if (filter === 'all') return true;
  if (filter === 'must') return item.necessity === 'Must-have';
  if (filter === 'recommended') return item.necessity === 'Recommended';
  return item.necessity === 'Optional';
}

function formatBudget(min: number, max: number) {
  return `最低 ¥${min} · 最高 ¥${max}`;
}

async function shrinkGuideImageDataUrl(dataUrl: string, maxEdge = 1280, quality = 0.82) {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return dataUrl;

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image-load-failed'));
      img.src = dataUrl;
    });

    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) return dataUrl;

    const scale = Math.min(1, maxEdge / Math.max(width, height));
    if (scale >= 1 && dataUrl.length < 1_500_000) return dataUrl;

    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(image, 0, 0, targetW, targetH);

    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return dataUrl;
  }
}

function getItemBoardCell(item: GuideItem, index: number) {
  const slot = Number(item.boardCell?.index);
  if (Number.isFinite(slot) && slot >= 1 && slot <= 12) {
    return getBoardCellBySlot(slot);
  }
  return getDefaultBoardCellForIndex(index);
}

function BoardCellPreview({
  boardUrl,
  cell,
  className,
}: {
  boardUrl: string;
  cell: BoardCell;
  className?: string;
}) {
  const leftPercent = cell.left;
  const topPercent = cell.top;
  const widthPercent = cell.width;
  const heightPercent = cell.height;

  return (
    <div className={`relative overflow-hidden ${className || ''}`} role="img" aria-label="物件预览">
      <img
        src={boardUrl}
        alt=""
        className="pointer-events-none absolute max-w-none select-none"
        draggable={false}
        style={{
          width: `${(100 / widthPercent) * 100}%`,
          height: `${(100 / heightPercent) * 100}%`,
          left: `-${(leftPercent / widthPercent) * 100}%`,
          top: `-${(topPercent / heightPercent) * 100}%`,
        }}
      />
    </div>
  );
}

function BeforeAfterSlider({ before, after }: { before: string; after: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(0.55);
  const [dragging, setDragging] = useState(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const next = (clientX - rect.left) / rect.width;
    setRatio(Math.min(1, Math.max(0, next)));
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(true);
    updateFromClientX(event.clientX);
  };

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: PointerEvent) => {
      updateFromClientX(event.clientX);
    };
    const onUp = () => {
      setDragging(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, updateFromClientX]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setRatio((prev) => Math.max(0, prev - 0.02));
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setRatio((prev) => Math.min(1, prev + 0.02));
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setRatio(0);
    }
    if (event.key === 'End') {
      event.preventDefault();
      setRatio(1);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-[#f7edde] shadow-2xl"
      onPointerDown={onPointerDown}
    >
      <img src={before} alt="Before" className="absolute inset-0 h-full w-full object-cover" />

      <div
        className="absolute inset-0"
        style={{
          clipPath: `inset(0 ${100 - ratio * 100}% 0 0)`,
        }}
      >
        <img src={after} alt="After" className="h-full w-full object-cover" />
      </div>

      <div className="pointer-events-none absolute left-6 top-6 rounded-full bg-black/20 px-4 py-2 text-xs font-medium uppercase tracking-widest text-white">
        After
      </div>
      <div className="pointer-events-none absolute right-6 top-6 rounded-full bg-black/20 px-4 py-2 text-xs font-medium uppercase tracking-widest text-white">
        Before
      </div>

      <div
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="absolute inset-y-0 z-20 w-0"
        style={{ left: `${ratio * 100}%` }}
      >
        <div className="absolute inset-y-0 -left-[1px] w-[2px] bg-white/70" />
        <div className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#52372d]/10 bg-white/90 shadow-lg">
          <MoveHorizontal className="h-5 w-5 text-[#52372d]" />
        </div>
      </div>
    </div>
  );
}

function LoadingMiniGame({
  active,
  progress,
}: {
  active: boolean;
  progress: number;
}) {
  const gameRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const spawnAccumulatorRef = useRef(0);
  const idRef = useRef(1);
  const userControlUntilRef = useRef(0);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const playerYRef = useRef(50);
  const tokensRef = useRef<MiniGameToken[]>([]);

  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [playerY, setPlayerY] = useState(50);
  const [tokens, setTokens] = useState<MiniGameToken[]>([]);

  useEffect(() => {
    playerYRef.current = playerY;
  }, [playerY]);

  useEffect(() => {
    tokensRef.current = tokens;
  }, [tokens]);

  useEffect(() => {
    if (!active) return;

    setTimeLeft(60);
    setScore(0);
    setCombo(0);
    setPlayerY(50);
    setTokens([]);
    scoreRef.current = 0;
    comboRef.current = 0;
    playerYRef.current = 50;
    tokensRef.current = [];
    idRef.current = 1;
    spawnAccumulatorRef.current = 0;
    userControlUntilRef.current = 0;

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setScore(0);
          setCombo(0);
          scoreRef.current = 0;
          comboRef.current = 0;
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;

    lastTimeRef.current = performance.now();

    const loop = (now: number) => {
      const deltaMs = now - lastTimeRef.current;
      lastTimeRef.current = now;
      const delta = Math.min(0.05, deltaMs / 1000);
      spawnAccumulatorRef.current += delta;

      setTokens((prev) => {
        let next = prev;

        if (spawnAccumulatorRef.current >= 0.55) {
          spawnAccumulatorRef.current = 0;
          const isBad = Math.random() < 0.22;
          const kind = isBad
            ? 'clutter'
            : GOOD_TOKEN_KINDS[Math.floor(Math.random() * GOOD_TOKEN_KINDS.length)];
          const fresh: MiniGameToken = {
            id: idRef.current++,
            x: 108,
            y: 12 + Math.random() * 76,
            vx: 20 + Math.random() * 16,
            rotate: (Math.random() - 0.5) * 18,
            kind,
          };
          next = [...next, fresh];
        }

        const moved = next
          .map((item) => ({ ...item, x: item.x - item.vx * delta, rotate: item.rotate + delta * 18 }))
          .filter((item) => item.x >= -10);

        const survived: MiniGameToken[] = [];
        let scoreDelta = 0;
        let comboDelta = comboRef.current;

        for (const item of moved) {
          const hitX = Math.abs(item.x - 14) <= 6.4;
          const hitY = Math.abs(item.y - playerYRef.current) <= 11;
          if (hitX && hitY) {
            const deltaScore = TOKEN_META[item.kind].score;
            scoreDelta += deltaScore;
            if (deltaScore > 0) {
              comboDelta += 1;
            } else {
              comboDelta = 0;
            }
          } else {
            survived.push(item);
          }
        }

        if (scoreDelta !== 0) {
          scoreRef.current = Math.max(0, scoreRef.current + scoreDelta + Math.max(0, comboDelta - 1) * 2);
          setScore(scoreRef.current);
        }

        if (comboDelta !== comboRef.current) {
          comboRef.current = comboDelta;
          setCombo(comboDelta);
        }

        tokensRef.current = survived;
        return survived;
      });

      setPlayerY((prev) => {
        if (performance.now() < userControlUntilRef.current) return prev;

        const targetToken = tokensRef.current
          .filter((item) => item.kind !== 'clutter')
          .sort((a, b) => a.x - b.x)[0];
        const targetY = targetToken ? targetToken.y : 50;
        const next = prev + (targetY - prev) * 0.14;
        playerYRef.current = next;
        return next;
      });

      rafRef.current = window.requestAnimationFrame(loop);
    };

    rafRef.current = window.requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [active]);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = gameRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const next = Math.max(8, Math.min(92, y));
    setPlayerY(next);
    playerYRef.current = next;
    userControlUntilRef.current = performance.now() + 2400;
  };

  return (
    <div className="flex h-full w-full flex-col rounded-2xl border border-[#d4c3be]/60 bg-white/60 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#52372d]">软装跑酷（自动进行）</p>
          <p className="text-xs text-[#504440]">收集有用软装，避开杂物。你可移动鼠标接管角色。</p>
        </div>
        <div className="text-right text-xs text-[#504440]">
          <p>剩余 {timeLeft}s</p>
          <p>得分 {score}</p>
          <p>连击 x{combo}</p>
        </div>
      </div>

      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-xs text-[#504440]">
          <span>购物指南生成进度</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#ebe1d3]">
          <motion.div
            className="h-full rounded-full bg-[#8f4d2c]"
            animate={{ width: `${Math.max(6, Math.min(100, progress))}%` }}
            transition={{ type: 'spring', stiffness: 90, damping: 16 }}
          />
        </div>
      </div>

      <div
        ref={gameRef}
        onPointerMove={handlePointerMove}
        className="relative flex-1 overflow-hidden rounded-2xl border border-[#d4c3be]/45 bg-gradient-to-b from-[#fff8f2] via-[#fcf2e4] to-[#f1e7d9]"
      >
        <div className="pointer-events-none absolute -left-14 top-6 h-24 w-24 rounded-full bg-[#ffdbcc]/50 blur-2xl" />
        <div className="pointer-events-none absolute right-2 top-16 h-20 w-20 rounded-full bg-[#e8c1b3]/45 blur-2xl" />

        {tokens.map((token) => {
          const meta = TOKEN_META[token.kind];
          return (
            <div
              key={token.id}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${meta.className}`}
              style={{
                left: `${token.x}%`,
                top: `${token.y}%`,
                transform: `translate(-50%, -50%) rotate(${token.rotate}deg)`,
              }}
            >
              {meta.label}
            </div>
          );
        })}

        <div
          className="absolute left-[14%] h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#8f4d2c]/35 bg-[#8f4d2c]/15"
          style={{ top: `${playerY}%` }}
        >
          <div className="flex h-full items-center justify-center text-sm font-bold text-[#52372d]">
            住
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id') || '';
  const debugParamEnabled = searchParams.get('debug') === '1';

  const [stored, setStored] = useState<StoredResult | null>(null);
  const [summary, setSummary] = useState(defaultSummary);
  const [items, setItems] = useState<GuideItem[]>([]);
  const [itemsBoardImageUrl, setItemsBoardImageUrl] = useState('');
  const [extractedBoardStatus, setExtractedBoardStatus] = useState('');
  const [fallbackReason, setFallbackReason] = useState('');
  const [boardDebug, setBoardDebug] = useState<GuideResponse['extractedBoardDebug'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideProgress, setGuideProgress] = useState(0);
  const [error, setError] = useState('');

  const [filter, setFilter] = useState<FilterKey>('all');
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [previewItemId, setPreviewItemId] = useState<number | null>(null);
  const [showDebug, setShowDebug] = useState(debugParamEnabled || process.env.NODE_ENV !== 'production');

  useEffect(() => {
    if (debugParamEnabled) {
      setShowDebug(true);
    }
  }, [debugParamEnabled]);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        if (id) {
          const result = await loadResult(id);
          if (mounted && result) {
            setStored(result);
            setLoading(false);
            return;
          }
        }

        if (typeof window !== 'undefined') {
          const raw = sessionStorage.getItem('nookai_result_image');
          if (raw) {
            const parsed = JSON.parse(raw) as StoredResult;
            if (mounted) {
              setStored(parsed);
              setLoading(false);
              return;
            }
          }
        }

        if (mounted) {
          setLoading(false);
        }
      } catch {
        if (mounted) {
          setLoading(false);
          setError('结果读取失败，请返回重试');
        }
      }
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!stored?.generated) return;
    const current = stored;

    let cancelled = false;

    async function fetchGuide() {
      setGuideLoading(true);
      setGuideProgress(8);
      setError('');

      try {
        const afterForGuide = await shrinkGuideImageDataUrl(current.generated, 1280, 0.82);
        let response: Response | null = null;
        let data: GuideResponse = {};
        let lastError = '购物指南生成失败';

        for (let attempt = 1; attempt <= 2; attempt += 1) {
          const controller = new AbortController();
          const timer = window.setTimeout(() => controller.abort(), 55000);

          try {
            response = await fetch('/api/explainer', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                // Keep payload lean to avoid browser/network "Failed to fetch" on large bodies.
                // Only after image is required for the shopping-guide extraction step.
                afterImage: afterForGuide,
                theme: current.theme || '日式原木风',
                provider: current.provider === 'nanobanana' || current.provider === 'gemini' ? current.provider : undefined,
              }),
              signal: controller.signal,
            });

            data = (await response.json().catch(() => ({}))) as GuideResponse;
            if (response.ok) break;
            lastError = data.error || `购物指南生成失败（第 ${attempt} 次）`;
          } catch (err) {
            const raw = err instanceof Error ? err.message : '网络异常';
            lastError =
              raw.includes('Failed to fetch') || raw.includes('aborted')
                ? '网络波动，已切换为本地购物建议'
                : raw;
          } finally {
            window.clearTimeout(timer);
          }

          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
          }
        }

        if (!response?.ok) {
          throw new Error(lastError);
        }

        if (!cancelled) {
          const normalized = normalizeItems(data.items);
          setItems(normalized);
          setSummary(data.summary?.trim() || defaultSummary);
          setItemsBoardImageUrl(data.itemsBoardImageUrl || '');
          setExtractedBoardStatus(data.extractedBoardStatus || '');
          setFallbackReason(data.fallbackReason || '');
          setBoardDebug(data.extractedBoardDebug || null);
          setGuideProgress(100);
          setError('');
        }
      } catch {
        if (!cancelled) {
          const fallback = getFallbackItems();
          setItems(fallback);
          setSummary(current.suggestions || defaultSummary);
          setItemsBoardImageUrl('');
          setExtractedBoardStatus('request_failed');
          setFallbackReason('request_failed');
          setBoardDebug({
            status: 'request_failed',
            thumbnailSource: 'main_image_fallback',
            failureCode: 'request_failed',
            failureReason: 'explainer request failed before extracted board became available',
            fallbackReason: 'request_failed',
          });
          setError('');
          setGuideProgress(100);
        }
      } finally {
        if (!cancelled) setGuideLoading(false);
      }
    }

    fetchGuide();

    return () => {
      cancelled = true;
    };
  }, [stored]);

  useEffect(() => {
    if (!guideLoading) return;

    const timer = window.setInterval(() => {
      setGuideProgress((prev) => Math.min(95, prev + 1 + Math.random() * 4));
    }, 900);

    return () => {
      window.clearInterval(timer);
    };
  }, [guideLoading]);

  const grouped = useMemo(() => {
    const map = new Map<Category, GuideItem[]>();
    for (const category of CATEGORY_ORDER) {
      map.set(category, []);
    }

    for (const item of items) {
      if (!itemMatchesFilter(item, filter)) continue;
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    }

    return map;
  }, [items, filter]);

  const allVisibleItems = useMemo(() => {
    const list: GuideItem[] = [];
    for (const category of CATEGORY_ORDER) {
      list.push(...(grouped.get(category) || []));
    }
    return list;
  }, [grouped]);

  const selectedItems = useMemo(() => items.filter((item) => addedIds.has(item.id)), [items, addedIds]);

  const budget = useMemo(() => {
    const min = selectedItems.reduce((sum, item) => sum + item.priceMin * item.quantity, 0);
    const max = selectedItems.reduce((sum, item) => sum + item.priceMax * item.quantity, 0);
    return { min, max };
  }, [selectedItems]);

  const beforeImage = stored?.original || '';
  const afterImage = stored?.generated || '';
  const thumbnailSource =
    (boardDebug?.thumbnailSource as 'extracted_board' | 'main_image_fallback' | undefined) ||
    (itemsBoardImageUrl ? 'extracted_board' : 'main_image_fallback');

  const activePreviewItem = useMemo(() => items.find((item) => item.id === previewItemId) || null, [items, previewItemId]);

  const toggleAdd = (idValue: number) => {
    setAddedIds((prev) => {
      const next = new Set(prev);
      if (next.has(idValue)) {
        next.delete(idValue);
      } else {
        next.add(idValue);
      }
      return next;
    });
  };

  const addAllVisible = () => {
    setAddedIds((prev) => {
      const next = new Set(prev);
      for (const item of allVisibleItems) {
        next.add(item.id);
      }
      return next;
    });
  };

  const handleCopy = async () => {
    const target = selectedItems.length > 0 ? selectedItems : allVisibleItems;
    if (target.length === 0) return;

    const content = [
      'NookAI 改造购物清单',
      '',
      ...target.map((item) => {
        return `${item.name}\n- 分类：${CATEGORY_LABEL[item.category]}\n- 价格：${item.priceRange}\n- 数量：x${item.quantity}\n- 摆放：${item.placement}\n- 必要程度：${NECESSITY_LABEL[item.necessity]}\n`;
      }),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(content);
    } catch {
      setError('复制失败，请手动复制');
    }
  };

  const handleExport = () => {
    const target = selectedItems.length > 0 ? selectedItems : allVisibleItems;
    if (target.length === 0) return;

    const rows = [
      '分类,名称,数量,价格区间,摆放位置,必要程度',
      ...target.map((item) => `${CATEGORY_LABEL[item.category]},${item.name},${item.quantity},${item.priceRange},${item.placement},${NECESSITY_LABEL[item.necessity]}`),
    ];

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nookai-shopping-list.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fff8f2] text-[#1f1b13]">
        <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-6">
          <div className="rounded-3xl border border-[#ebe1d3]/60 bg-white px-8 py-6 text-sm text-[#504440]">正在加载结果页...</div>
        </div>
      </div>
    );
  }

  if (!stored || !beforeImage || !afterImage) {
    return (
      <div className="min-h-screen bg-[#fff8f2] text-[#1f1b13]">
        <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
          <h1 className="text-3xl font-bold text-[#52372d]">未找到改造结果</h1>
          <p className="text-sm text-[#504440]">请返回首页重新上传照片并生成。</p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="rounded-2xl bg-[#52372d] px-8 py-3 font-bold text-white shadow-lg shadow-[#52372d]/20"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fff8f2] pb-24 text-[#1f1b13]">
      <header className="fixed top-0 z-50 w-full bg-[#fff8f2]/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div className="text-2xl font-bold tracking-tight text-[#52372d]">NookAI</div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowDebug((prev) => !prev)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                showDebug
                  ? 'border-[#8f4d2c] bg-[#8f4d2c] text-white'
                  : 'border-[#d4c3be] bg-white/70 text-[#52372d] hover:border-[#8f4d2c]'
              }`}
            >
              <Bug size={14} />
              {showDebug ? '隐藏调试' : '调试信息'}
            </button>
            <button className="text-[#52372d]/70 transition-opacity hover:opacity-80">
              <Share2 size={20} />
            </button>
            <button className="text-[#52372d] transition-opacity hover:opacity-80">
              <UserCircle2 size={22} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 pb-16 pt-28">
        <div className="mb-6 flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-[#52372d]">改造方案已就绪</h1>
          <p className="text-sm leading-relaxed text-[#504440]">{summary || defaultSummary}</p>
          {guideLoading ? <p className="text-xs text-[#8f4d2c]">正在生成购物指南... {Math.round(guideProgress)}%</p> : null}
          {error ? <p className="text-xs text-[#ba1a1a]">{error}</p> : null}
        </div>

        {showDebug ? (
          <div className="mb-6 rounded-2xl border border-[#d4c3be]/60 bg-white/70 p-4 text-xs text-[#504440]">
            <div className="grid gap-2 md:grid-cols-2">
              <p>当前缩略图来源：<span className="font-semibold text-[#52372d]">{thumbnailSource}</span></p>
              <p>extracted board 状态：<span className="font-semibold text-[#52372d]">{extractedBoardStatus || boardDebug?.status || 'unknown'}</span></p>
              <p>extracted board 是否存在：<span className="font-semibold text-[#52372d]">{itemsBoardImageUrl ? '是' : '否'}</span></p>
              <p>fallback 原因：<span className="font-semibold text-[#52372d]">{fallbackReason || boardDebug?.fallbackReason || 'none'}</span></p>
              <p>原始图片类型/长度：<span className="font-semibold text-[#52372d]">{boardDebug?.rawImageKind || 'none'} / {boardDebug?.rawImageLength || 0}</span></p>
              <p>清洗后图片类型/长度：<span className="font-semibold text-[#52372d]">{boardDebug?.cleanedImageKind || 'none'} / {boardDebug?.cleanedImageLength || 0}</span></p>
              <p>有效性检测：<span className="font-semibold text-[#52372d]">{boardDebug?.validation?.checked ? (boardDebug?.validation?.valid ? 'valid' : 'invalid') : 'unchecked'}</span></p>
              <p>失败分类：<span className="font-semibold text-[#52372d]">{boardDebug?.validation?.failureCode || boardDebug?.failureCode || 'none'}</span></p>
              <p>检测到文字：<span className="font-semibold text-[#52372d]">{boardDebug?.validation?.hasText ? '是' : '否'}</span></p>
              <p>检测到框线/网格：<span className="font-semibold text-[#52372d]">{boardDebug?.validation?.hasGridOrFrames ? '是' : '否'}</span></p>
              <p>白底评分：<span className="font-semibold text-[#52372d]">{typeof boardDebug?.validation?.whiteBackgroundScore === 'number' ? boardDebug.validation.whiteBackgroundScore.toFixed(2) : '0.00'}</span></p>
              <p>原始图片地址：<span className="font-semibold break-all text-[#52372d]">{boardDebug?.rawImageRef || 'none'}</span></p>
            </div>
            <p className="mt-2 break-all">检测原因：<span className="font-semibold text-[#52372d]">{boardDebug?.validation?.reasons?.join(' | ') || boardDebug?.failureReason || 'none'}</span></p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <section className="space-y-6 lg:col-span-7">
            <BeforeAfterSlider before={beforeImage} after={afterImage} />

            <div className="flex items-center justify-between rounded-2xl border border-[#ebe1d3]/50 bg-[#fcf2e4] p-6">
              <div className="space-y-1">
                <p className="text-sm font-medium tracking-wide text-[#8f4d2c]">方案概览 / OVERVIEW</p>
                <h2 className="text-xl font-bold text-[#52372d]">风格：{stored.theme || '日式原木风'}</h2>
              </div>
              <div className="text-right">
                <p className="text-sm text-[#504440]">预计预算</p>
                <p className="text-2xl font-bold text-[#52372d]">
                  {budget.max > 0 ? `¥${budget.min}-${budget.max}` : '¥1500-2500'}
                </p>
              </div>
            </div>
          </section>

          <aside className="lg:col-span-5 lg:sticky lg:top-24">
            <div className="flex h-auto flex-col overflow-hidden rounded-3xl border border-[#ebe1d3]/40 bg-[#f1e7d9] shadow-sm lg:h-[calc(100vh-160px)]">
              <div className="space-y-4 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#52372d]">改造购物清单</h3>
                    <p className="text-xs font-medium text-[#504440]">SHOPPING GUIDE</p>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs text-[#504440]">已加入 {selectedItems.length} 件</span>
                    <span className="text-xl font-bold text-[#8f4d2c]">{formatBudget(budget.min, budget.max)}</span>
                  </div>
                </div>

                <div className="flex gap-2 rounded-xl bg-[#f7edde] p-1">
                  {FILTERS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setFilter(tab.key)}
                      disabled={guideLoading}
                      className={`flex-1 rounded-lg py-2 text-sm transition ${
                        filter === tab.key
                          ? 'bg-[#52372d] font-semibold text-white'
                          : guideLoading
                            ? 'cursor-not-allowed font-medium text-[#b8a8a2]'
                            : 'font-medium text-[#504440] hover:bg-[#ebe1d3]/60'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className={
                  guideLoading
                    ? 'flex min-h-0 flex-1 overflow-hidden px-6 pb-6'
                    : 'no-scrollbar flex-1 space-y-5 overflow-y-auto px-6 pb-6'
                }
              >
                {guideLoading ? (
                  <LoadingMiniGame active={guideLoading} progress={guideProgress} />
                ) : (
                  CATEGORY_ORDER.map((category) => {
                    const categoryItems = grouped.get(category) || [];
                    if (categoryItems.length === 0) return null;

                    return (
                      <div key={category} className="space-y-3">
                        <div className="rounded-xl border border-[#d4c3be]/60 bg-white/50 px-4 py-3">
                          <span className="text-sm font-bold text-[#52372d]">
                            {CATEGORY_LABEL[category]}
                            <span className="ml-2 rounded-full bg-[#ebe1d3] px-2 py-0.5 text-xs text-[#504440]">
                              {categoryItems.length}
                            </span>
                          </span>
                        </div>

                        <div className="space-y-3">
                          {categoryItems.map((item, indexInCategory) => {
                            const expandedItem = expandedItemId === item.id;
                            const added = addedIds.has(item.id);
                            const cell = getItemBoardCell(item, indexInCategory);

                            return (
                              <motion.div
                                key={item.id}
                                layout
                                transition={spring}
                                className="rounded-2xl border border-[#d4c3be]/45 bg-white/60 p-3"
                              >
                                <div className="flex gap-3">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewItemId(item.id)}
                                    className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-[#d4c3be]/30"
                                    aria-label={`预览 ${item.name}`}
                                  >
                                    {itemsBoardImageUrl ? (
                                      <BoardCellPreview boardUrl={itemsBoardImageUrl} cell={cell} className="h-full w-full" />
                                    ) : (
                                      <img
                                        src={afterImage}
                                        alt={item.name}
                                        className="h-full w-full object-cover"
                                        style={{ objectPosition: `${item.imageTarget?.x || 50}% ${item.imageTarget?.y || 50}%` }}
                                      />
                                    )}
                                  </button>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setExpandedItemId((prev) => (prev === item.id ? null : item.id))}
                                        className="min-w-0 flex-1 text-left"
                                      >
                                        <h4 className="text-base font-bold leading-tight text-[#1f1b13]">{item.name}</h4>
                                        <p className="mt-0.5 text-sm text-[#504440]">{item.priceRange}</p>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => toggleAdd(item.id)}
                                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition ${
                                          added
                                            ? 'border-[#8f4d2c] bg-[#8f4d2c] text-white'
                                            : 'border-[#d4c3be] bg-white text-[#52372d] hover:border-[#8f4d2c]'
                                        }`}
                                      >
                                        {added ? <Check size={14} /> : <Plus size={14} />}
                                        {added ? '已加入' : '加入'}
                                      </button>
                                    </div>

                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                          item.necessity === 'Must-have'
                                            ? 'bg-[#ffe2de] text-[#ad3b2f]'
                                            : item.necessity === 'Recommended'
                                              ? 'bg-[#fff0d8] text-[#9a6b16]'
                                              : 'bg-[#ebe1d3] text-[#504440]'
                                        }`}
                                      >
                                        {NECESSITY_LABEL[item.necessity]}
                                      </span>
                                      <span className="rounded-full bg-[#ebe1d3] px-2 py-0.5 text-[11px] text-[#504440]">
                                        数量 x{item.quantity}
                                      </span>
                                      {showDebug ? (
                                        <span className="rounded-full bg-[#e8ddd0] px-2 py-0.5 text-[11px] text-[#6d5547]">
                                          source: {thumbnailSource}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>

                                {expandedItem ? (
                                  <div className="mt-3 border-t border-[#d4c3be]/40 pt-3 text-sm text-[#504440]">
                                    <p>
                                      <span className="font-semibold text-[#52372d]">摆放：</span>
                                      {item.placement}
                                    </p>
                                    <p className="mt-1">{item.reason}</p>
                                  </div>
                                ) : null}
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-[#d4c3be]/40 bg-gradient-to-t from-[#f1e7d9] via-[#f1e7d9]/95 to-transparent p-6">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={guideLoading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-bold text-[#52372d] transition-colors hover:bg-[#fff8f2] disabled:cursor-not-allowed disabled:text-[#b8a8a2]"
                  >
                    <Copy size={16} />
                    复制清单
                  </button>
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={guideLoading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-bold text-[#52372d] transition-colors hover:bg-[#fff8f2] disabled:cursor-not-allowed disabled:text-[#b8a8a2]"
                  >
                    <Download size={16} />
                    导出清单
                  </button>
                </div>

                <button
                  type="button"
                  onClick={addAllVisible}
                  disabled={guideLoading}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#52372d] py-4 text-sm font-bold text-white shadow-xl shadow-[#52372d]/10 transition-all hover:bg-[#6b4e43] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#b8a8a2] disabled:shadow-none"
                >
                  <ShoppingCart size={18} />
                  一键加入购物车
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-[24px] border-t border-[#ebe1d3]/30 bg-[#fff8f2] px-4 pb-6 pt-3 shadow-[0_-4px_24px_rgba(82,55,45,0.04)] md:hidden">
        {['灵感', '改造', '方案', '我的'].map((label, index) => {
          const active = label === '改造';
          return (
            <a
              key={label}
              className={`flex flex-col items-center justify-center px-5 py-2 ${active ? 'rounded-2xl bg-[#6b4e43] text-[#fff8f2]' : 'text-[#52372d]/60'}`}
              href="#"
            >
              {index === 0 ? <Sparkles className="mb-1 h-4 w-4" /> : null}
              {index === 1 ? <Wand2 className="mb-1 h-4 w-4" /> : null}
              {index === 2 ? <Layers3 className="mb-1 h-4 w-4" /> : null}
              {index === 3 ? <UserCircle2 className="mb-1 h-4 w-4" /> : null}
              <span className="text-[11px] font-medium tracking-wider">{label}</span>
            </a>
          );
        })}
      </nav>

      {activePreviewItem && itemsBoardImageUrl ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#1f1b13]/75 px-6 backdrop-blur-sm" onClick={() => setPreviewItemId(null)}>
          <div className="w-full max-w-xl rounded-3xl bg-white p-4" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between px-2">
              <h4 className="text-base font-bold text-[#52372d]">{activePreviewItem.name}</h4>
              <button
                type="button"
                onClick={() => setPreviewItemId(null)}
                className="rounded-full border border-[#d4c3be] px-3 py-1 text-xs text-[#504440]"
              >
                关闭
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#ebe1d3] bg-[#f7edde]">
              <BoardCellPreview
                boardUrl={itemsBoardImageUrl}
                cell={getItemBoardCell(activePreviewItem, items.findIndex((item) => item.id === activePreviewItem.id))}
                className="h-[420px] w-full"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#fff8f2] text-[#1f1b13]">
          <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-6">
            <div className="rounded-3xl border border-[#ebe1d3]/60 bg-white px-8 py-6 text-sm text-[#504440]">
              正在加载结果页...
            </div>
          </div>
        </div>
      }
    >
      <ResultPageContent />
    </Suspense>
  );
}
