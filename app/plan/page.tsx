'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Copy, RefreshCw, Save } from 'lucide-react';
import { loadResult, type StoredResult } from '../lib/imageStore';

type GuideItem = {
  marker: '①' | '②' | '③' | '④';
  title: string;
  buy: string;
  price: string;
  placement: string;
  why: string;
};

const spring = { type: 'spring', stiffness: 120, damping: 20 } as const;

const markerFallback = [
  { marker: '①', left: '24%', top: '62%' },
  { marker: '②', left: '52%', top: '72%' },
  { marker: '③', left: '64%', top: '32%' },
  { marker: '④', left: '78%', top: '56%' },
] as const;

function buildGuide(theme: string): GuideItem[] {
  const styleHints =
    theme.includes('原木') || theme.toLowerCase().includes('japandi')
      ? ['原木风', '暖白光', '亚麻材质']
      : theme.includes('奶油')
        ? ['奶油风', '暖白光', '绒感']
        : theme.includes('复古')
          ? ['复古', '暖黄光', '木质感']
          : ['简约', '暖白光', '低饱和'];

  return [
    {
      marker: '①',
      title: '暖光落地灯',
      buy: `买一盏细杆落地灯（关键词：${styleHints[1]} / ${styleHints[0]}）`,
      price: '¥159-399',
      placement: '放在沙发旁边，灯光从侧后方照。',
      why: '这是最快让房间有“氛围感”的一步。',
    },
    {
      marker: '②',
      title: '浅色地毯',
      buy: `选短绒或平织地毯（关键词：${styleHints[0]} / 低饱和）`,
      price: '¥199-499',
      placement: '铺在沙发前或床尾，压住家具前脚。',
      why: '它能立刻把区域分清楚，空间看起来更整。',
    },
    {
      marker: '③',
      title: '简约挂画',
      buy: `选 1-2 幅可移除挂画（关键词：${styleHints[0]} / 简约）`,
      price: '¥69-199',
      placement: '挂在沙发或床头中间位置。',
      why: '补一个视觉焦点，房间不会显得空。',
    },
    {
      marker: '④',
      title: '中型绿植',
      buy: '选好养护绿植（龟背竹 / 虎尾兰 / 绿萝）',
      price: '¥79-259',
      placement: '放在窗边或角落过渡位，不挡动线。',
      why: '增加自然感，空间会更有生气。',
    },
  ];
}

export default function PlanPage() {
  const router = useRouter();

  const [originalUrl, setOriginalUrl] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [explainerImage, setExplainerImage] = useState('');
  const [theme, setTheme] = useState('日式原木风');
  const [notice, setNotice] = useState('');
  const [isGeneratingExplainer, setIsGeneratingExplainer] = useState(false);
  const [explainerError, setExplainerError] = useState('');

  const guide = useMemo(() => buildGuide(theme), [theme]);

  const summaryText = useMemo(() => {
    return '这个房间之所以看起来更舒服，主要是因为杂乱减少了、光线变暖了、软装更统一了。你不需要大改硬装，只要按顺序做几件小事，就能接近效果图。';
  }, []);

  const loadSourceData = async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (id) {
      try {
        const data = await loadResult(id);
        if (data) {
          setOriginalUrl(data.original || '');
          setGeneratedUrl(data.generated || '');
          setTheme(data.theme || '日式原木风');
          setExplainerImage(data.explainerImage || '');
          return true;
        }
      } catch {
        // fallback
      }
    }

    const cached = sessionStorage.getItem('nookai_result_image');
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Partial<StoredResult>;
        setOriginalUrl(parsed.original || '');
        setGeneratedUrl(parsed.generated || '');
        setTheme(parsed.theme || '日式原木风');
        setExplainerImage(parsed.explainerImage || '');
        return true;
      } catch {
        // ignore
      }
    }

    return false;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    loadSourceData();
  }, []);

  useEffect(() => {
    if (!generatedUrl || explainerImage || isGeneratingExplainer) return;

    let cancelled = false;
    const run = async () => {
      setIsGeneratingExplainer(true);
      setExplainerError('');
      try {
        const response = await fetch('/api/explainer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: generatedUrl, theme }),
        });

        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.explainerImageUrl) {
          throw new Error(data?.error || '生成讲解图失败');
        }
        if (cancelled) return;
        setExplainerImage(data.explainerImageUrl);

        const cached = sessionStorage.getItem('nookai_result_image');
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as Partial<StoredResult>;
            sessionStorage.setItem(
              'nookai_result_image',
              JSON.stringify({ ...parsed, explainerImage: data.explainerImageUrl })
            );
          } catch {
            // ignore cache update error
          }
        }
      } catch (err) {
        if (!cancelled) {
          setExplainerError(err instanceof Error ? err.message : '生成讲解图失败');
        }
      } finally {
        if (!cancelled) setIsGeneratingExplainer(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [generatedUrl, explainerImage, isGeneratingExplainer, theme]);

  const handleCopy = async () => {
    const lines = guide.map(
      (item) =>
        `${item.marker} ${item.title}\n买什么：${item.buy}\n预算：${item.price}\n放哪里：${item.placement}\n为什么：${item.why}`
    );
    try {
      await navigator.clipboard.writeText(lines.join('\n\n'));
      setNotice('执行清单已复制');
    } catch {
      setNotice('复制失败，请重试');
    }
  };

  const handleSave = () => {
    try {
      localStorage.setItem(
        'nookai_smart_guide',
        JSON.stringify({
          theme,
          guide,
          generatedUrl,
          explainerImage,
          updatedAt: Date.now(),
        })
      );
      setNotice('方案已保存');
    } catch {
      setNotice('保存失败，请重试');
    }
  };

  if (!generatedUrl && !originalUrl) {
    return (
      <div className="min-h-screen bg-[#FDF9F1] px-4 py-12">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-10 text-center shadow-xl shadow-stone-200/40">
          <p className="text-sm text-stone-500">还没有可分析的结果图，请先完成生成。</p>
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
      <div className="mx-auto w-full max-w-6xl space-y-12">
        <motion.section
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={spring}
          className="rounded-3xl bg-white p-10 shadow-xl shadow-stone-200/40"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-stone-400">AI EXPLAINER</p>
          <h1 className="mt-3 text-3xl font-semibold text-stone-900">AI改造指南</h1>
          <p className="mt-4 max-w-4xl text-sm leading-8 text-stone-600">{summaryText}</p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.03 }}
          className="grid gap-6 md:grid-cols-2"
        >
          <article className="rounded-3xl bg-white p-5 shadow-xl shadow-stone-200/40">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-stone-400">Before</p>
            <div className="overflow-hidden rounded-2xl bg-stone-100">
              <img
                src={originalUrl || generatedUrl}
                alt="原图"
                className="h-[280px] w-full object-contain"
              />
            </div>
          </article>

          <article className="rounded-3xl bg-white p-5 shadow-xl shadow-stone-200/40">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-stone-400">After</p>
            <div className="overflow-hidden rounded-2xl bg-stone-100">
              <img
                src={generatedUrl || originalUrl}
                alt="效果图"
                className="h-[280px] w-full object-contain"
              />
            </div>
          </article>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.06 }}
          className="rounded-3xl bg-white p-8 shadow-xl shadow-stone-200/40"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-stone-900">改造讲解图</h2>
            <p className="text-xs text-stone-400">看图就能知道改造重点</p>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-stone-100">
            {explainerImage ? (
              <img
                src={explainerImage}
                alt="改造讲解图"
                className="mx-auto h-[460px] w-full object-contain"
              />
            ) : (
              <div className="relative mx-auto h-[460px] w-full">
                <img
                  src={generatedUrl || originalUrl}
                  alt="讲解图生成中"
                  className="h-full w-full object-contain opacity-95"
                />
                {markerFallback.map((item) => (
                  <span
                    key={item.marker}
                    className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-sm font-semibold text-stone-800 shadow-md"
                    style={{ left: item.left, top: item.top }}
                  >
                    {item.marker}
                  </span>
                ))}
                {isGeneratingExplainer ? (
                  <div className="absolute inset-x-4 bottom-4 rounded-xl bg-white/90 px-3 py-2 text-center text-xs text-stone-500">
                    AI 正在生成讲解图...
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {explainerError ? (
            <p className="mt-3 text-sm text-amber-700">
              讲解图暂未生成成功，已先展示可执行标注版。({explainerError})
            </p>
          ) : null}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.09 }}
          className="rounded-3xl bg-white p-8 shadow-xl shadow-stone-200/40"
        >
          <h2 className="text-2xl font-semibold text-stone-900">编号执行指南</h2>
          <p className="mt-2 text-sm text-stone-500">照着 ①→④ 做，预算可控、难度低、效果稳定。</p>

          <div className="mt-6 space-y-4">
            {guide.map((item) => (
              <article
                key={item.marker}
                className="rounded-2xl border border-stone-100 bg-stone-50/70 p-5"
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-900 text-sm font-semibold text-white">
                    {item.marker}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-lg font-medium text-stone-900">{item.title}</h3>
                    <p className="text-sm text-stone-700">买什么：{item.buy}</p>
                    <p className="text-sm text-stone-600">价格：{item.price}</p>
                    <p className="text-sm text-stone-600">放哪里：{item.placement}</p>
                    <p className="text-sm text-stone-500">为什么：{item.why}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.12 }}
          className="rounded-3xl bg-white p-8 shadow-xl shadow-stone-200/40"
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
