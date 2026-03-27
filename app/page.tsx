'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Cat,
  Check,
  CheckCircle2,
  Layers3,
  Palette,
  Sparkles,
  UploadCloud,
  UserCircle2,
  Wand2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { saveResult } from './lib/imageStore';

type StyleOption = {
  label: string;
  subtitle: string;
  image: string;
};

const styleOptions: StyleOption[] = [
  {
    label: '日式原木风',
    subtitle: '自然、治愈，大地的呼吸感',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCNRim0qBNvMc8HZedHQJ8wkhvPGJO0Ab_4fHEfxpCHojWkz3uWz4DGUNDvzqpeH6bUbjJSdXivyM8A3lJKSvopiuAe3sJ1YdaYykt2QWWwHr2j_9FdR-8bhu8IFDMy7m1f9mSMKRk9owFqy7AIknWURwWs2tYGZZR04xnW7QUhomYaDAVoPZlZO9fYW7s_zcaFubL8FBrvh8lKZWY-JP_DaSoZznz2OwDZpbqBspbAarYqe9WiT8u_DlodNPcPsPtvtxMdp5DhMB3d',
  },
  {
    label: '奶油治愈风',
    subtitle: '温润、柔和，棉花糖般的触感',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCGBHYgn-Q1PBKYM9QJ58i9LkR9OZ9NixL6gb-i5G12kfk_oiwNHYVKwhJPwnUg17u2Wf2PeGpohSx6_4BC9KLtWwfdDR96eidDWRJdUjGbZILxgSRTFGjwoIYSMOz2kjQCjAX-rQ9P_1gl6aD9MjKgT1S0e-A51m6lYBawBYR3z44USz6yQZrUpIyWGAaQq5d0QW5Qy0Ncw9gCbiLMzqdWIuwffHP71z5rOzRh1xO3DsJn7kIp7Lk5VSAJ1Gy5fJtcV1M_DstJojzd',
  },
  {
    label: '现代简约风',
    subtitle: '干练、纯粹，理性的空间秩序',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAZTFYZsnrja1Kpt6unx6ZlHo6Trt01Bnkxkbk_p1Rbh75ClKtyjKMVWxh5awxX6taJrri04H_sr4vd7GrksXpbW2jm7LHjxTAfB_24Fv-Dmp1Nb-GSZvMnfdSM1HkCa2RyG2idZxuYTV_SS4CZdf1G_0PJfj9wrt7Tfkr2Bf-fNExqD3eMcvmTI5aS5HXwsuk-aUkrggwHDEa9fSJcATVcaMpI0sog5Nbu90MKlkVUpSNz0m7PlxxgoKIksycgH44NBFj_nrQj_3ib',
  },
  {
    label: '轻复古文艺风',
    subtitle: '经典、格调，电影质感的时光',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCOw48FA2MkkkurCD9D_f3JzSeuSQzJwDHtv3Kpd5szi8-STBay3MKi-cb3r9EuKTkizQMsq4tIkKSz--O4jk5N-hvnYAcCIYTw9-2CKnMAxL2DvP9ngcJckfmDuU5MC5lF8bJ16nO6Zw015FVNgQyfRNpMeR0PWoRfCTO3w4pZvZ9OTCtYg1Japnm3t4BQCEK8Iz7xHGb6SIeoKVhB42yAc3njHXrqps7Syt22jXjWo0dR-yW4ofhzinKKMAwUuWjYs_93rVpkvVNm',
  },
  {
    label: '氛围感深色风',
    subtitle: '静谧、私藏，独处的深邃魅力',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCnwVnoz9v-CDFD2RYGaDR-BXJiEwM06F_aTTxlwErR-wmkEf0rSOX_phhCJKVP-_4eZykr-wCHvSfpCiqnmkJ7ME7XSwFz5hAq4ab_wvyy4r1E_Tfob052hCLlPMNTf1_LSOmgrkyQwlpyycPaTzn9eSx7tWWzlM-8VB7udupRWf7-EbEAd7yoC4fh5ytvwzru_dKsLzUVja_D9xr9UVROpg9X36iGqmdrZZF7XIsJFbcFnm5LVnWRv6MZO1CQUek49A_MZWLzzHmM',
  },
];

const stepTitles = ['欢迎', '选择风格', '改造边界', '偏好补充', '个性细节', '上传照片'];

const constraintOptions = ['不动墙面', '不替换家具', '不改动布局', '不改门窗', '不改吊顶', '不增加人工光源'];

type RequirementOption = { label: string; desc: string };
const requirementOptions: RequirementOption[] = [
  { label: '增加氛围灯', desc: '落地灯、灯串等暖光营造' },
  { label: '加入绿植', desc: '低维护，提升空间生气' },
  { label: '投影放松角', desc: '打造观影 / 休闲区' },
  { label: '收纳优化', desc: '让台面和地面更整洁' },
  { label: '社交友好', desc: '适合多人聚会的布局' },
  { label: '宠物友好', desc: '耐抓、易清洁的软装选择' },
];

const loadingLines = ['正在理解你的风格偏好...', '正在生成改造效果图...', '正在整理购物指南...'];

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
  const [selectedStyle, setSelectedStyle] = useState(styleOptions[0].label);
  const [selectedConstraints, setSelectedConstraints] = useState<string[]>(['不动墙面', '不替换家具', '不改动布局']);
  const [selectedRequirements, setSelectedRequirements] = useState<string[]>(['增加氛围灯']);
  const [customRequirement, setCustomRequirement] = useState('');

  const [previewUrl, setPreviewUrl] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState('');

  const percent = Math.round((step / 6) * 100);
  const canGenerate = Boolean(imageBase64);

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

  const toggleValue = (
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
      const raw = await fileToDataUrl(file);
      let resized = await resizeDataUrl(raw, 1024, 0.8);
      if (resized.length > 2_000_000) {
        resized = await resizeDataUrl(resized, 768, 0.72);
      }

      setPreviewUrl(resized);
      setImageBase64(dataUrlToBase64(resized));
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请重试');
    }
  };

  const goNext = () => setStep((prev) => Math.min(6, prev + 1));
  const goPrev = () => setStep((prev) => Math.max(1, prev - 1));

  const handleGenerate = async () => {
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
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 80000);
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
            signal: controller.signal,
          });

          data = await response.json().catch(() => null);
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
      <header className="fixed top-0 z-50 w-full bg-[#fff8f2]/80 backdrop-blur-xl transition-opacity duration-300">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div className="text-2xl font-bold tracking-tight text-[#52372d]">NookAI</div>
          <div className="flex items-center gap-6">
            <nav className="hidden items-center gap-8 md:flex">
              <span className="cursor-pointer font-semibold text-[#8f4d2c] transition-opacity">灵感</span>
              <span className="cursor-pointer font-medium text-[#52372d]/70 hover:opacity-80">改造</span>
              <span className="cursor-pointer font-medium text-[#52372d]/70 hover:opacity-80">方案</span>
            </nav>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm font-medium text-primary/70 md:inline-block">步骤 {step} / 6</span>
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
                      <Palette className="h-4 w-4" />
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

          {step === 2 && (
            <motion.section
              key="step-2"
              initial={{ opacity: 0, y: 24, scale: 0.98, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -16, scale: 0.98, filter: 'blur(6px)' }}
              transition={spring}
            >
              <div className="mb-8">
                <span className="text-sm font-bold uppercase tracking-widest text-[#8f4d2c]">Step 02 / 06</span>
                <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-[#52372d]">选择你的理想风格</h1>
                <p className="mt-2 text-lg text-[#504440]">点击选择一个你喜欢的空间氛围</p>
              </div>

              <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-6">
                {styleOptions.map((option, index) => {
                  const selected = option.label === selectedStyle;
                  const isLarge = index === 0;
                  const cardSpan = isLarge ? 'md:col-span-3 md:row-span-2' : 'md:col-span-3';
                  const aspectClass = isLarge ? 'aspect-[4/5]' : index >= 3 ? 'aspect-[21/9]' : 'aspect-[16/9]';

                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setSelectedStyle(option.label)}
                      className={`group relative overflow-hidden rounded-3xl border-2 text-left transition-all duration-300 active:scale-[0.98] ${cardSpan} ${
                        selected
                          ? 'border-[#6b4e43] shadow-xl ring-4 ring-[#6b4e43]/10'
                          : 'border-transparent hover:border-[#d4c3be]'
                      }`}
                    >
                      <div className={`relative w-full ${aspectClass}`}>
                        <img
                          src={option.image}
                          alt={option.label}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />

                        {selected && (
                          <div className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#52372d] text-white">
                            <Check className="h-4 w-4" />
                          </div>
                        )}

                        <div className="absolute bottom-4 left-5 right-5">
                          <h3 className={`font-bold text-white ${isLarge ? 'text-2xl' : 'text-xl'}`}>{option.label}</h3>
                          <p className="mt-1 text-xs text-white/85">{option.subtitle}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.section>
          )}

          {step === 3 && (
            <motion.section
              key="step-3"
              initial={{ opacity: 0, y: 24, scale: 0.98, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -16, scale: 0.98, filter: 'blur(6px)' }}
              transition={spring}
              className="rounded-3xl bg-white p-8"
            >
              <h2 className="text-2xl font-bold text-[#52372d]">设置改造边界</h2>
              <p className="mt-2 text-sm text-[#504440]">这些限制会直接写入生成提示词，保证方案贴合租房场景。</p>
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
                {constraintOptions.map((option) => {
                  const selected = selectedConstraints.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleValue(option, selectedConstraints, setSelectedConstraints)}
                      className={`rounded-2xl border px-4 py-3 text-sm transition ${
                        selected
                          ? 'border-[#52372d] bg-[#f7edde] font-semibold text-[#52372d]'
                          : 'border-[#d4c3be] bg-[#fff8f2] text-[#504440]'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </motion.section>
          )}

          {step === 4 && (
            <motion.section
              key="step-4"
              initial={{ opacity: 0, y: 24, scale: 0.98, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -16, scale: 0.98, filter: 'blur(6px)' }}
              transition={spring}
              className="rounded-3xl bg-white p-8"
            >
              <h2 className="text-2xl font-bold text-[#52372d]">添加你的偏好</h2>
              <p className="mt-2 text-sm text-[#504440]">这些偏好会影响软装、灯光和可购买物件建议。</p>
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
                {requirementOptions.map(({ label, desc }) => {
                  const selected = selectedRequirements.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleValue(label, selectedRequirements, setSelectedRequirements)}
                      className={`flex flex-col items-start rounded-2xl border px-4 py-3 text-left text-sm transition ${
                        selected
                          ? 'border-[#52372d] bg-[#f7edde] font-semibold text-[#52372d]'
                          : 'border-[#d4c3be] bg-[#fff8f2] text-[#504440]'
                      }`}
                    >
                      <span className={selected ? 'font-semibold' : 'font-medium'}>{label}</span>
                      <span className="mt-0.5 text-xs font-normal text-[#827470]">{desc}</span>
                    </button>
                  );
                })}
              </div>
            </motion.section>
          )}

          {step === 5 && (
            <motion.section
              key="step-5"
              initial={{ opacity: 0, y: 24, scale: 0.98, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -16, scale: 0.98, filter: 'blur(6px)' }}
              transition={spring}
              className="rounded-3xl bg-white p-8"
            >
              <h2 className="text-2xl font-bold text-[#52372d]">补充个性化需求</h2>
              <p className="mt-2 text-sm text-[#504440]">例如：希望保留书桌办公区、强调阅读角、预算优先等。</p>
              <textarea
                value={customRequirement}
                onChange={(event) => setCustomRequirement(event.target.value)}
                placeholder="输入你的补充说明..."
                className="mt-6 min-h-[180px] w-full resize-none rounded-2xl border border-[#d4c3be] bg-[#fff8f2] p-4 text-sm text-[#1f1b13] outline-none placeholder:text-[#827470]"
              />
            </motion.section>
          )}

          {step === 6 && (
            <motion.section
              key="step-6"
              initial={{ opacity: 0, y: 24, scale: 0.98, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -16, scale: 0.98, filter: 'blur(6px)' }}
              transition={spring}
            >
              <div className="mb-8 text-center">
                <h1 className="text-3xl font-extrabold tracking-tight text-[#52372d] md:text-4xl">最后一步：上传房间照片</h1>
                <p className="mt-3 text-lg text-[#504440]">请拍摄一张光线充足、能看清房间布局的照片</p>
              </div>

              <div className="mx-auto w-full max-w-3xl">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="group relative w-full cursor-pointer transition-transform duration-300 active:scale-[0.98]">
                  <div
                    className="flex aspect-[16/10] w-full flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-[#d4c3be] bg-[#fcf2e4] transition-colors group-hover:bg-[#f1e7d9]"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='24' ry='24' stroke='%23d4c3be' stroke-width='2' stroke-dasharray='12%2c12'/%3e%3c/svg%3e\")",
                    }}
                  >
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

                <div className="mt-4 space-y-2 px-1 text-sm">
                  <div className="flex items-center gap-2 text-[#52372d]">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-semibold">{previewUrl ? '照片质量良好' : '等待上传照片'}</span>
                  </div>
                  <p className="leading-relaxed text-[#504440]">我们会保留原有布局，仅提供软装建议。光影处理已自动优化。</p>
                </div>
              </div>

              {error ? <p className="mt-4 text-sm text-[#ba1a1a]">{error}</p> : null}
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

          {step < 6 ? (
            <button
              type="button"
              onClick={goNext}
              className="flex items-center gap-2 rounded-2xl bg-[#52372d] px-10 py-3 font-bold text-white shadow-lg shadow-[#52372d]/20 transition-all hover:bg-[#6b4e43] active:scale-95"
            >
              下一步
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
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
              {index === 2 ? <Layers3 className="h-4 w-4" /> : null}
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
