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
  { label: '日式原木风', desc: '安静、克制、自然木感' },
  { label: '奶油温柔风', desc: '柔软、温暖、低饱和' },
  { label: '文艺复古风', desc: '有故事感和生活细节' },
  { label: '现代极简风', desc: '清爽、留白、结构感' },
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
      const resized = await resizeDataUrl(dataUrl, 1280, 0.85);
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
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageBase64,
          theme: selectedStyle,
          constraints: selectedConstraints,
          requirements,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.imageUrl) {
        throw new Error(data?.error || '生成失败，请稍后再试');
      }

      setLoadingProgress(100);

      try {
        const storedId = await saveResult({
          original: previewUrl,
          generated: data.imageUrl,
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
    <div className="min-h-screen bg-[#FDF9F1] px-4 py-10">
      <div className="mx-auto w-full max-w-[420px]">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          transition={spring}
          className="overflow-hidden rounded-3xl bg-white p-8 shadow-xl shadow-stone-200/50"
        >
          <div className="mb-7">
            <div className="mb-2 flex items-center justify-between text-xs text-stone-400">
              <span>STEP {step}</span>
              <span>{totalSteps}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
              <motion.div
                className="h-full rounded-full bg-stone-800"
                animate={{ width: `${progress}%` }}
                transition={spring}
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.section
                key="step-1"
                initial={{ opacity: 0, y: 40, scale: 0.96, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -20, scale: 0.98, filter: 'blur(4px)' }}
                transition={spring}
                className="space-y-5"
              >
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                  <Cat size={14} />
                  NookAI 小窝
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
                  住在出租屋，也能有松弛感和高级感
                </h1>
                <p className="text-sm leading-7 text-stone-500">
                  我们会保留原有结构，用低预算可落地的软装方案，帮你把房间变成更舒服的小窝。
                </p>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  transition={spring}
                  onClick={nextStep}
                  className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white shadow-sm"
                >
                  开始设计
                  <ChevronRight size={16} />
                </motion.button>
              </motion.section>
            ) : null}

            {step === 2 ? (
              <motion.section
                key="step-2"
                initial={{ opacity: 0, y: 40, scale: 0.96, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -20, scale: 0.98, filter: 'blur(4px)' }}
                transition={spring}
                className="space-y-4"
              >
                <h2 className="text-2xl font-semibold text-stone-900">你想要哪种氛围？</h2>
                <p className="text-sm text-stone-500">先定一个主基调，后面我们再细化。</p>
                <div className="grid gap-3">
                  {styles.map((item) => {
                    const selected = item.label === selectedStyle;
                    return (
                      <motion.button
                        key={item.label}
                        type="button"
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.99 }}
                        animate={{ scale: selected ? 1.03 : 1 }}
                        transition={spring}
                        onClick={() => setSelectedStyle(item.label)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          selected
                            ? 'border-stone-800 bg-stone-50 shadow-lg shadow-stone-200/70'
                            : 'border-stone-200 bg-white hover:shadow-md'
                        }`}
                      >
                        <p className="text-sm font-medium text-stone-800">{item.label}</p>
                        <p className="mt-1 text-xs text-stone-500">{item.desc}</p>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.section>
            ) : null}

            {step === 3 ? (
              <motion.section
                key="step-3"
                initial={{ opacity: 0, y: 40, scale: 0.96, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -20, scale: 0.98, filter: 'blur(4px)' }}
                transition={spring}
                className="space-y-4"
              >
                <h2 className="text-2xl font-semibold text-stone-900">改造边界怎么定？</h2>
                <p className="text-sm text-stone-500">这些约束会写进提示词，帮你守住租房底线。</p>
                <div className="grid grid-cols-2 gap-3">
                  {constraintOptions.map((item) => {
                    const selected = selectedConstraints.includes(item.label);
                    return (
                      <motion.button
                        key={item.label}
                        type="button"
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.99 }}
                        animate={{ scale: selected ? 1.03 : 1 }}
                        transition={spring}
                        onClick={() =>
                          toggleInArray(item.label, selectedConstraints, setSelectedConstraints)
                        }
                        className={`rounded-2xl border p-4 text-left text-sm transition ${
                          selected
                            ? 'border-stone-800 bg-stone-50 shadow-lg shadow-stone-200/70'
                            : 'border-stone-200 bg-white hover:shadow-md'
                        }`}
                      >
                        {item.label}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.section>
            ) : null}

            {step === 4 ? (
              <motion.section
                key="step-4"
                initial={{ opacity: 0, y: 40, scale: 0.96, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -20, scale: 0.98, filter: 'blur(4px)' }}
                transition={spring}
                className="space-y-4"
              >
                <h2 className="text-2xl font-semibold text-stone-900">再加一点生活偏好</h2>
                <p className="text-sm text-stone-500">多选你在意的生活方式，我们会重点优化。</p>
                <div className="grid grid-cols-2 gap-3">
                  {requirementOptions.map((item) => {
                    const selected = selectedRequirements.includes(item.label);
                    return (
                      <motion.button
                        key={item.label}
                        type="button"
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.99 }}
                        animate={{ scale: selected ? 1.03 : 1 }}
                        transition={spring}
                        onClick={() =>
                          toggleInArray(item.label, selectedRequirements, setSelectedRequirements)
                        }
                        className={`rounded-2xl border p-4 text-left text-sm transition ${
                          selected
                            ? 'border-stone-800 bg-stone-50 shadow-lg shadow-stone-200/70'
                            : 'border-stone-200 bg-white hover:shadow-md'
                        }`}
                      >
                        {item.label}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.section>
            ) : null}

            {step === 5 ? (
              <motion.section
                key="step-5"
                initial={{ opacity: 0, y: 40, scale: 0.96, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -20, scale: 0.98, filter: 'blur(4px)' }}
                transition={spring}
                className="space-y-4"
              >
                <h2 className="text-2xl font-semibold text-stone-900">还有什么偏好吗？</h2>
                <p className="text-sm text-stone-500">可以写一句你最在意的小细节。</p>
                <textarea
                  value={customRequirement}
                  onChange={(event) => setCustomRequirement(event.target.value)}
                  placeholder="例如：希望看电影时有更温暖的角落光线"
                  className="min-h-[140px] w-full resize-none rounded-2xl bg-stone-50 p-4 text-sm text-stone-700 outline-none placeholder:text-stone-400"
                />
              </motion.section>
            ) : null}

            {step === 6 ? (
              <motion.section
                key="step-6"
                initial={{ opacity: 0, y: 40, scale: 0.96, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -20, scale: 0.98, filter: 'blur(4px)' }}
                transition={spring}
                className="space-y-4"
              >
                <h2 className="text-2xl font-semibold text-stone-900">上传你的房间照片</h2>
                <p className="text-sm text-stone-500">正面视角、光线清楚，生成效果会更稳定。</p>
                <motion.button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  transition={spring}
                  className="group flex h-[220px] w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-amber-300/70 bg-amber-50/70"
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="上传预览"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-center">
                      <UploadCloud
                        size={30}
                        className="mx-auto text-stone-500 transition group-hover:text-stone-700"
                      />
                      <p className="mt-3 text-sm text-stone-700">传一张照片，开始改造</p>
                      <p className="mt-1 text-xs text-stone-400">支持 JPG / PNG</p>
                    </div>
                  )}
                </motion.button>
                {error ? <p className="text-sm text-red-500">{error}</p> : null}
              </motion.section>
            ) : null}
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-between">
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              transition={spring}
              onClick={prevStep}
              disabled={step === 1}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm ${
                step === 1
                  ? 'cursor-not-allowed text-stone-300'
                  : 'text-stone-500 hover:bg-stone-100'
              }`}
            >
              <ChevronLeft size={16} />
              上一步
            </motion.button>

            {step < totalSteps ? (
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                transition={spring}
                onClick={nextStep}
                className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white shadow-sm"
              >
                下一步
                <ChevronRight size={16} />
              </motion.button>
            ) : (
              <motion.button
                type="button"
                whileHover={{ scale: canProceed ? 1.03 : 1 }}
                whileTap={{ scale: canProceed ? 0.98 : 1 }}
                transition={spring}
                onClick={handleSubmit}
                disabled={!canProceed || isLoading}
                className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium ${
                  canProceed && !isLoading
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'cursor-not-allowed bg-stone-200 text-stone-500'
                }`}
              >
                <Check size={16} />
                {canProceed ? '开始生成' : '请先上传图片'}
              </motion.button>
            )}
          </div>
        </motion.div>
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
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/45 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              animate={{ y: [0, -14, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
              className="mb-6 rounded-full bg-amber-100 p-4"
            >
              <Cat size={40} className="text-amber-600" />
            </motion.div>
            <p className="text-sm text-white/90">AI 正在为你设计小窝...</p>
            <div className="mt-5 h-1.5 w-56 overflow-hidden rounded-full bg-white/30">
              <motion.div
                className="h-full rounded-full bg-amber-300"
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
