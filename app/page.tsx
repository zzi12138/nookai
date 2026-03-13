'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Cat } from 'lucide-react';

const themes = ['日式原木风', '法式复古', '极简奶油', '奶油原木', '北欧清新', '侘寂风'];
const loadingMessages = [
  '猫咪包工头正在测量房间...',
  '正在为你挑选原木风家具...',
  '魔法马上完成喵~',
];

const spring = { type: 'spring', stiffness: 260, damping: 18 } as const;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('图片读取失败，请重试'));
    reader.readAsDataURL(file);
  });
}

export default function Page() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState(themes[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [fileName, setFileName] = useState('');
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
      const image = await fileToBase64(file);
      setIsLoading(true);

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, theme }),
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
        sessionStorage.setItem('nookai_result_image', data.imageUrl);
      } catch {
        // Ignore storage errors and continue to navigation.
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
      <div className="max-w-md mx-auto min-h-screen px-4 pt-6 pb-10">
        <header className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-orange-400">NookAI (栖息小窝)</p>
            <h1 className="text-2xl font-semibold text-stone-800">你的治愈租房改造助手</h1>
          </div>
          <Cat className="text-orange-500" size={36} />
        </header>

        <motion.button
          type="button"
          onClick={handlePick}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={spring}
          className="w-full rounded-3xl border-2 border-dashed border-orange-200 bg-white/70 px-6 py-14 text-center shadow-sm"
        >
          <p className="text-lg font-medium text-stone-700">喵~ 把你的出租屋照片交给我吧！</p>
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

        <section className="mt-8">
          <h2 className="text-sm font-medium text-stone-600 mb-3">选择你想要的风格</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
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

        {error ? <p className="mt-4 text-sm text-red-500">{error}</p> : null}
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
