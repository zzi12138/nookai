'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Cat, Sparkles, Upload, Wand2 } from 'lucide-react';
import { saveResult } from './lib/imageStore';

const themes = ['日式原木风', '法式复古', '极简奶油', '奶油原木', '北欧清新', '侘寂风'];
const loadingMessages = [
  '猫咪包工头正在测量房间...',
  '正在为你挑选原木风家具...',
  '魔法马上完成喵~',
];

const spring = { type: 'spring', stiffness: 260, damping: 18 } as const;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result);
    };
    reader.onerror = () => reject(new Error('图片读取失败，请重试'));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBase64(dataUrl: string) {
  return dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
}

export default function Page() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState(themes[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [fileName, setFileName] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoading) {
      setLoadingIndex(0);
      return;
    }
    const id = setInterval(() => {
      setLoadingIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2000);
    return () => clearInterval(id);
  }, [isLoading]);

  const handlePick = () => {
    if (isLoading) return;
    inputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setFileName(file.name);

    try {
      const dataUrl = await fileToDataUrl(file);
      setPreviewUrl(dataUrl);
      setImageBase64(dataUrlToBase64(dataUrl));
    } catch (err) {
      const message = err instanceof Error ? err.message : '图片读取失败，请稍后再试';
      setError(message);
    }
  };

  const handleGenerate = async () => {
    if (!imageBase64 || isLoading) return;
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64, theme }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || '生成失败，请稍后再试');
      }

      const data = await response.json();
      if (!data?.imageUrl) {
        throw new Error('未获取到效果图地址');
      }

      try {
        const storedId = await saveResult({
          original: previewUrl,
          generated: data.imageUrl,
          theme,
        });
        router.push(`/result?id=${encodeURIComponent(storedId)}`);
        return;
      } catch {
        // Fallback to sessionStorage if IndexedDB is unavailable.
        try {
          sessionStorage.setItem(
            'nookai_result_image',
            JSON.stringify({ original: previewUrl, generated: data.imageUrl, theme })
          );
        } catch {
          // Ignore storage errors and continue to navigation.
        }
      }
      router.push('/result');
    } catch (err) {
      const message = err instanceof Error ? err.message : '生成失败，请稍后再试';
      setError(message);
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#f6f1ea] text-stone-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 right-0 h-[420px] w-[420px] rounded-full bg-amber-200/70 blur-3xl" />
        <div className="absolute bottom-[-140px] left-[-80px] h-[360px] w-[360px] rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="absolute left-1/3 top-1/4 h-[280px] w-[280px] rounded-full bg-rose-100/80 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen w-full flex-col gap-12 px-4 pb-16 pt-10 md:px-12 lg:px-16">
        <header className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-md">
              <Cat className="text-amber-600" size={26} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-stone-400">NookAI Studio</p>
              <h1 className="font-display text-2xl text-stone-800 md:text-3xl">
                让出租屋也有家的温度
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs text-stone-600 shadow-sm">
            <Sparkles size={14} className="text-amber-500" />
            三步生成氛围空间
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-6">
            <div className="rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-xl">
              <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Preview Stage</p>
              <h2 className="font-display text-3xl text-stone-800 md:text-4xl">
                一张照片，三分钟焕新房间氛围
              </h2>
              <p className="mt-4 text-sm text-stone-600 md:text-base">
                上传你的空间照片，选择风格，猫咪包工头马上进行软装与灯光的氛围升级。
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-xs text-stone-500">
                <span className="rounded-full bg-amber-100/60 px-3 py-1">上传照片</span>
                <span className="rounded-full bg-emerald-100/60 px-3 py-1">选择风格</span>
                <span className="rounded-full bg-rose-100/60 px-3 py-1">生成效果图</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePick}
              className="group relative w-full overflow-hidden rounded-[28px] border border-amber-100 bg-white/90 p-5 text-left shadow-lg transition hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between text-sm text-stone-500">
                <span className="flex items-center gap-2">
                  <Upload size={16} className="text-amber-500" />
                  上传与预览
                </span>
                <span className="text-xs text-amber-600">
                  {fileName ? `已选择：${fileName}` : '点击上传'}
                </span>
              </div>
              <div className="mt-4 overflow-hidden rounded-2xl border border-amber-100 bg-[#f7f2eb]">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="上传预览"
                    className="block h-auto w-full object-contain"
                  />
                ) : (
                  <div className="flex h-72 items-center justify-center text-center text-sm text-stone-500 md:h-[380px]">
                    喵~ 把你的出租屋照片交给我吧！
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs text-stone-500">
                支持 JPG / PNG，建议日光或暖光环境拍摄。
              </p>
            </button>

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="flex flex-col gap-6">
            <section className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-lg">
              <h2 className="text-xs uppercase tracking-[0.2em] text-stone-400">Style Bar</h2>
              <p className="mt-2 text-sm text-stone-600">选择你想要的风格气质</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {themes.map((item) => {
                  const active = item === theme;
                  return (
                    <motion.button
                      key={item}
                      type="button"
                      onClick={() => setTheme(item)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={spring}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm transition-colors ${
                        active
                          ? 'border-amber-300 bg-amber-200/80 text-stone-800'
                          : 'border-amber-100 bg-white text-stone-600'
                      }`}
                    >
                      {item}
                      <span
                        className={`h-3 w-3 rounded-full ${
                          active ? 'bg-amber-500' : 'bg-stone-300'
                        }`}
                      />
                    </motion.button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-lg">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-stone-400">
                <Wand2 size={14} className="text-amber-500" />
                Generate
              </div>
              <p className="mt-3 text-sm text-stone-600">
                猫咪包工头将根据照片与风格自动调整灯光、软装与色调。
              </p>
              <motion.button
                type="button"
                onClick={handleGenerate}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={spring}
                disabled={!previewUrl || isLoading}
                className={`mt-5 w-full rounded-2xl px-6 py-3 text-sm font-semibold shadow-lg ${
                  previewUrl && !isLoading
                    ? 'bg-stone-900 text-amber-100'
                    : 'bg-stone-200 text-stone-500'
                }`}
              >
                {previewUrl ? '开始生成效果图' : '请先上传照片'}
              </motion.button>
              {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
            </section>

            <section className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-lg">
              <h3 className="text-xs uppercase tracking-[0.2em] text-stone-400">Checklist</h3>
              <ul className="mt-3 space-y-2 text-sm text-stone-600">
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  选择清晰、无遮挡的空间照片
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  选定风格后再生成更稳定
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-rose-400" />
                  生成后可在结果页对比原图
                </li>
              </ul>
            </section>
          </div>
        </section>

        <section className="rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Flow</p>
              <h2 className="font-display text-2xl text-stone-800">上传 → 选择风格 → 生成</h2>
            </div>
            <span className="rounded-full bg-amber-100/70 px-3 py-1 text-xs text-stone-600">
              生成后将跳转结果页
            </span>
          </div>
          <p className="mt-4 text-sm text-stone-600">
            点击左侧预览框上传照片，选择风格后再生成，保证结果更稳定且符合软装改造目标。
          </p>
        </section>
      </div>

      <AnimatePresence>
        {isLoading ? (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-stone-900/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              animate={{ y: [0, -14, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Cat size={48} className="text-amber-300" />
            </motion.div>
            <AnimatePresence mode="wait">
              <motion.p
                key={loadingIndex}
                className="mt-5 text-sm text-white/90"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
              >
                {loadingMessages[loadingIndex]}
              </motion.p>
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
