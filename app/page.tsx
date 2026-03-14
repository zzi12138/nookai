'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Cat } from 'lucide-react';
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
    <div className="min-h-screen bg-amber-50">
      <div className="max-w-6xl mx-auto min-h-screen px-4 md:px-8 pt-6 pb-12">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-sm text-orange-400">NookAI (栖息小窝)</p>
            <h1 className="text-2xl md:text-3xl font-semibold text-stone-800">
              让出租屋也有家的温度
            </h1>
            <p className="mt-2 text-sm md:text-base text-stone-500">
              轻量软装改造，暖光与小摆件，让空间更有氛围。
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-full bg-white/80 px-4 py-2 shadow-sm">
            <Cat className="text-orange-500" size={28} />
            <span className="text-sm text-stone-600">猫咪包工头在线</span>
          </div>
        </header>

        <div className="grid gap-8 md:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <motion.button
              type="button"
              onClick={handlePick}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={spring}
              className="w-full rounded-3xl border-2 border-dashed border-orange-200 bg-white/80 px-6 py-14 text-center shadow-sm"
            >
              <p className="text-lg font-medium text-stone-700">
                喵~ 把你的出租屋照片交给我吧！
              </p>
              <p className="mt-3 text-sm text-stone-500">点击上传，猫咪包工头马上开工</p>
              {fileName ? (
                <p className="mt-4 text-xs text-orange-500">已选择：{fileName}</p>
              ) : null}
            </motion.button>

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="rounded-3xl bg-white/80 p-4 shadow-sm">
              <p className="text-sm font-medium text-stone-600 mb-3">上传预览</p>
              {previewUrl ? (
                <div className="overflow-hidden rounded-2xl border border-orange-100 bg-amber-50">
                  <img
                    src={previewUrl}
                    alt="上传预览"
                    className="w-full h-auto object-contain block"
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-orange-100 bg-amber-50/60 py-10 text-center text-sm text-stone-500">
                  还没有照片，先上传一张吧～
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl bg-white/85 p-5 shadow-sm">
              <h2 className="text-sm font-medium text-stone-600 mb-3">选择你想要的风格</h2>
              <div className="flex flex-wrap gap-3">
                {themes.map((item) => {
                  const active = item === theme;
                  return (
                    <motion.button
                      key={item}
                      type="button"
                      onClick={() => setTheme(item)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      transition={spring}
                      className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
                        active
                          ? 'bg-orange-400 text-white'
                          : 'bg-white text-stone-600 border border-orange-100'
                      }`}
                    >
                      {item}
                    </motion.button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl bg-white/85 p-5 shadow-sm">
              <h2 className="text-sm font-medium text-stone-600 mb-2">开始改造</h2>
              <p className="text-xs text-stone-500 mb-4">
                选择风格后点击按钮，猫咪包工头将为你进行软装与灯光的氛围升级。
              </p>
              <motion.button
                type="button"
                onClick={handleGenerate}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={spring}
                disabled={!previewUrl || isLoading}
                className={`w-full rounded-2xl px-6 py-3 text-sm font-semibold shadow-lg ${
                  previewUrl && !isLoading
                    ? 'bg-orange-400 text-white'
                    : 'bg-stone-200 text-stone-500'
                }`}
              >
                {previewUrl ? '开始生成效果图' : '请先上传照片'}
              </motion.button>
            </section>

            {error ? <p className="text-sm text-red-500">{error}</p> : null}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isLoading ? (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/30 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              animate={{ y: [0, -14, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Cat size={48} className="text-orange-500" />
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
