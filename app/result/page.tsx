'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { RefreshCw, Save } from 'lucide-react';
import { loadResult, type StoredResult } from '../lib/imageStore';

const spring = { type: 'spring', stiffness: 120, damping: 20 } as const;

export default function ResultPage() {
  const router = useRouter();
  const sliderRef = useRef<HTMLDivElement>(null);

  const [originalUrl, setOriginalUrl] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [theme, setTheme] = useState('');
  const [evaluation, setEvaluation] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [comparePercent, setComparePercent] = useState(56);

  const hasImage = Boolean(generatedUrl || originalUrl);
  const canCompare = Boolean(generatedUrl && originalUrl);

  const updateCompareByX = (clientX: number) => {
    const el = sliderRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const raw = ((clientX - rect.left) / rect.width) * 100;
    setComparePercent(Math.min(100, Math.max(0, raw)));
  };

  const handleSave = () => {
    const target = generatedUrl || originalUrl;
    if (!target) return;

    const link = document.createElement('a');
    link.href = target;
    link.download = `nookai-result-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    let isActive = true;

    const hydrate = (data: Partial<StoredResult>) => {
      if (!isActive) return;
      setOriginalUrl(data.original || '');
      setGeneratedUrl(data.generated || '');
      setTheme(data.theme || '');
      setEvaluation(
        data.evaluation ||
          '空间原始采光基础不错，主要问题是软装层次不足，视觉重心偏散。'
      );
      setSuggestions(
        data.suggestions ||
          '建议优先补充暖色分层光源、织物材质与可移动收纳模块，保持预算友好同时提升氛围感。'
      );
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
          // Fallback to session cache.
        }
      }

      const cached = sessionStorage.getItem('nookai_result_image');
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Partial<StoredResult>;
          hydrate(parsed);
          return;
        } catch {
          // Fallback below.
        }
      }

      const img = params.get('img');
      if (img) {
        setGeneratedUrl(decodeURIComponent(img));
      }
    };

    load();
    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#FDF9F1] px-4 py-10 text-stone-800">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          transition={spring}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-stone-400">NOOKAI RESULT</p>
            <h1 className="mt-1 text-3xl font-semibold text-stone-900">你的租房改造方案</h1>
          </div>
          <p className="text-sm text-stone-500">{theme || '智能风格分析中'}</p>
        </motion.div>

        {hasImage ? (
          <div className="grid gap-8 lg:grid-cols-2">
            <motion.section
              initial={{ opacity: 0, y: 40, scale: 0.96, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              transition={spring}
              className="rounded-3xl bg-white p-5 shadow-xl shadow-stone-200/40"
            >
              <div className="mb-4 flex items-center justify-between text-xs text-stone-500">
                <span>Before</span>
                <span>After</span>
              </div>

              <div
                ref={sliderRef}
                className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-stone-100"
                onClick={(event) => updateCompareByX(event.clientX)}
              >
                <img
                  src={originalUrl || generatedUrl}
                  alt="Before"
                  className="absolute inset-0 h-full w-full object-contain"
                />

                <img
                  src={generatedUrl || originalUrl}
                  alt="After"
                  className="absolute inset-0 h-full w-full object-contain"
                  style={{
                    clipPath: canCompare
                      ? `inset(0 ${100 - comparePercent}% 0 0)`
                      : 'inset(0 0 0 0)',
                  }}
                />

                {canCompare ? (
                  <motion.div
                    drag="x"
                    dragElastic={0}
                    dragConstraints={sliderRef}
                    onDrag={(_, info) => updateCompareByX(info.point.x)}
                    onPointerDown={(event) => updateCompareByX(event.clientX)}
                    className="absolute inset-y-0 z-20 w-10 -translate-x-1/2 cursor-ew-resize"
                    style={{ left: `${comparePercent}%` }}
                  >
                    <div className="mx-auto h-full w-[2px] bg-white/90" />
                    <div className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-white/95 shadow-lg" />
                  </motion.div>
                ) : null}
              </div>

              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-stone-400">
                  <span>原图</span>
                  <span>擦除进度 {Math.round(comparePercent)}%</span>
                  <span>效果图</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={comparePercent}
                  disabled={!canCompare}
                  onChange={(event) => setComparePercent(Number(event.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-stone-200 accent-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </motion.section>

            <motion.aside
              initial={{ opacity: 0, y: 40, scale: 0.96, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              transition={spring}
              className="space-y-6"
            >
              <section className="rounded-3xl bg-white p-7 shadow-xl shadow-stone-200/40">
                <h2 className="text-xl font-semibold text-stone-900">AI Designer Review</h2>
                <div className="mt-6 space-y-6 text-sm leading-7 text-stone-600">
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-stone-400">
                      原风格评价
                    </p>
                    <p>{evaluation}</p>
                  </div>
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-stone-400">
                      装修建议
                    </p>
                    <p>{suggestions}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl bg-white p-6 shadow-xl shadow-stone-200/40">
                <div className="grid gap-3">
                  <motion.button
                    type="button"
                    onClick={handleSave}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    transition={spring}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white shadow-sm"
                  >
                    <Save size={16} />
                    保存
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => router.push('/')}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    transition={spring}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 hover:shadow-sm"
                  >
                    <RefreshCw size={16} />
                    重新生成
                  </motion.button>
                </div>
              </section>
            </motion.aside>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            transition={spring}
            className="rounded-3xl bg-white p-12 text-center shadow-xl shadow-stone-200/40"
          >
            <p className="text-sm text-stone-500">还没有可展示的效果图，请先返回首页生成。</p>
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              transition={spring}
              onClick={() => router.push('/')}
              className="mt-5 rounded-full bg-stone-900 px-6 py-3 text-sm text-white"
            >
              返回首页
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
