'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Cat,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { saveResult } from './lib/imageStore';

const styles = [
  { label: '日式原木风', desc: '自然木质、低饱和、安静放松' },
  { label: '奶油温柔风', desc: '柔和奶油色、轻盈松弛' },
  { label: '文艺复古风', desc: '有故事感，层次丰富' },
  { label: '现代极简风', desc: '清爽克制，功能优先' },
];

const constraintOptions = [
  { label: '不动墙面' },
  { label: '不替换家具' },
  { label: '不改动布局' },
  { label: '不改门窗' },
  { label: '不改吊顶' },
  { label: '自然光优先' },
];

const requirementOptions = [
  { label: '增加氛围灯' },
  { label: '加入绿植' },
  { label: '投影放松角' },
  { label: '收纳优化' },
  { label: '社交友好' },
  { label: '暖色织物' },
];

const spring = { type: 'spring', stiffness: 120, damping: 20 } as const;
const totalSteps = 6;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
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

  const [step, setStep] = useState(1);
  const [selectedStyle, setSelectedStyle] = useState(styles[0].label);
  const [selectedConstraints, setSelectedConstraints] = useState<string[]>([
    '不动墙面',
    '不替换家具',
    '不改动布局',
  ]);
  const [selectedRequirements, setSelectedRequirements] = useState<string[]>([
    '增加氛围灯',
    '暖色织物',
  ]);
  const [customRequirement, setCustomRequirement] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState('');

  const canProceed = step === 6 ? Boolean(imageBase64) : true;
  const progress = (step / totalSteps) * 100;

  useEffect(() => {
    if (!isLoading) {
      setLoadingProgress(0);
      return;
    }
    setLoadingProgress(12);
    const id = setInterval(() => {
      setLoadingProgress((prev) => Math.min(92, prev + 3 + Math.random() * 5));
    }, 850);
    return () => clearInterval(id);
  }, [isLoading]);

  const toggleInArray = (
    value: string,
    list: string[],
    setter: (updater: (prev: string[]) => string[]) => void
  ) => {
    if (list.includes(value)) {
      setter((prev) => prev.filter((item) => item !== value));
      return;
    }
    setter((prev) => [...prev, value]);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    try {
      const dataUrl = await fileToDataUrl(file);
      const resized = await resizeDataUrl(dataUrl, 1024, 0.8);
      setPreviewUrl(resized);
      setImageBase64(dataUrlToBase64(resized));
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请重试');
    }
  };

  const nextStep = () => setStep((prev) => Math.min(totalSteps, prev + 1));
  const prevStep = () => setStep((prev) => Math.max(1, prev - 1));

  const handleSubmit = async () => {
    if (!imageBase64 || isLoading) return;
    setError('');
    setIsLoading(true);

    const requirements = [...selectedRequirements];
    const extra = customRequirement.trim();
    if (extra) requirements.push(extra);

    try {
      let response: Response | null = null;
      let data: any = null;
      let lastMessage = '生成失败，请稍后再试';

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: imageBase64,
              theme: selectedStyle,
              constraints: selectedConstraints,
              requirements,
            }),
          });

          data = await response.json().catch(() => null);
          if (response.ok && data?.imageUrl) {
            break;
          }

          lastMessage = data?.error || `生成失败（第 ${attempt} 次）`;
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
          }
        } catch (error) {
          lastMessage = error instanceof Error ? error.message : '网络异常，请重试';
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
          }
        }
      }

      if (!response?.ok || !data?.imageUrl) {
        throw new Error(lastMessage || '生成失败，请稍后再试');
      }

      setLoadingProgress(100);

      try {
        const storedId = await saveResult({
          original: previewUrl,
          generated: data.imageUrl,
          provider: data.provider,
          theme: selectedStyle,
          constraints: selectedConstraints,
          requirements,
          evaluation: data.evaluation || '',
          suggestions: data.suggestions || '',
        });
        router.push(`/result?id=${encodeURIComponent(storedId)}`);
        return;
      } catch {
        sessionStorage.setItem(
          'nookai_result_image',
          JSON.stringify({
            original: previewUrl,
            generated: data.imageUrl,
            provider: data.provider,
            theme: selectedStyle,
            constraints: selectedConstraints,
            requirements,
            evaluation: data.evaluation || '',
            suggestions: data.suggestions || '',
          })
        );
      }
      router.push('/result');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请稍后再试');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fff8f2] text-[#1f1b13]">
      <header className="fixed top-0 z-40 w-full border-b border-[#ebe1d3]/60 bg-[#fff8f2]/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="text-2xl font-bold tracking-tight text-[#52372d]">NookAI</div>
          <div className="hidden items-center gap-8 text-sm text-[#52372d]/70 md:flex">
            <span>灵感</span>
            <span className="font-semibold text-[#8f4d2c]">改造</span>
            <span>方案</span>
          </div>
          <div className="inline-flex items-center rounded-full bg-[#fcf2e4] px-3 py-1 text-xs font-semibold text-[#8f4d2c]">
            Step {step}/{totalSteps}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-40 pt-28">
        <div className="mb-8">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8f4d2c]">Nook Wizard</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#52372d] md:text-4xl">
                {step === 1 && '欢迎来到 NookAI'}
                {step === 2 && '选择你偏爱的空间风格'}
                {step === 3 && '确认租房改造边界'}
                {step === 4 && '添加生活方式偏好'}
                {step === 5 && '补充个性化细节'}
                {step === 6 && '上传房间照片，开始改造'}
              </h1>
            </div>
            <p className="hidden text-2xl font-bold text-[#52372d] md:block">{Math.round(progress)}%</p>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#ebe1d3]">
            <motion.div className="h-full rounded-full bg-[#8f4d2c]" animate={{ width: `${progress}%` }} transition={spring} />
          </div>
        </div>

        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 135, damping: 22 }}
          className="rounded-3xl border border-[#ebe1d3]/70 bg-[#fcf2e4] p-5 md:p-7"
        >
          <AnimatePresence mode="wait" initial={false}>
            {step === 1 ? (
              <motion.section
                key="step-1"
                initial={{ opacity: 0, y: 28, scale: 0.98, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -12, scale: 0.99, filter: 'blur(4px)' }}
                transition={spring}
                className="space-y-6 rounded-3xl bg-white p-8"
              >
                <div className="inline-flex items-center gap-2 rounded-full bg-[#ffdbcc]/70 px-4 py-1.5 text-xs font-medium text-[#713618]">
                  <Sparkles size={14} />
                  出租屋美学策展人
                </div>
                <h2 className="text-4xl font-extrabold tracking-tight text-[#52372d] md:text-5xl">让出租屋，也有家的温度</h2>
                <p className="max-w-2xl text-base leading-8 text-[#504440]">
                  我们保留你房间的结构与硬装，只通过灯光、布艺、装饰和收纳来完成低预算焕新。
                </p>
              </motion.section>
            ) : null}

            {step === 2 ? (
              <motion.section
                key="step-2"
                initial={{ opacity: 0, y: 28, scale: 0.98, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -12, scale: 0.99, filter: 'blur(4px)' }}
                transition={spring}
                className="grid grid-cols-1 gap-4 md:grid-cols-2"
              >
                {styles.map((item) => {
                  const selected = item.label === selectedStyle;
                  return (
                    <motion.button
                      key={item.label}
                      type="button"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.99 }}
                      transition={spring}
                      onClick={() => setSelectedStyle(item.label)}
                      className={`rounded-3xl border p-5 text-left transition ${
                        selected
                          ? 'border-[#6b4e43] bg-white shadow-lg shadow-[#52372d]/10'
                          : 'border-[#d4c3be] bg-[#fff8f2] hover:bg-white'
                      }`}
                    >
                      <p className="text-lg font-bold text-[#52372d]">{item.label}</p>
                      <p className="mt-1 text-sm text-[#504440]">{item.desc}</p>
                    </motion.button>
                  );
                })}
              </motion.section>
            ) : null}

            {step === 3 ? (
              <motion.section
                key="step-3"
                initial={{ opacity: 0, y: 28, scale: 0.98, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -12, scale: 0.99, filter: 'blur(4px)' }}
                transition={spring}
                className="grid grid-cols-2 gap-3 md:grid-cols-3"
              >
                {constraintOptions.map((item) => {
                  const selected = selectedConstraints.includes(item.label);
                  return (
                    <motion.button
                      key={item.label}
                      type="button"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.99 }}
                      transition={spring}
                      onClick={() => toggleInArray(item.label, selectedConstraints, setSelectedConstraints)}
                      className={`rounded-2xl border px-4 py-3 text-sm transition ${
                        selected
                          ? 'border-[#52372d] bg-white font-semibold text-[#52372d]'
                          : 'border-[#d4c3be] bg-[#fff8f2] text-[#504440]'
                      }`}
                    >
                      {item.label}
                    </motion.button>
                  );
                })}
              </motion.section>
            ) : null}

            {step === 4 ? (
              <motion.section
                key="step-4"
                initial={{ opacity: 0, y: 28, scale: 0.98, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -12, scale: 0.99, filter: 'blur(4px)' }}
                transition={spring}
                className="grid grid-cols-2 gap-3 md:grid-cols-3"
              >
                {requirementOptions.map((item) => {
                  const selected = selectedRequirements.includes(item.label);
                  return (
                    <motion.button
                      key={item.label}
                      type="button"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.99 }}
                      transition={spring}
                      onClick={() => toggleInArray(item.label, selectedRequirements, setSelectedRequirements)}
                      className={`rounded-2xl border px-4 py-3 text-sm transition ${
                        selected
                          ? 'border-[#52372d] bg-white font-semibold text-[#52372d]'
                          : 'border-[#d4c3be] bg-[#fff8f2] text-[#504440]'
                      }`}
                    >
                      {item.label}
                    </motion.button>
                  );
                })}
              </motion.section>
            ) : null}

            {step === 5 ? (
              <motion.section
                key="step-5"
                initial={{ opacity: 0, y: 28, scale: 0.98, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -12, scale: 0.99, filter: 'blur(4px)' }}
                transition={spring}
                className="rounded-3xl bg-white p-5"
              >
                <textarea
                  value={customRequirement}
                  onChange={(event) => setCustomRequirement(event.target.value)}
                  placeholder="例如：希望有一个更适合下班放松的暖光角落"
                  className="min-h-[180px] w-full resize-none rounded-2xl border border-[#ebe1d3] bg-[#fff8f2] p-4 text-sm text-[#1f1b13] outline-none placeholder:text-[#827470]"
                />
              </motion.section>
            ) : null}

            {step === 6 ? (
              <motion.section
                key="step-6"
                initial={{ opacity: 0, y: 28, scale: 0.98, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -12, scale: 0.99, filter: 'blur(4px)' }}
                transition={spring}
                className="grid grid-cols-1 gap-6 lg:grid-cols-12"
              >
                <div className="lg:col-span-7">
                  <motion.button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    transition={spring}
                    className="group flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-[#d4c3be] bg-[#f1e7d9]"
                  >
                    {previewUrl ? (
                      <img src={previewUrl} alt="上传预览" className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/70 text-[#52372d]">
                          <UploadCloud size={30} />
                        </div>
                        <p className="text-sm font-semibold text-[#52372d]">点击或拖拽上传</p>
                        <p className="mt-1 text-xs text-[#504440]">支持 JPG / PNG</p>
                      </div>
                    )}
                  </motion.button>
                </div>
                <div className="lg:col-span-5">
                  <div className="rounded-3xl border border-[#d4c3be]/50 bg-white p-4">
                    <div className="relative mb-4 aspect-[3/4] overflow-hidden rounded-2xl bg-[#fcf2e4]">
                      {previewUrl ? (
                        <img src={previewUrl} alt="预览图" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-[#827470]">等待上传照片</div>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-[#504440]">
                      <p className="font-semibold text-[#52372d]">照片建议：正面视角、光线充足</p>
                      <p>我们会保留结构，仅做软装与氛围优化。</p>
                    </div>
                  </div>
                </div>
                {error ? <p className="text-sm text-[#ba1a1a] lg:col-span-12">{error}</p> : null}
              </motion.section>
            ) : null}
          </AnimatePresence>
        </motion.div>
      </main>

      <footer className="fixed bottom-0 left-0 z-40 w-full border-t border-[#ebe1d3]/60 bg-[#fff8f2]/92 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            transition={spring}
            onClick={prevStep}
            disabled={step === 1}
            className={`inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold ${
              step === 1
                ? 'cursor-not-allowed border-[#d4c3be] text-[#b8a8a2]'
                : 'border-[#d4c3be] text-[#52372d] hover:bg-[#fcf2e4]'
            }`}
          >
            <ChevronLeft size={16} /> 上一步
          </motion.button>

          {step < totalSteps ? (
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              transition={spring}
              onClick={nextStep}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#52372d] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-[#52372d]/20"
            >
              下一步 <ChevronRight size={16} />
            </motion.button>
          ) : (
            <motion.button
              type="button"
              whileHover={{ scale: canProceed ? 1.03 : 1 }}
              whileTap={{ scale: canProceed ? 0.98 : 1 }}
              transition={spring}
              onClick={handleSubmit}
              disabled={!canProceed || isLoading}
              className={`inline-flex items-center gap-2 rounded-2xl px-8 py-3 text-sm font-bold ${
                canProceed && !isLoading
                  ? 'bg-[#52372d] text-white shadow-lg shadow-[#52372d]/20'
                  : 'cursor-not-allowed bg-[#d4c3be] text-[#827470]'
              }`}
            >
              <Check size={16} />
              {canProceed ? '开始生成' : '请先上传图片'}
            </motion.button>
          )}
        </div>
      </footer>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      <AnimatePresence>
        {isLoading ? (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#1f1b13]/88 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              animate={{ y: [0, -14, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
              className="mb-6 rounded-full bg-[#ffdbcc]/20 p-5"
            >
              <Cat size={42} className="text-[#ffb695]" />
            </motion.div>
            <p className="text-base font-medium text-[#f9efe1]">AI 正在为你生成理想空间...</p>
            <div className="mt-5 h-1.5 w-64 overflow-hidden rounded-full bg-white/20">
              <motion.div
                className="h-full rounded-full bg-[#fca780]"
                animate={{ width: `${loadingProgress}%` }}
                transition={{ type: 'spring', stiffness: 80, damping: 18 }}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
