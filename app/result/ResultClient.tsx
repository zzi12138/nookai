'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { loadResult, type StoredResult } from '../lib/imageStore';
import { useThemeMode } from '../lib/useThemeMode';

const spring = { type: 'spring', stiffness: 260, damping: 22 } as const;

export default function ResultClient() {
  const [imageUrl, setImageUrl] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [theme, setTheme] = useState('');
  const [viewMode, setViewMode] = useState<'generated' | 'original'>('generated');
  const { theme: themeMode, toggleTheme } = useThemeMode();

  const tips = useMemo(() => {
    const map: Record<string, string[]> = {
      Japandi: ['亚麻窗帘 + 原木托盘', '纸灯罩与木质小摆件', '暖白灯泡营造宁静'],
      'Cream Minimal': ['绒感抱枕 + 柔软毯子', '圆镜与奶油色装饰画', '桌灯柔光氛围'],
      'Vintage Warm': ['复古台灯 + 海报', '叠放书籍与香薰', '暖黄灯营造怀旧'],
      'Nordic Light': ['几何地毯 + 单色靠垫', '极简壁灯或落地灯', '减少物件保持整洁'],
      'Soft Loft': ['金属细节 + 软装织物', '暖调皮革或帆布', '保留留白更利落'],
      日式原木风: ['亚麻窗帘 + 原木托盘', '纸灯罩与木质小摆件', '暖白灯泡营造宁静'],
      奶油温柔风: ['绒感抱枕 + 柔软毯子', '圆镜与奶油色装饰画', '桌灯柔光氛围'],
      现代极简风: ['几何地毯 + 单色靠垫', '极简壁灯或落地灯', '减少物件保持整洁'],
      文艺复古风: ['复古台灯 + 海报', '叠放书籍与香薰', '暖黄灯营造怀旧'],
      绿植自然风: ['多盆绿植层次摆放', '天然棉麻织物', '清爽自然光感'],
    };
    return map[theme] || ['柔和灯光分区', '轻量软装搭配', '小摆件营造氛围'];
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    let isActive = true;

    const load = async () => {
      if (id) {
        try {
          const stored = await loadResult(id);
          if (stored && isActive) {
            setImageUrl(stored.generated);
            setOriginalUrl(stored.original);
            setTheme(stored.theme || '');
            return;
          }
        } catch {
          // Ignore and fall back to sessionStorage/query param.
        }
      }

      const stored = sessionStorage.getItem('nookai_result_image');
      if (stored && isActive) {
        try {
          const parsed = JSON.parse(stored) as StoredResult;
          setImageUrl(parsed.generated);
          setOriginalUrl(parsed.original);
          setTheme(parsed.theme || '');
          return;
        } catch {
          // Fallback below.
        }
      }

      const img = params.get('img');
      if (isActive) {
        setImageUrl(img ? decodeURIComponent(img) : '');
      }
    };

    load();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!originalUrl) {
      setViewMode('generated');
    }
  }, [originalUrl]);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-20">
      <div className="mx-auto w-full max-w-[980px] px-6 pt-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">Nook</p>
            <p className="text-xs text-[var(--text-muted)]">生成结果</p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-xs text-[var(--text-muted)]"
          >
            {themeMode === 'dark' ? '深色' : '浅色'}主题
          </button>
        </header>

        {imageUrl ? (
          <div className="mt-6 space-y-5">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[var(--shadow)]">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                <span>{viewMode === 'original' ? '原图' : '效果图'}</span>
                <span>{theme ? `风格：${theme}` : '风格：未记录'}</span>
              </div>
              <div className="mt-3 relative overflow-hidden rounded-2xl border border-[var(--border)]">
                <img
                  src={viewMode === 'original' && originalUrl ? originalUrl : imageUrl}
                  alt={viewMode === 'original' ? '原始照片' : 'NookAI 生成效果图'}
                  className="w-full h-auto object-contain block"
                />
              </div>
              <div className="mt-4 flex gap-2">
                <motion.button
                  type="button"
                  onClick={() => setViewMode('original')}
                  disabled={!originalUrl}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  transition={spring}
                  className={`flex-1 rounded-2xl border px-5 py-3 text-sm font-semibold ${
                    viewMode === 'original'
                      ? 'border-[var(--accent-strong)] text-[var(--text)]'
                      : 'border-[var(--border)] text-[var(--text-muted)]'
                  } ${originalUrl ? '' : 'cursor-not-allowed opacity-60'}`}
                >
                  原图
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => setViewMode('generated')}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  transition={spring}
                  className={`flex-1 rounded-2xl border px-5 py-3 text-sm font-semibold ${
                    viewMode === 'generated'
                      ? 'border-[var(--accent-strong)] text-[var(--text)]'
                      : 'border-[var(--border)] text-[var(--text-muted)]'
                  }`}
                >
                  效果图
                </motion.button>
              </div>
              {!originalUrl ? (
                <p className="mt-2 text-xs text-amber-700">
                  未找到原图，请从上传页重新生成以保存原图。
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                建议
              </p>
              <ul className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
                {tips.map((tip) => (
                  <li key={tip}>• {tip}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel-soft)] p-8 text-center text-sm text-[var(--text-muted)]">
            还没有效果图，请先返回上传页面。
          </div>
        )}
      </div>
    </div>
  );
}
