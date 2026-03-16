'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Cat, Sparkles, Upload, Wand2 } from 'lucide-react';
import { saveResult } from './lib/imageStore';

const themes = ['日式原木风', '奶油温柔风', '现代极简风', '文艺复古风', '绿植自然风'];
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
  const [structureLock, setStructureLock] = useState(0.5);
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
        body: JSON.stringify({ image: imageBase64, theme, promptStrength: structureLock }),
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
    <div className="min-h-screen bg-[#f7f3ee] text-stone-900">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-12 px-4 pb-20 pt-12 md:px-10">
        <header className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-white shadow-[0_10px_30px_rgba(17,24,39,0.08)]">
              <Cat className="text-amber-600" size={24} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-stone-400">NookAI Studio</p>
              <h1 className="font-display text-3xl text-stone-800 md:text-4xl">
                让出租屋也有家的温度
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs text-stone-600 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
            <Sparkles size={14} className="text-amber-500" />
            三步生成氛围空间
          </div>
        </header>

        <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="flex flex-col gap-8">
            <div className="rounded-[16px] bg-white/90 p-8 shadow-[0_18px_40px_rgba(17,24,39,0.08)]">
              <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Preview</p>
              <h2 className="font-display text-3xl text-stone-800 md:text-4xl">
                一张照片，焕新氛围与质感
              </h2>
              <p className="mt-4 text-sm text-stone-600 md:text-base">
                上传你的空间照片，选择风格，软装与灯光将被温柔升级。
              </p>
            </div>

            <button
              type="button"
              onClick={handlePick}
              className="group w-full rounded-[16px] bg-white/95 p-6 text-left shadow-[0_18px_40px_rgba(17,24,39,0.08)] transition hover:-translate-y-0.5"
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
              <div className="mt-4 overflow-hidden rounded-[16px] bg-[#f4eee7]">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="上传预览"
                    className="block h-auto w-full object-contain"
                  />
                ) : (
                  <div className="flex h-[360px] items-center justify-center text-center text-sm text-stone-500">
                    喵~ 把你的出租屋照片交给我吧！
                  </div>
                )}
              </div>
              <p className="mt-4 text-xs text-stone-400">
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

          <div className="flex flex-col gap-8">
            <section className="rounded-[16px] bg-white/90 p-6 shadow-[0_18px_40px_rgba(17,24,39,0.08)]">
              <h2 className="text-xs uppercase tracking-[0.2em] text-stone-400">Style</h2>
              <p className="mt-2 text-sm text-stone-600">选择你想要的风格气质</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
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
                      className={`flex items-center justify-between rounded-[16px] px-4 py-3 text-sm font-medium shadow-[0_10px_24px_rgba(17,24,39,0.08)] transition-colors ${
                        active
                          ? 'bg-[#1c1c1c] text-[#f7f3ee]'
                          : 'bg-[#f7f3ee] text-stone-600'
                      }`}
                    >
                      {item}
                      <span
                        className={`h-2 w-2 rounded-full ${
                          active ? 'bg-amber-400' : 'bg-stone-300'
                        }`}
                      />
                    </motion.button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[16px] bg-white/90 p-6 shadow-[0_18px_40px_rgba(17,24,39,0.08)]">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-stone-400">
                <Wand2 size={14} className="text-amber-500" />
                Generate
              </div>
              <p className="mt-3 text-sm text-stone-600">
                仅升级软装材质与灯光，不改变房间结构与家具位置。
              </p>
              <div className="mt-5 rounded-[16px] bg-[#f7f3ee] px-4 py-4">
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>结构锁定强度</span>
                  <span className="font-semibold text-stone-700">{structureLock.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.45}
                  max={0.55}
                  step={0.01}
                  value={structureLock}
                  onChange={(event) => setStructureLock(Number(event.target.value))}
                  className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-amber-100 accent-amber-500"
                />
                <p className="mt-2 text-xs text-stone-400">
                  数值越低越保留原结构，越高越偏向风格重绘。
                </p>
              </div>
              <motion.button
                type="button"
                onClick={handleGenerate}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={spring}
                disabled={!previewUrl || isLoading}
                className={`mt-6 w-full rounded-[16px] px-6 py-3 text-sm font-semibold shadow-[0_16px_30px_rgba(17,24,39,0.12)] ${
                  previewUrl && !isLoading
                    ? 'bg-[#1c1c1c] text-[#f7f3ee]'
                    : 'bg-stone-200 text-stone-500'
                }`}
              >
                {previewUrl ? '开始生成效果图' : '请先上传照片'}
              </motion.button>
              {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
            </section>

            <section className="rounded-[16px] bg-white/90 p-6 shadow-[0_18px_40px_rgba(17,24,39,0.08)]">
              <h3 className="text-xs uppercase tracking-[0.2em] text-stone-400">Guidance</h3>
              <ul className="mt-4 space-y-2 text-sm text-stone-600">
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

        <section className="rounded-[16px] bg-white/90 p-8 shadow-[0_18px_40px_rgba(17,24,39,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Gallery</p>
              <h2 className="font-display text-2xl text-stone-800">结果展示区</h2>
              <p className="mt-2 text-sm text-stone-500">生成后会自动更新最新作品。</p>
            </div>
            <span className="rounded-full bg-[#f7f3ee] px-3 py-1 text-xs text-stone-500">
              自动同步
            </span>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((index) => {
              const showPreview = previewUrl && index === 0;
              return (
                <div
                  key={index}
                  className="overflow-hidden rounded-[16px] bg-[#f4eee7] shadow-[0_12px_24px_rgba(17,24,39,0.08)]"
                >
                  {showPreview ? (
                    <img
                      src={previewUrl}
                      alt="最新上传"
                      className="h-44 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-44 items-center justify-center text-xs text-stone-400">
                      等待生成
                    </div>
                  )}
                  <div className="flex items-center justify-between px-4 py-3 text-xs text-stone-500">
                    <span>{showPreview ? '最新上传' : `No.${index + 1}`}</span>
                    <span>{showPreview ? theme : '即将出现'}</span>
                  </div>
                </div>
              );
            })}
          </div>
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
