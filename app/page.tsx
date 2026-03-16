'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Cat, Sparkles, Upload, Wand2 } from 'lucide-react';
import { saveResult } from './lib/imageStore';

const styleCards = [
  {
    label: 'Japandi',
    description: 'Warm wood, linen, calm and balanced.',
    palette: ['#e9dcc9', '#c7b8a3', '#f5efe7', '#b7c1b0'],
    mood: ['natural wood', 'linen', 'soft warm light'],
  },
  {
    label: 'Cream Minimal',
    description: 'Soft creamy tones, cozy textures.',
    palette: ['#f5ede3', '#f0e3d2', '#e7d6c4', '#d8c6b2'],
    mood: ['boucle', 'soft pillows', 'round mirrors'],
  },
  {
    label: 'Vintage Warm',
    description: 'Nostalgic accents, warm glow.',
    palette: ['#d7b392', '#c49b77', '#e8d2bf', '#b0825c'],
    mood: ['retro lamps', 'art prints', 'stacked books'],
  },
  {
    label: 'Nordic Light',
    description: 'Crisp, airy, light woods.',
    palette: ['#f2f5f2', '#dfe6e1', '#cfd7d2', '#b8c4bf'],
    mood: ['clean lines', 'light textiles', 'daylight'],
  },
  {
    label: 'Soft Loft',
    description: 'Gentle industrial with softness.',
    palette: ['#e8e1d8', '#cdbfb3', '#b9aba0', '#a6958a'],
    mood: ['warm leather', 'metal accents', 'soft rugs'],
  },
];

const loadingMessages = [
  '猫咪包工头正在测量房间...',
  '正在为你挑选原木风家具...',
  '魔法马上完成喵~',
];

const heroImage =
  'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1600&q=80';
const beforeImage =
  'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=1400&q=80';
const afterImage =
  'https://images.unsplash.com/photo-1502005097973-6a7082348e28?auto=format&fit=crop&w=1400&q=80';

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
  const [theme, setTheme] = useState(styleCards[0].label);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [fileName, setFileName] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [compareValue, setCompareValue] = useState(50);
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
    <div className="relative min-h-screen bg-[#f6f1ea] text-stone-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 right-[-120px] h-[420px] w-[420px] rounded-full bg-amber-200/70 blur-3xl" />
        <div className="absolute bottom-[-160px] left-[-120px] h-[420px] w-[420px] rounded-full bg-rose-200/50 blur-3xl" />
        <div className="absolute left-1/3 top-1/4 h-[280px] w-[280px] rounded-full bg-emerald-200/50 blur-3xl" />
      </div>

      <main className="relative z-10 flex min-h-screen w-full flex-col gap-16 px-6 pb-20 pt-10 md:px-12 lg:px-16">
        <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.3em] text-stone-500 shadow-sm">
              <Cat size={14} className="text-amber-600" />
              Nook for renters
            </div>
            <h1 className="font-display text-4xl text-stone-800 md:text-5xl lg:text-6xl">
              Nook helps renters craft a warm, premium home with soft decor only.
            </h1>
            <p className="text-base text-stone-600 md:text-lg">
              Gentle, low-budget upgrades for young renters. Keep walls and floors untouched,
              refresh lighting, textiles, plants, and small decor to create a cozy atmosphere.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <motion.button
                type="button"
                onClick={handlePick}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={spring}
                className="inline-flex items-center gap-3 rounded-full bg-stone-900 px-6 py-3 text-sm font-semibold text-amber-100 shadow-lg"
              >
                Upload your room
                <ArrowUpRight size={16} />
              </motion.button>
              <div className="flex items-center gap-2 rounded-full bg-white/70 px-4 py-3 text-xs text-stone-600 shadow-sm">
                <Sparkles size={14} className="text-amber-500" />
                Japandi-inspired, calm and premium
              </div>
            </div>

            <div className="rounded-3xl bg-white/80 p-5 shadow-lg">
              <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Preview stage</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-stone-600">
                <span className="rounded-full bg-amber-100/70 px-3 py-1">Upload</span>
                <span className="rounded-full bg-emerald-100/70 px-3 py-1">Choose style</span>
                <span className="rounded-full bg-rose-100/70 px-3 py-1">Generate</span>
              </div>
              <p className="mt-3 text-sm text-stone-500">
                Upload once, then explore styles and generate a soft furnishing plan.
              </p>
            </div>
          </div>

          <motion.button
            type="button"
            onClick={handlePick}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={spring}
            className="group relative overflow-hidden rounded-[28px] bg-white/80 p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between text-sm text-stone-500">
              <span className="flex items-center gap-2">
                <Upload size={16} className="text-amber-500" />
                Upload & preview
              </span>
              <span className="text-xs text-amber-600">
                {fileName ? `Selected: ${fileName}` : 'Click to upload'}
              </span>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/60">
              {previewUrl ? (
                <img src={previewUrl} alt="Upload preview" className="h-full w-full object-cover" />
              ) : (
                <div className="relative h-[420px] overflow-hidden">
                  <img src={heroImage} alt="Interior" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 via-stone-900/10 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6 text-left text-white">
                    <p className="text-lg font-semibold">See your rental, softly upgraded</p>
                    <p className="mt-2 text-sm text-white/80">
                      Upload your room and explore warm, renter-friendly styles.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.button>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </section>

        <section className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-stone-400">Style gallery</p>
              <h2 className="font-display text-3xl text-stone-800">
                Pick a lifestyle mood board
              </h2>
            </div>
            <p className="max-w-xl text-sm text-stone-500">
              Each style focuses on soft decoration: textiles, lighting, plants, and removable art.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            {styleCards.map((card) => {
              const active = theme === card.label;
              return (
                <motion.button
                  key={card.label}
                  type="button"
                  onClick={() => setTheme(card.label)}
                  whileHover={{ y: -4 }}
                  transition={spring}
                  className={`rounded-3xl p-4 text-left shadow-lg ${
                    active ? 'bg-white' : 'bg-white/70'
                  }`}
                >
                  <div className="grid grid-cols-3 gap-2">
                    <div
                      className="col-span-2 h-16 rounded-2xl"
                      style={{ backgroundColor: card.palette[0] }}
                    />
                    <div className="h-16 rounded-2xl" style={{ backgroundColor: card.palette[1] }} />
                    <div className="h-12 rounded-2xl" style={{ backgroundColor: card.palette[2] }} />
                    <div className="col-span-2 h-12 rounded-2xl" style={{ backgroundColor: card.palette[3] }} />
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-stone-800">{card.label}</h3>
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        active ? 'bg-amber-500' : 'bg-stone-300'
                      }`}
                    />
                  </div>
                  <p className="mt-2 text-xs text-stone-500">{card.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {card.mood.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-amber-50 px-2 py-1 text-[10px] text-stone-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] bg-white/80 p-6 shadow-xl">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-stone-400">
              <Wand2 size={16} className="text-amber-500" />
              AI generation
            </div>
            <h2 className="mt-4 font-display text-3xl text-stone-800">
              A calm 3-step flow, designed for renters
            </h2>
            <div className="mt-6 grid gap-4">
              {[
                ['01', 'Upload your room photo'],
                ['02', 'Choose a style mood board'],
                ['03', 'Generate a soft furnishing redesign'],
              ].map(([num, text]) => (
                <div
                  key={num}
                  className="flex items-center justify-between rounded-2xl bg-[#f9f4ee] px-4 py-3 text-sm text-stone-600"
                >
                  <span className="font-semibold text-stone-700">{num}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] bg-stone-900 p-6 text-amber-100 shadow-xl">
            <h3 className="text-xl font-semibold">Ready to generate?</h3>
            <p className="mt-2 text-sm text-amber-100/80">
              We keep your room structure untouched and focus only on soft decor and lighting.
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
                  ? 'bg-amber-200 text-stone-900'
                  : 'bg-stone-700 text-stone-300'
              }`}
            >
              {previewUrl ? 'Generate AI redesign' : 'Upload your room first'}
            </motion.button>
            {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
          </div>
        </section>

        <section className="rounded-[32px] bg-white/80 p-6 shadow-xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Before / After</p>
              <h2 className="font-display text-3xl text-stone-800">See the transformation</h2>
            </div>
            <p className="text-sm text-stone-500">
              Drag to compare. Same room, softer mood.
            </p>
          </div>
          <div className="mt-6 overflow-hidden rounded-3xl border border-white/70 bg-[#f7f1ea]">
            <div className="relative">
              <img src={beforeImage} alt="Before" className="h-[420px] w-full object-cover" />
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${compareValue}%` }}
              >
                <img src={afterImage} alt="After" className="h-[420px] w-full object-cover" />
              </div>
              <div
                className="absolute inset-y-0"
                style={{ left: `calc(${compareValue}% - 1px)` }}
              >
                <div className="h-full w-[2px] bg-white shadow" />
                <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow flex items-center justify-center">
                  <div className="h-3 w-3 rounded-full bg-amber-500" />
                </div>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={compareValue}
              onChange={(event) => setCompareValue(Number(event.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          {[
            {
              title: 'Rental-friendly',
              copy: 'No hard decoration. Only soft furnishings, light, and decor.',
            },
            {
              title: 'Budget conscious',
              copy: 'Focus on affordable pieces that shift the mood quickly.',
            },
            {
              title: 'Realistic lighting',
              copy: 'Natural, physically plausible light for a true-to-life feel.',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-3xl bg-white/80 p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-stone-800">{item.title}</h3>
              <p className="mt-2 text-sm text-stone-500">{item.copy}</p>
            </div>
          ))}
        </section>

        <section className="rounded-[32px] bg-stone-900 p-8 text-amber-100 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <h2 className="font-display text-3xl">Transform your rental room in seconds</h2>
              <p className="mt-2 text-sm text-amber-100/70">
                Soft, warm, renter-friendly upgrades powered by AI.
              </p>
            </div>
            <motion.button
              type="button"
              onClick={handlePick}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={spring}
              className="inline-flex items-center gap-3 rounded-full bg-amber-200 px-6 py-3 text-sm font-semibold text-stone-900 shadow-lg"
            >
              Upload your room
              <ArrowUpRight size={16} />
            </motion.button>
          </div>
        </section>
      </main>

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
