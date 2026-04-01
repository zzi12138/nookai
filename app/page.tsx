'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Cat,
  Sparkles,
  UploadCloud,
  UserCircle2,
  Wand2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { saveResult } from './lib/imageStore';
import type { PlanningPackage } from './api/plan/route';
import type { DesignChatQuestion, DesignChatResponse, DesignChatState } from './lib/designChat';

const TOTAL_STEPS = 5;
const stepTitles = ['欢迎', '上传照片', 'AI 分析中', '个性化选择', '确认方案'];

const loadingLines = ['正在理解你的风格偏好...', '正在生成改造效果图...', '正在整理购物指南...'];

async function readJsonSafe<T>(res: Response): Promise<{ data: T | null; raw: string }> {
  const raw = await res.text();
  if (!raw) return { data: null, raw: '' };
  try {
    return { data: JSON.parse(raw) as T, raw };
  } catch {
    return { data: null, raw };
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('图片读取失败，请重试'));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBase64(dataUrl: string) {
  return dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
}

async function resizeDataUrl(dataUrl: string, maxSize = 1024, quality = 0.8) {
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
        reject(new Error('Canvas 初始化失败'));
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('图片处理失败，请重试'));
    img.src = dataUrl;
  });
}

const spring = { type: 'spring', stiffness: 120, damping: 20 } as const;

export default function Page() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);

  const [previewUrl, setPreviewUrl] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState('');

  // Planning package state (Phase 1)
  const [planningPackage, setPlanningPackage] = useState<PlanningPackage | null>(null);
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  const [planError, setPlanError] = useState('');
  const [dynamicAnswers, setDynamicAnswers] = useState<Record<string, string | string[]>>({});
  const [chatState, setChatState] = useState<DesignChatState | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<DesignChatQuestion | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');

  const percent = Math.round((step / TOTAL_STEPS) * 100);
  const canGenerate = Boolean(imageBase64) && Boolean(planningPackage);

  const loadingText = useMemo(() => {
    if (loadingProgress < 36) return loadingLines[0];
    if (loadingProgress < 72) return loadingLines[1];
    return loadingLines[2];
  }, [loadingProgress]);

  useEffect(() => {
    if (!isLoading) {
      setLoadingProgress(0);
      return;
    }
    setLoadingProgress(12);
    const timer = window.setInterval(() => {
      setLoadingProgress((prev) => Math.min(92, prev + 2 + Math.random() * 4));
    }, 900);
    return () => window.clearInterval(timer);
  }, [isLoading]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');

    try {
      const raw = await fileToDataUrl(file);
      let resized = await resizeDataUrl(raw, 1024, 0.8);
      if (resized.length > 2_000_000) {
        resized = await resizeDataUrl(resized, 768, 0.72);
      }

      setPreviewUrl(resized);
      setImageBase64(dataUrlToBase64(resized));
      setPlanningPackage(null);
      setDynamicAnswers({});
      setChatState(null);
      setActiveQuestion(null);
      setChatError('');
      setPlanError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请重试');
    }
  };

  const fetchPlan = async () => {
    if (!imageBase64) return;
    setIsPlanLoading(true);
    setPlanError('');
    setStep(3); // "AI 分析中"

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 }),
      });
      const { data, raw } = await readJsonSafe<{ planningPackage?: PlanningPackage; error?: string }>(res);
      if (!res.ok || !data?.planningPackage) {
        const fallback = raw ? `服务返回异常：${raw.slice(0, 120)}` : 'AI 分析失败';
        throw new Error(data?.error || fallback);
      }
      setPlanningPackage(data.planningPackage);
      setDynamicAnswers({});
      setChatState(null);
      setActiveQuestion(null);
      await startDesignChat(data.planningPackage);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'AI 分析失败，请重试');
      setStep(2); // Go back to upload
    } finally {
      setIsPlanLoading(false);
    }
  };

  const goNext = () => {
    if (step === 2 && imageBase64) {
      // After upload, trigger AI plan
      fetchPlan();
      return;
    }
    if (step === 4) {
      continueDesignChat();
      return;
    }
    setStep((prev) => Math.min(TOTAL_STEPS, prev + 1));
  };
  const goPrev = () => {
    if (step === 4) {
      // From dynamic questions, go back to upload (skip AI loading step)
      setChatError('');
      setStep(2);
      return;
    }
    setStep((prev) => Math.max(1, prev - 1));
  };

  const setDynamicAnswer = (qId: string, value: string, allowMultiple: boolean) => {
    setDynamicAnswers((prev) => {
      if (!allowMultiple) return { ...prev, [qId]: value };
      const current = (prev[qId] as string[]) || [];
      if (current.includes(value)) {
        return { ...prev, [qId]: current.filter((v) => v !== value) };
      }
      return { ...prev, [qId]: [...current, value] };
    });
  };

  const startDesignChat = async (pkg: PlanningPackage) => {
    setIsChatLoading(true);
    setChatError('');
    try {
      const res = await fetch('/api/design-chat/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planningPackage: pkg }),
      });
      const { data, raw } = await readJsonSafe<DesignChatResponse & { error?: string }>(res);
      if (!res.ok || !data || data.mode !== 'ask') {
        const fallback = raw ? `服务返回异常：${raw.slice(0, 120)}` : '问答初始化失败';
        throw new Error(data?.error || fallback);
      }
      setChatState(data.chatState);
      setActiveQuestion(data.question);
      setStep(4);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : '问答初始化失败，请重试');
      setStep(2);
    } finally {
      setIsChatLoading(false);
    }
  };

  const continueDesignChat = async () => {
    if (!planningPackage || !chatState || !activeQuestion) return;
    const answer = dynamicAnswers[activeQuestion.id];
    if (!answer || (Array.isArray(answer) && answer.length === 0)) {
      setChatError('请先选择一个答案再继续');
      return;
    }

    setIsChatLoading(true);
    setChatError('');
    try {
      const res = await fetch('/api/design-chat/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planningPackage,
          chatState,
          answer,
        }),
      });
      const { data, raw } = await readJsonSafe<DesignChatResponse & { error?: string }>(res);
      if (!res.ok || !data) {
        const fallback = raw ? `服务返回异常：${raw.slice(0, 120)}` : '问答继续失败';
        throw new Error(data?.error || fallback);
      }

      if (data.mode === 'final') {
        setChatState(data.chatState);
        setActiveQuestion(null);
        setStep(5);
        return;
      }

      setChatState(data.chatState);
      setActiveQuestion(data.question);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : '问答继续失败，请重试');
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!imageBase64 || isLoading) return;

    setError('');
    setIsLoading(true);

    try {
      // ── Stage 2: compose-prompt ──
      const composeRes = await fetch('/api/compose-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planningPackage,
          userAnswers: dynamicAnswers,
        }),
      });
      const { data: composeData, raw: composeRaw } = await readJsonSafe<{
        prompt?: string;
        error?: string;
        referenceImages?: string[];
        evaluation?: string;
        suggestions?: string;
        designPlan?: any;
        referenceImageMeta?: any;
      }>(composeRes);
      if (!composeRes.ok || !composeData?.prompt) {
        const fallback = composeRaw ? `服务返回异常：${composeRaw.slice(0, 120)}` : '方案生成失败';
        throw new Error(composeData?.error || fallback);
      }

      // ── Stage 3: generate image ──
      let response: Response | null = null;
      let data: any = null;
      let lastMessage = '生成失败，请稍后再试';

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 80000);
        try {
              response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  image: imageBase64,
                  composedPrompt: composeData.prompt,
                  referenceImages: composeData.referenceImages || [],
                  evaluation: composeData.evaluation,
                  suggestions: composeData.suggestions,
                }),
                signal: controller.signal,
              });

          const parsed = await readJsonSafe<any>(response);
          data = parsed.data;
          if (response.ok && data?.imageUrl) {
            break;
          }

          lastMessage = data?.error || `生成失败（第 ${attempt} 次）`;
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
          }
        } catch (err) {
          const rawMessage = err instanceof Error ? err.message : '网络异常，请重试';
          lastMessage =
            rawMessage.includes('Failed to fetch') || rawMessage.includes('NetworkError')
              ? '网络连接波动，请稍后重试（已自动重试）'
              : rawMessage;
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
          }
        } finally {
          window.clearTimeout(timer);
        }
      }

      if (!response?.ok || !data?.imageUrl) {
        throw new Error(lastMessage || '生成失败，请稍后再试');
      }

      setLoadingProgress(100);

      // Store generate cost and planning package for debug
      try {
        if (data.cost) sessionStorage.setItem('nookai_generate_cost', JSON.stringify(data.cost));
        if (planningPackage) sessionStorage.setItem('nookai_planning_package', JSON.stringify(planningPackage));
        if (dynamicAnswers) sessionStorage.setItem('nookai_dynamic_answers', JSON.stringify(dynamicAnswers));
        if (composeData?.designPlan) sessionStorage.setItem('nookai_design_plan', JSON.stringify(composeData.designPlan));
        if (composeData?.referenceImageMeta) {
          sessionStorage.setItem('nookai_reference_meta', JSON.stringify(composeData.referenceImageMeta));
        }
      } catch { /* ignore */ }

      try {
        const inferredTheme = planningPackage?.designStrategy.colorDirection || 'AI推荐';
        const requirements = Object.values(dynamicAnswers).flat().filter(Boolean) as string[];
        const storedId = await saveResult({
          original: previewUrl,
          generated: data.imageUrl,
          provider: data.provider,
          theme: inferredTheme,
          constraints: [],
          requirements,
          evaluation: data.evaluation || '',
          suggestions: data.suggestions || '',
        });

        router.push(`/result?id=${encodeURIComponent(storedId)}`);
        return;
      } catch {
        const fallbackRequirements = Object.values(dynamicAnswers).flat().filter(Boolean) as string[];
        sessionStorage.setItem(
          'nookai_result_image',
          JSON.stringify({
            original: previewUrl,
            generated: data.imageUrl,
            provider: data.provider,
            theme: planningPackage?.designStrategy.colorDirection || 'AI推荐',
            constraints: [],
            requirements: fallbackRequirements,
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
      <header className="fixed top-0 z-50 w-full bg-[#fff8f2]/80 backdrop-blur-xl transition-opacity duration-300">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <img src="/logo.svg" alt="nook" className="h-10 w-auto" />
          <div className="flex items-center gap-6">
            <nav className="hidden items-center gap-8 md:flex">
              <span className="cursor-pointer font-semibold text-[#8f4d2c] transition-opacity">灵感</span>
              <span className="cursor-pointer font-medium text-[#52372d]/70 hover:opacity-80">改造</span>
              <span className="cursor-pointer font-medium text-[#52372d]/70 hover:opacity-80">方案</span>
            </nav>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm font-medium text-primary/70 md:inline-block">步骤 {step} / {TOTAL_STEPS}</span>
              <UserCircle2 className="h-6 w-6 text-primary" />
            </div>
          </div>
        </div>
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#ebe1d3]/30 to-transparent" />
        <div className="h-1 w-full bg-[#ebe1d3]">
          <motion.div className="h-full bg-[#8f4d2c]" animate={{ width: `${percent}%` }} transition={spring} />
        </div>
      </header>

      <main
        className={`mx-auto w-full max-w-5xl px-6 ${
          step === 1
            ? 'flex flex-col pb-28 pt-24'
            : 'min-h-screen pb-32 pt-28'
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {step === 1 && (
            <motion.section
              key="step-1"
              initial={{ opacity: 0, y: 24, scale: 0.98, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -16, scale: 0.98, filter: 'blur(6px)' }}
              transition={spring}
              className="relative flex flex-1 flex-col justify-center overflow-hidden rounded-3xl bg-white p-6 md:p-10"
            >
              <div className="absolute -left-20 -top-20 h-52 w-52 rounded-full bg-[#ffdbcc]/40 blur-3xl" />
              <div className="absolute -bottom-16 -right-16 h-44 w-44 rounded-full bg-[#ffb695]/25 blur-3xl" />

              <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center text-center">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#f1e7d9] px-4 py-1.5 text-sm font-medium text-[#8f4d2c]">
                    <Sparkles className="h-3.5 w-3.5" />
                    出租屋美学策展人
                  </div>
                  <h1 className="text-4xl font-bold tracking-tight text-[#52372d] md:text-[56px] md:leading-[1.08]">
                    欢迎来到 NookAI
                  </h1>
                  <p className="mx-auto max-w-2xl text-base font-light leading-relaxed text-[#504440]/80 md:text-lg">
                    帮你把出租屋慢慢变成理想的小角落。
                    <br className="hidden md:block" />
                    不改硬装，也能看到明显变化。
                  </p>
                </div>

                <div className="mt-5 flex flex-col items-center gap-3">
                  <p className="flex items-center gap-2 text-sm text-[#504440]/65">
                    <Sparkles className="h-4 w-4" />
                    AI 已准备好为你重新定义空间，点击下方“下一步”开始
                  </p>
                </div>

                <div className="mt-6 grid w-full max-w-3xl grid-cols-1 gap-3 text-left md:grid-cols-2">
                  <div className="space-y-2 rounded-2xl border border-[#d4c3be]/20 bg-[#fcf2e4] p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fca780]/20 text-[#8f4d2c]">
                      <Wand2 className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-bold text-[#52372d]">软装配色方案</h3>
                    <p className="text-xs leading-relaxed text-[#504440]/70">低预算软装组合，保持租房友好。</p>
                  </div>

                  <div className="space-y-2 rounded-2xl border border-[#d4c3be]/20 bg-[#fcf2e4] p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fca780]/20 text-[#8f4d2c]">
                      <Wand2 className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-bold text-[#52372d]">AI 实景改造 + 清单</h3>
                    <p className="text-xs leading-relaxed text-[#504440]/70">生成效果图后同步输出购物建议。</p>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {/* Step 2: Upload photo */}
          {step === 2 && (
            <motion.section
              key="step-2-upload"
              initial={{ opacity: 0, y: 24, scale: 0.98, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -16, scale: 0.98, filter: 'blur(6px)' }}
              transition={spring}
            >
              <div className="mb-6">
                <span className="text-sm font-bold uppercase tracking-widest text-[#8f4d2c]">Step 01 / {TOTAL_STEPS.toString().padStart(2, '0')}</span>
                <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#52372d]">上传房间照片</h1>
                <p className="mt-2 text-base text-[#504440]">拍摄一张光线充足、能看清房间布局的照片，AI 将为你量身设计方案</p>
              </div>

              <div className="mx-auto w-full max-w-3xl">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="group relative w-full cursor-pointer transition-transform duration-300 active:scale-[0.98]">
                  <div className="flex aspect-[16/10] w-full flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-[#d4c3be] bg-[#fcf2e4] transition-colors group-hover:bg-[#f1e7d9]">
                    {previewUrl ? (
                      <img src={previewUrl} alt="上传预览" className="h-full w-full rounded-[22px] object-cover" />
                    ) : (
                      <>
                        <div className="mb-4 rounded-full bg-[#52372d]/5 p-6">
                          <UploadCloud className="h-10 w-10 text-[#52372d]" />
                        </div>
                        <p className="font-semibold text-[#52372d]">点击或拖拽上传</p>
                        <p className="mt-1 text-sm text-[#504440]">支持 JPG, PNG (最大 10MB)</p>
                      </>
                    )}
                  </div>
                </button>
              </div>

              {planError && <p className="mt-4 text-center text-sm text-[#ba1a1a]">{planError}</p>}
              {error && <p className="mt-4 text-center text-sm text-[#ba1a1a]">{error}</p>}
            </motion.section>
          )}

          {/* Step 3: AI analyzing (loading state) */}
          {step === 3 && (
            <motion.section
              key="step-3-analyzing"
              initial={{ opacity: 0, y: 24, scale: 0.98, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -16, scale: 0.98, filter: 'blur(6px)' }}
              transition={spring}
              className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl bg-white p-8"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="mb-6"
              >
                <Sparkles className="h-12 w-12 text-[#8f4d2c]" />
              </motion.div>
              <h2 className="text-2xl font-bold text-[#52372d]">AI 正在分析你的房间</h2>
              <p className="mt-3 text-sm text-[#504440]">正在识别房间结构、生成个性化设计方案...</p>
              <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-[#ebe1d3]">
                <motion.div
                  className="h-full bg-[#8f4d2c]"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ width: '50%' }}
                />
              </div>
            </motion.section>
          )}

          {/* Step 4: Dynamic AI questions */}
          {step === 4 && planningPackage && (
            <motion.section
              key="step-4-questions"
              initial={{ opacity: 0, y: 24, scale: 0.98, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -16, scale: 0.98, filter: 'blur(6px)' }}
              transition={spring}
            >
              <div className="mb-6">
                <span className="text-sm font-bold uppercase tracking-widest text-[#8f4d2c]">Step 02 / {TOTAL_STEPS.toString().padStart(2, '0')}</span>
                <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#52372d]">告诉我们你的理想房间</h1>
                <p className="mt-2 text-base text-[#504440]">我们一次只问一个问题，快速抓住你最关键的偏好</p>
              </div>

              {/* Design strategy summary card */}
              <div className="mb-6 rounded-2xl border border-[#ebe1d3] bg-[#fcf2e4] p-5">
                <h3 className="mb-2 text-sm font-bold text-[#8f4d2c]">AI 初步方案</h3>
                <div className="grid grid-cols-1 gap-2 text-xs text-[#504440] md:grid-cols-2">
                  <p><span className="font-semibold text-[#52372d]">焦点区域：</span>{planningPackage.designStrategy.focalPoint}</p>
                  <p><span className="font-semibold text-[#52372d]">灯光方案：</span>{planningPackage.designStrategy.lightingApproach}</p>
                  <p><span className="font-semibold text-[#52372d]">配色方向：</span>{planningPackage.designStrategy.colorDirection}</p>
                  <p><span className="font-semibold text-[#52372d]">软装方向：</span>{planningPackage.designStrategy.softFurnishingApproach}</p>
                </div>
              </div>

              {/* Single dynamic question flow */}
              <div className="rounded-3xl bg-white p-6">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#8f4d2c]">
                    进度 {chatState?.askedQuestionIds.length || 0} / {planningPackage.dynamicQuestionnaire.length}
                  </p>
                  <p className="text-xs text-[#827470]">
                    已识别关键偏好 {Object.values(chatState?.slots || {}).filter(Boolean).length} / 6
                  </p>
                </div>

                {isChatLoading && !activeQuestion ? (
                  <div className="flex min-h-[180px] items-center justify-center">
                    <div className="flex items-center gap-2 text-sm text-[#504440]">
                      <Sparkles className="h-4 w-4 animate-pulse text-[#8f4d2c]" />
                      正在准备你的下一问...
                    </div>
                  </div>
                ) : activeQuestion ? (
                  <>
                    <h3 className="mb-1 text-base font-bold text-[#52372d]">{activeQuestion.question}</h3>
                    {activeQuestion.allowMultiple && (
                      <p className="mb-3 text-xs text-[#827470]">可多选</p>
                    )}
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {activeQuestion.options.map((opt) => {
                        const currentAnswer = dynamicAnswers[activeQuestion.id];
                        const isSelected = activeQuestion.allowMultiple
                          ? Array.isArray(currentAnswer) && currentAnswer.includes(opt.value)
                          : currentAnswer === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setDynamicAnswer(activeQuestion.id, opt.value, activeQuestion.allowMultiple)}
                            className={`flex flex-col items-start rounded-2xl border px-4 py-3 text-left text-sm transition ${
                              isSelected
                                ? 'border-[#52372d] bg-[#f7edde] font-semibold text-[#52372d]'
                                : 'border-[#d4c3be] bg-[#fff8f2] text-[#504440] hover:border-[#b8a89e]'
                            }`}
                          >
                            <span className={isSelected ? 'font-semibold' : 'font-medium'}>{opt.label}</span>
                            <span className="mt-0.5 text-xs font-normal text-[#827470]">{opt.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[160px] items-center justify-center text-sm text-[#827470]">
                    信息采集完成，准备进入确认阶段...
                  </div>
                )}
              </div>

              {chatError && <p className="mt-4 text-center text-sm text-[#ba1a1a]">{chatError}</p>}
            </motion.section>
          )}

          {/* Step 5: Confirm & Generate */}
          {step === 5 && planningPackage && (
            <motion.section
              key="step-5-confirm"
              initial={{ opacity: 0, y: 24, scale: 0.98, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -16, scale: 0.98, filter: 'blur(6px)' }}
              transition={spring}
            >
              <div className="mb-6">
                <span className="text-sm font-bold uppercase tracking-widest text-[#8f4d2c]">Step 03 / {TOTAL_STEPS.toString().padStart(2, '0')}</span>
                <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#52372d]">确认你的改造方案</h1>
                <p className="mt-2 text-base text-[#504440]">检查以下信息，确认无误后开始生成效果图</p>
              </div>

              <div className="space-y-4">
                {/* Photo preview */}
                {previewUrl && (
                  <div className="overflow-hidden rounded-2xl">
                    <img src={previewUrl} alt="原图" className="w-full object-cover" style={{ maxHeight: 280 }} />
                  </div>
                )}

                {/* Summary card */}
                <div className="rounded-2xl bg-white p-5">
                  <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#8f4d2c]">房间类型</span>
                      <p className="mt-1 font-semibold text-[#52372d]">{planningPackage.sceneAnalysis.roomType}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#8f4d2c]">焦点区域</span>
                      <p className="mt-1 text-[#504440]">{planningPackage.designStrategy.focalPoint}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#8f4d2c]">灯光方案</span>
                      <p className="mt-1 text-[#504440]">{planningPackage.designStrategy.lightingApproach}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#8f4d2c]">配色方向</span>
                      <p className="mt-1 text-[#504440]">{planningPackage.designStrategy.colorDirection}</p>
                    </div>
                  </div>
                </div>

                {/* User answers */}
                {Object.keys(dynamicAnswers).length > 0 && (
                <div className="rounded-2xl bg-white p-5">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8f4d2c]">你的选择</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(dynamicAnswers).map(([qId, ans]) => {
                      const q = planningPackage.dynamicQuestionnaire.find((sq) => sq.id === qId);
                      const values = Array.isArray(ans) ? ans : [ans];
                      return values.map((v) => {
                        const opt = q?.options.find((o) => o.value === v);
                        return (
                          <span key={`${qId}-${v}`} className="rounded-full bg-[#f7edde] px-3 py-1 text-xs font-medium text-[#52372d]">
                            {opt?.label || v}
                          </span>
                        );
                      });
                    })}
                  </div>
                </div>
                )}
              </div>

              {error && <p className="mt-4 text-center text-sm text-[#ba1a1a]">{error}</p>}
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="fixed bottom-0 left-0 z-50 w-full border-t border-[#ebe1d3]/30 bg-[#fff8f2]/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
          {step === 1 ? (
            <div />
          ) : (
            <button
              type="button"
              onClick={goPrev}
              className="flex items-center gap-2 rounded-2xl border-2 border-[#d4c3be] px-6 py-3 font-bold text-[#52372d] transition-all hover:bg-[#fcf2e4] active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
              上一步
            </button>
          )}

          {step === 3 ? (
            /* AI analyzing — no next button */
            <div />
          ) : step === 2 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!imageBase64 || isPlanLoading}
              className={`flex items-center gap-2 rounded-2xl px-10 py-3 font-bold transition-all active:scale-95 ${
                imageBase64 && !isPlanLoading
                  ? 'bg-[#52372d] text-white shadow-lg shadow-[#52372d]/20 hover:bg-[#6b4e43]'
                  : 'cursor-not-allowed bg-[#d4c3be] text-[#827470]'
              }`}
            >
              AI 分析
              <Sparkles className="h-4 w-4" />
            </button>
          ) : step === 4 ? (
            <button
              type="button"
              onClick={continueDesignChat}
              disabled={
                isChatLoading ||
                !activeQuestion ||
                !dynamicAnswers[activeQuestion.id] ||
                (Array.isArray(dynamicAnswers[activeQuestion.id]) &&
                  (dynamicAnswers[activeQuestion.id] as string[]).length === 0)
              }
              className={`flex items-center gap-2 rounded-2xl px-10 py-3 font-bold transition-all active:scale-95 ${
                !isChatLoading &&
                activeQuestion &&
                dynamicAnswers[activeQuestion.id] &&
                (!Array.isArray(dynamicAnswers[activeQuestion.id]) ||
                  (dynamicAnswers[activeQuestion.id] as string[]).length > 0)
                  ? 'bg-[#52372d] text-white shadow-lg shadow-[#52372d]/20 hover:bg-[#6b4e43]'
                  : 'cursor-not-allowed bg-[#d4c3be] text-[#827470]'
              }`}
            >
              {isChatLoading ? '处理中...' : '继续'}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : step === 5 ? (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate || isLoading}
              className={`flex items-center gap-2 rounded-2xl px-10 py-3 font-bold transition-all active:scale-95 ${
                canGenerate && !isLoading
                  ? 'bg-[#52372d] text-white shadow-lg shadow-[#52372d]/20 hover:bg-[#6b4e43]'
                  : 'cursor-not-allowed bg-[#d4c3be] text-[#827470]'
              }`}
            >
              开始生成
              <Wand2 className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="flex items-center gap-2 rounded-2xl bg-[#52372d] px-10 py-3 font-bold text-white shadow-lg shadow-[#52372d]/20 transition-all hover:bg-[#6b4e43] active:scale-95"
            >
              下一步
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </footer>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      <AnimatePresence>
        {isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#1f1b13]/90 px-6 text-center backdrop-blur-xl"
          >
            <div className="relative mb-12 flex h-48 w-48 items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-[#ebe1d3]/20" />
              <div className="relative flex flex-col items-center text-[#fff8f2]">
                <motion.div
                  animate={{ y: [0, -12, 0] }}
                  transition={{ duration: 0.95, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Cat className="h-14 w-14" />
                </motion.div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-[#fff8f2]/40">AI Curator is working</p>
              </div>
            </div>

            <div className="mb-12 w-full max-w-md space-y-5">
              <p className="text-xl font-medium tracking-tight text-[#fff8f2]">{loadingText}</p>
              <div className="relative h-[6px] w-full overflow-hidden rounded-full bg-[#fff8f2]/10">
                <motion.div className="absolute left-0 top-0 h-full rounded-full bg-[#fca780]" animate={{ width: `${loadingProgress}%` }} transition={spring} />
              </div>
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#fff8f2]/30">Processing</span>
                <span className="text-lg font-bold text-[#fca780]">{Math.round(loadingProgress)}%</span>
              </div>
            </div>

            <div className="w-full max-w-md rounded-2xl border border-[#fff8f2]/10 bg-[#fff8f2]/5 p-6 text-left backdrop-blur-md">
              <div className="flex items-start gap-4">
                <Sparkles className="h-5 w-5 text-[#fca780]" />
                <div>
                  <h4 className="mb-1 text-sm font-semibold text-[#fff8f2]">赋予空间灵魂</h4>
                  <p className="text-xs leading-relaxed text-[#fff8f2]/65">我们不仅是在重新排列家具，更是在为你编织一个更有温度的居住空间。</p>
                </div>
              </div>
            </div>

            <div className="absolute bottom-12 flex flex-col items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#fff8f2]/20">Powered by</span>
              <span className="text-xl font-extrabold tracking-tight text-[#fff8f2]">NookAI</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <nav className="fixed bottom-0 left-0 z-40 flex w-full items-center justify-around rounded-t-[24px] border-t border-[#ebe1d3]/30 bg-[#fff8f2] px-4 pb-6 pt-3 shadow-[0_-4px_24px_rgba(82,55,45,0.04)] md:hidden">
        {['灵感', '改造', '方案', '我的'].map((label, index) => {
          const active = label === '改造';
          return (
            <div
              key={label}
              className={`flex flex-col items-center justify-center px-5 py-2 ${active ? 'rounded-2xl bg-[#6b4e43] text-[#fff8f2]' : 'text-[#52372d]/60'}`}
            >
              {index === 0 ? <Sparkles className="h-4 w-4" /> : null}
              {index === 1 ? <Wand2 className="h-4 w-4" /> : null}
              {index === 2 ? <UploadCloud className="h-4 w-4" /> : null}
              {index === 3 ? <UserCircle2 className="h-4 w-4" /> : null}
              <span className="mt-1 text-[11px] font-medium tracking-wider">{label}</span>
            </div>
          );
        })}
      </nav>

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[40%] w-[40%] rounded-full bg-[#e5beb0]/30 blur-[120px]" />
        <div className="absolute -bottom-[8%] -right-[8%] h-[30%] w-[30%] rounded-full bg-[#ffdbcc]/35 blur-[100px]" />
      </div>

      <div className="sr-only">{stepTitles[step - 1]}</div>
    </div>
  );
}
