'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Upload } from 'lucide-react';
import { saveResult } from './lib/imageStore';
import { useThemeMode } from './lib/useThemeMode';

const themes = ['日式原木风', '奶油温柔风', '文艺复古风', '现代极简风', '绿植自然风'];
const loadingMessages = [
  '正在清理杂物并保持原始结构...',
  '正在匹配软装与自然光线...',
  '马上生成你的新空间...',
];

const spring = { type: 'spring', stiffness: 240, damping: 18 } as const;

type ResultSnapshot = {
  original?: string;
  generated?: string;
  theme?: string;
};

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
  const { theme: themeMode, toggleTheme } = useThemeMode();
  const [theme, setTheme] = useState(themes[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [fileName, setFileName] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [error, setError] = useState('');
  const [lastResult, setLastResult] = useState<ResultSnapshot | null>(null);
  const [resultView, setResultView] = useState<'generated' | 'original'>('generated');

  const hasGenerated = Boolean(lastResult?.generated);
  const displayImage =
    resultView === 'original'
      ? lastResult?.original || previewUrl
      : lastResult?.generated || '';

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = sessionStorage.getItem('nookai_result_image');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as ResultSnapshot;
      setLastResult(parsed);
    } catch {
      // Ignore invalid cache.
    }
  }, []);

  useEffect(() => {
    if (!hasGenerated && previewUrl) {
      setResultView('original');
    }
  }, [hasGenerated, previewUrl]);

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
        setLastResult({ original: previewUrl, generated: data.imageUrl, theme });
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
    <div className="min-h-screen text-[var(--text)]">
      <div className="mx-auto w-full max-w-[920px] px-4 pt-8">
        <header className="flex items-center justify-between text-sm text-[var(--text-muted)]">
          <div className="text-left">
            <p className="text-base font-semibold text-[var(--text)]">Nook</p>
            <p className="text-xs text-[var(--text-muted)]">租房软装 AI 工具</p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-xs text-[var(--text-muted)]"
          >
            {themeMode === 'dark' ? '深色' : '浅色'}主题
          </button>
        </header>
      </div>

      <main className="mx-auto max-w-[920px] px-4 py-12 text-center">
        <div className="mb-10">
          <motion.button
            type="button"
            onClick={handlePick}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={spring}
            className="flex h-[260px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-[var(--panel)] shadow-[0_16px_30px_rgba(0,0,0,0.2)]"
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="上传预览"
                className="h-full w-full object-cover"
              />
            ) : (
              <>
                <p className="text-lg mb-2 text-[var(--text)]">上传你的房间</p>
                <p className="text-sm text-[var(--text-muted)]">点击上传照片</p>
              </>
            )}
          </motion.button>
        </div>

        <div className="mb-8">
          <p className="mb-3 text-sm text-[var(--text-muted)]">风格</p>
          <div className="flex flex-wrap justify-center gap-2">
            {themes.map((item) => {
              const active = item === theme;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTheme(item)}
                  className={`rounded-full px-4 py-1.5 text-sm transition ${
                    active
                      ? 'bg-[var(--accent)] text-black shadow-[0_8px_16px_rgba(0,0,0,0.18)]'
                      : 'border border-[var(--border)] text-[var(--text-muted)]'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-14">
          <motion.button
            type="button"
            onClick={handleGenerate}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={spring}
            disabled={!previewUrl || isLoading}
            className={`rounded-xl px-8 py-3 text-sm font-semibold transition ${
              previewUrl && !isLoading
                ? 'bg-[var(--accent)] text-black shadow-[0_10px_20px_rgba(0,0,0,0.2)]'
                : 'bg-[var(--border)] text-[var(--text-muted)] opacity-70'
            }`}
          >
            {previewUrl ? '开始生成' : '请先上传'}
          </motion.button>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between text-sm text-[var(--text-muted)]">
            <span>结果预览</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setResultView('original')}
                className={`text-sm transition ${
                  resultView === 'original'
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                原图
              </button>
              <span>/</span>
              <button
                type="button"
                onClick={() => setResultView('generated')}
                disabled={!hasGenerated}
                className={`text-sm transition ${
                  resultView === 'generated' && hasGenerated
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--text-muted)]'
                } ${hasGenerated ? '' : 'cursor-not-allowed opacity-60'}`}
              >
                效果图
              </button>
            </div>
          </div>

          <div className="flex h-[340px] items-center justify-center rounded-2xl bg-[var(--panel)] shadow-[0_14px_28px_rgba(0,0,0,0.18)]">
            {displayImage ? (
              <img
                src={displayImage}
                alt={resultView === 'original' ? '原始照片' : '生成效果图'}
                className="h-full w-full rounded-2xl object-cover"
              />
            ) : (
              <p className="text-[var(--text-muted)]">生成后展示</p>
            )}
          </div>
        </div>
      </main>

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
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm"
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
