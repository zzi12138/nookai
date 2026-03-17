'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Cat, Sparkles } from 'lucide-react';
import { saveResult } from './lib/imageStore';

const themes = ['日式原木风', '奶油温柔风', '文艺复古风', '现代极简风', '绿植自然风'];
const loadingMessages = [
  '猫咪包工头正在测量房间...',
  '正在为你挑选软装与灯光...',
  '魔法马上完成喵~',
];

const checklist = [
  '仅更新软装与灯光',
  '墙面与地板保持不变',
  '自然光线与真实质感',
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
  const [selectedTheme, setSelectedTheme] = useState('日式原木风');
  const [strength, setStrength] = useState(0.5);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [error, setError] = useState('');

  const strengthPercent = Math.min(100, Math.max(0, ((strength - 0.1) / 0.9) * 100));

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

    try {
      const dataUrl = await fileToDataUrl(file);
      const resized = await resizeDataUrl(dataUrl, 1280, 0.85);
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
        body: JSON.stringify({ image: imageBase64, theme: selectedTheme, strength }),
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
          theme: selectedTheme,
        });
        router.push(`/result?id=${encodeURIComponent(storedId)}`);
        return;
      } catch {
        try {
          sessionStorage.setItem(
            'nookai_result_image',
            JSON.stringify({ original: previewUrl, generated: data.imageUrl, theme: selectedTheme })
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
    <div className="min-h-screen bg-[#FDF9F1] text-stone-800">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-16 pt-10">
        <header className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100">
              <Cat className="text-orange-400" size={24} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-stone-400">
                NOOKAI STUDIO
              </p>
              <h1 className="text-2xl font-semibold text-stone-800">
                让出租屋也有家的温度
              </h1>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full bg-white/90 px-5 py-2 text-sm text-stone-600 shadow-sm backdrop-blur"
          >
            <Sparkles size={16} className="text-orange-400" />
            三步生成氛围空间
          </button>
        </header>

        <main className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="flex flex-col gap-6 lg:col-span-7">
            <div className="rounded-3xl bg-white/90 p-6 shadow-sm backdrop-blur">
              <h2 className="text-xl font-semibold text-stone-800">
                一张照片，三分钟焕新房间氛围
              </h2>
              <p className="mt-2 text-sm text-stone-500">
                保留原有结构，用软装、灯光与氛围细节打造更温暖的居住体验。
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {['上传照片', '选择风格', '生成效果图'].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-orange-50 px-3 py-1 text-xs text-stone-500"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-white/90 p-6 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between text-sm text-stone-500">
                <span className="font-medium text-stone-700">上传与预览</span>
                <span>点击上传</span>
              </div>
              <motion.button
                type="button"
                onClick={handlePick}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                transition={spring}
                className="mt-4 flex h-[280px] w-full items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-orange-200/50 bg-orange-50/30"
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="上传预览"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="text-center">
                    <p className="text-sm text-stone-600">点击上传房间照片</p>
                    <p className="mt-2 text-xs text-stone-400">支持 JPG / PNG</p>
                  </div>
                )}
              </motion.button>
            </div>
          </section>

          <aside className="flex flex-col gap-6 lg:col-span-5">
            <div className="rounded-3xl bg-white/90 p-6 shadow-sm backdrop-blur">
              <h3 className="text-sm font-semibold text-stone-700">
                选择你想要的风格气质
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {themes.map((item) => {
                  const active = item === selectedTheme;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setSelectedTheme(item)}
                      className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-sm transition ${
                        active
                          ? 'border-yellow-200 bg-yellow-100 text-stone-700'
                          : 'border-stone-200 bg-white text-stone-500'
                      }`}
                    >
                      <span>{item}</span>
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          active ? 'bg-orange-400' : 'bg-stone-300'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl bg-white/90 p-6 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between text-sm text-stone-600">
                <span className="font-semibold text-stone-700">结构锁定强度</span>
                <span className="rounded-full bg-orange-50 px-2 py-1 text-xs text-stone-600">
                  {strength.toFixed(2)}
                </span>
              </div>
              <div className="mt-4">
                <div className="relative h-2 rounded-full bg-orange-100">
                  <div
                    className="absolute left-0 top-0 h-2 rounded-full bg-orange-400"
                    style={{ width: `${strengthPercent}%` }}
                  />
                  <input
                    type="range"
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    value={strength}
                    onChange={(event) => setStrength(Number(event.target.value))}
                    className="absolute inset-0 h-2 w-full cursor-pointer appearance-none bg-transparent accent-orange-400"
                  />
                </div>
                <p className="mt-2 text-xs text-stone-400">
                  数值越高，结构保持越强。
                </p>
              </div>

              <motion.button
                type="button"
                onClick={handleGenerate}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={spring}
                disabled={!imageBase64 || isLoading}
                className={`mt-5 w-full rounded-2xl px-6 py-3 text-sm font-semibold transition ${
                  imageBase64 && !isLoading
                    ? 'bg-orange-400 text-white shadow-sm'
                    : 'bg-stone-200 text-stone-500'
                }`}
              >
                {imageBase64 ? '开始生成' : '请先上传照片'}
              </motion.button>

              {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
            </div>

            <div className="rounded-3xl bg-white/90 p-6 shadow-sm backdrop-blur">
              <h4 className="text-sm font-semibold text-stone-700">小提示</h4>
              <ul className="mt-4 space-y-3 text-sm text-stone-500">
                {checklist.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-yellow-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </main>
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
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 0.9, repeat: Infinity }}
            >
              <Cat size={48} className="text-orange-400" />
            </motion.div>
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
