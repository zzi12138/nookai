'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Upload } from 'lucide-react';
import { saveResult } from './lib/imageStore';

const themes = ['Japandi', 'Cream Minimal', 'Vintage Warm', 'Nordic Light', 'Soft Loft'];
const loadingMessages = [
  'AI 正在分析房间结构...',
  '正在匹配最适合的软装风格...',
  '马上生成你的新空间...',
];

const spring = { type: 'spring', stiffness: 240, damping: 18 } as const;

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

async function resizeDataUrl(dataUrl: string, maxSize = 1280, quality = 0.85) {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const targetW = Math.round(img.width * scale);
      const targetH = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('图片读取失败，请重试'));
    img.src = dataUrl;
  });
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
      const resized = await resizeDataUrl(dataUrl, 1024, 0.8);
      setPreviewUrl(resized);
      setImageBase64(dataUrlToBase64(resized));
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
    <div className="min-h-screen bg-[#f6f0e8] text-stone-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[980px] flex-col gap-8 px-6 pb-20 pt-10">
        <header className="flex flex-wrap items-center justify-between gap-3 text-sm text-stone-500">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold text-stone-900">Nook</span>
            <span className="text-xs text-stone-500">租房软装 AI 工具</span>
          </div>
          <span className="text-xs text-stone-400">仅软装更新，不改硬装结构</span>
        </header>

        <section className="rounded-2xl border border-stone-200/70 bg-white/70 p-6 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              <motion.button
                type="button"
                onClick={handlePick}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                transition={spring}
                className="group flex h-[300px] w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-stone-300/80 bg-white/60 text-stone-400"
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="上传预览"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-sm">
                    <Upload size={18} className="text-stone-400" />
                    <span>点击上传房间照片</span>
                  </div>
                )}
              </motion.button>
              <div className="flex items-center justify-between text-xs text-stone-400">
                <span>{fileName ? `文件：${fileName}` : '未选择文件'}</span>
                <span>JPG / PNG</span>
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Style</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {themes.map((item) => {
                    const active = item === theme;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setTheme(item)}
                        className={`rounded-full border px-4 py-2 text-sm transition ${
                          active
                            ? 'border-stone-900 bg-stone-900 text-amber-100'
                            : 'border-stone-200 bg-white/80 text-stone-600'
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <motion.button
                  type="button"
                  onClick={handleGenerate}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={spring}
                  disabled={!previewUrl || isLoading}
                  className={`w-full rounded-2xl px-5 py-3 text-sm font-semibold shadow-sm ${
                    previewUrl && !isLoading
                      ? 'bg-stone-900 text-amber-100'
                      : 'bg-stone-200 text-stone-500'
                  }`}
                >
                  {previewUrl ? '生成效果图' : '请先上传'}
                </motion.button>
                <p className="text-xs text-stone-400">只更换软装与灯光，不动墙面地板。</p>
                {error ? <p className="text-xs text-red-500">{error}</p> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200/70 bg-white/60 p-6">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>结果预览</span>
            <span>生成后进入结果页查看对比</span>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="overflow-hidden rounded-2xl bg-[#efe7dd]">
              {previewUrl ? (
                <img src={previewUrl} alt="原始照片" className="h-56 w-full object-cover" />
              ) : (
                <div className="flex h-56 items-center justify-center text-sm text-stone-400">
                  原始照片
                </div>
              )}
            </div>
            <div className="overflow-hidden rounded-2xl bg-[#efe7dd]">
              <div className="flex h-56 items-center justify-center text-sm text-stone-400">
                生成结果
              </div>
            </div>
          </div>
        </section>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <AnimatePresence>
        {isLoading ? (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-stone-900/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
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
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
